"""
Web Push plumbing: per-device push subscription storage plus a
shared-secret dispatch endpoint, so the installed PWA receives
system-level notifications on the phone even with every browser/app
closed (the client-side schedulers in useNotificationScheduler.ts /
useTokenRefreshScheduler.ts can only fire while a tab is open).

Two halves:

1. `/subscriptions` -- authenticated CRUD for `models.PushSubscription`
   rows. The Settings page posts the raw PushSubscription a browser
   hands back from pushManager.subscribe(); each device that enables
   background delivery gets one row (endpoint is unique per browser
   profile), so notifications fan out to all of them.

2. `/dispatch` + `dispatch_for_user_now()` -- two triggers over one
   shared engine (`_dispatch_for_user`). The pinger (uptime bot, or the
   fallback GitHub Actions workflow) hits `/dispatch` every few minutes;
   that remains the only way *time-only* transitions can be caught --
   a deadline quietly going overdue fires no API call, so nothing else
   could notice. Everything that DOES ride an API call -- creating a task
   due in 20 minutes, moving a reminder up -- is pushed instantly via
   `dispatch_for_user_now()`, which routers/tasks.py and
   routers/ai_accounts.py call right after their commit. Both replay the
   *exact same* checks and message copy the two client schedulers
   perform while the tab is open, deduplicated server-side via
   models.PushDispatchLog (the DB analogue of their localStorage logs)
   so overlapping triggers can never double-send. `/dispatch` is guarded
   by DISPATCH_SECRET rather than user auth because it runs unattended;
   both a header form (GitHub Actions) and a query-param form (uptime
   monitors that can't send custom headers) are accepted.

No existing router, model, or behavior is modified -- the two mutation
hooks are single fire-and-forget calls appended after already-committed
work, safe to remove without a trace.
"""
import json
import os
import secrets
from datetime import timedelta
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pywebpush import WebPushException, webpush
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..ownership_helpers import owned_query
from ..timeutils import utc_now
from .. import models, schemas
from ..auth_dependencies import get_current_user

router = APIRouter(prefix="/api/push", tags=["push"])

# Same windows as the client schedulers these mirror:
# WARNING_WINDOW_MINUTES in useNotificationScheduler.ts (tasks) and
# useTokenRefreshScheduler.ts (token reminders).
TASK_WARNING_WINDOW_MINUTES = 60
TOKEN_WARNING_WINDOW_MINUTES = 15

# PushDispatchLog housekeeping: dedup rows older than this are swept by
# each dispatch run. Long past any of the windows above, they'd never be
# consulted again except in the pathological "reminder stayed overdue for
# a month" case, where a re-ping is arguably desirable anyway.
LOG_RETENTION_DAYS = 30

# RFC 8030 time-to-live: how long the push service stores a message for a
# device that isn't reachable right now. pywebpush defaults to ttl=0 --
# "discard unless reachable this instant" -- which would permanently lose an
# alert whenever the phone is in deep doze / offline at ping time, while the
# dedup log still records it as delivered. Six hours bridges doze and
# network gaps; past that a "due in N min" ping is noise anyway.
PUSH_TTL_SECONDS = 6 * 60 * 60

# The only hosts the dispatcher will ever POST pushes to. Pinning these at
# registration time keeps the client-supplied endpoint field from doubling
# as an SSRF vector (any authenticated user could otherwise point the
# server's outbound POST at internal addresses, VAPID Authorization header
# attached). Add an entry if a new push vendor ever becomes relevant.
ALLOWED_PUSH_HOSTS = frozenset(
    [
        "fcm.googleapis.com",                # Chrome/Chromium/Opera/Samsung
        "updates.push.services.mozilla.com", # Firefox
        "web.push.apple.com",                # Safari 16.4+ (incl. iOS home-screen)
    ]
)


def _validate_endpoint(endpoint: str) -> None:
    """Reject anything that isn't an https URL on a known push-service host."""
    parsed = urlsplit(endpoint)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_PUSH_HOSTS:
        raise HTTPException(status_code=400, detail="Unrecognized push service endpoint")


def _vapid_claims() -> Optional[Dict[str, str]]:
    """VAPID issuer claims for pywebpush. Returns None when signing keys
    aren't configured, which leaves push silently inert (the Settings UI
    hides itself too -- see frontend/src/lib/push.ts's isPushSupported).
    VAPID_SUBJECT must be a mailto: or https:// URL per the VAPID spec."""
    private_key = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not private_key:
        return None
    subject = os.environ.get("VAPID_SUBJECT", "").strip() or "mailto:admin@example.com"
    return {"sub": subject}


def _is_authorized(header_secret: Optional[str], key_param: Optional[str]) -> bool:
    """Dispatch auth: either the `x-dispatch-secret` header or a `?key=`
    query param must match env DISPATCH_SECRET (constant-time compare).
    The query form exists for uptime monitors that can't set headers."""
    expected = os.environ.get("DISPATCH_SECRET", "").strip()
    if not expected:
        return False
    supplied = (header_secret or "").strip() or (key_param or "").strip()
    if not supplied:
        return False
    # bytes (not str) so compare_digest can't raise on non-ASCII input.
    return secrets.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8"))


@router.post("/subscriptions")
def create_subscription(
    payload: schemas.PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Register/refresh this device's push subscription. Upsert by the
    (unique) endpoint URL: re-enabling on an already-known device updates
    its encryption keys instead of duplicating the row. An endpoint that
    somehow arrives already owned by another account (endpoints are
    browser-profile-wide, not account-scoped) is reassigned to whoever
    just proved ownership of it."""
    _validate_endpoint(payload.endpoint)
    sub = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.endpoint == payload.endpoint)
        .first()
    )
    if sub is None:
        sub = models.PushSubscription(user_id=current_user.id, endpoint=payload.endpoint)
        db.add(sub)
    elif sub.user_id != current_user.id:
        sub.user_id = current_user.id
    sub.p256dh = payload.keys.p256dh
    sub.auth = payload.keys.auth
    db.commit()
    return {"ok": True}


@router.delete("/subscriptions")
def delete_subscription(
    payload: schemas.PushSubscriptionDelete,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove this device's subscription (Settings' Disable button --
    also mirrors pushManager.unsubscribe() locally). Only ever deletes
    the caller's own row."""
    deleted = (
        db.query(models.PushSubscription)
        .filter(
            models.PushSubscription.user_id == current_user.id,
            models.PushSubscription.endpoint == payload.endpoint,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"ok": True, "deleted": deleted}


@router.post("/test")
def send_test_push(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Push a test notification to every device the caller subscribed, so
    background delivery can be verified from Settings without staging a task
    deadline. Same send/prune path as the dispatcher -- if this arrives, the
    real deadline alerts will too."""
    vapid_claims = _vapid_claims()
    if vapid_claims is None:
        raise HTTPException(status_code=503, detail="Push not configured (VAPID_PRIVATE_KEY missing)")

    subs = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.user_id == current_user.id)
        .all()
    )
    message = json.dumps(
        {
            "title": "Test notification",
            "body": "Background delivery works -- this arrived through the push pipeline.",
            "url": "/",
        }
    )
    sent = 0
    pruned = 0
    failed = 0
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=message,
                ttl=PUSH_TTL_SECONDS,
                # Urgency: high so the test behaves exactly like the real
                # alerts -- waking a dozing phone instead of sitting in
                # FCM's normal-priority queue until the device next wakes.
                headers={"Urgency": "high"},
                vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
                vapid_claims=vapid_claims,
            )
            sub.last_used_at = utc_now()
            sent += 1
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status in (404, 410):
                # Dead subscription -- prune so Settings stops counting it.
                db.delete(sub)
                pruned += 1
            else:
                failed += 1
        except Exception:
            failed += 1
    db.commit()
    return {"sent": sent, "pruned": pruned, "failed": failed}


def _collect_task_events(
    db: Session, user_id: str, now, task_ids: Optional[List[str]] = None
) -> List[Tuple[str, str, str, str]]:
    """(dedup_key, title, body, url) tuples for tasks entering their final
    hour / first going overdue. Mirrors useNotificationScheduler.ts line
    for line -- same skip conditions (`done`, no deadline), same windows,
    same copy, same `${task.id}:soon|overdue` keys. Pass task_ids to scope
    the scan to specific tasks (the instant-dispatch path does, so a
    mutation only alerts about the record it just touched)."""
    events: List[Tuple[str, str, str, str]] = []
    task_query = (
        owned_query(db, models.Task, user_id)
        .filter(models.Task.status != models.TaskStatus.done)
        .filter(models.Task.deadline.isnot(None))
    )
    if task_ids is not None:
        task_query = task_query.filter(models.Task.id.in_(task_ids))
    tasks = task_query.all()
    for task in tasks:
        minutes_left = (task.deadline - now).total_seconds() / 60
        if minutes_left <= 0:
            events.append(
                (
                    f"{task.id}:overdue",
                    "Task overdue",
                    f'"{task.title}" has passed its deadline.',
                    "/tasks",
                )
            )
        elif minutes_left <= TASK_WARNING_WINDOW_MINUTES:
            events.append(
                (
                    f"{task.id}:soon",
                    "Deadline approaching",
                    f'"{task.title}" is due in about {round(minutes_left)} min.',
                    "/tasks",
                )
            )
    return events


def _collect_token_events(
    db: Session, user_id: str, now, account_ids: Optional[List[str]] = None
) -> List[Tuple[str, str, str, str]]:
    """Same mirroring for AI-account token-refresh reminders, against
    AIAccount.token_refresh_reminder_at -- useTokenRefreshScheduler.ts's
    rules and copy, including the reminder ISO timestamp baked into the
    dedup key so changing the reminder time re-arms the alert exactly
    like the client's `${account.id}:${iso}:soon|reached` key does.
    account_ids scopes the scan like task_ids does above."""
    events: List[Tuple[str, str, str, str]] = []
    account_query = (
        owned_query(db, models.AIAccount, user_id)
        .filter(models.AIAccount.token_refresh_reminder_at.isnot(None))
    )
    if account_ids is not None:
        account_query = account_query.filter(models.AIAccount.id.in_(account_ids))
    accounts = account_query.all()
    for account in accounts:
        iso = account.token_refresh_reminder_at.isoformat()
        minutes_left = (account.token_refresh_reminder_at - now).total_seconds() / 60
        if minutes_left <= 0:
            events.append(
                (
                    f"{account.id}:{iso}:reached",
                    "Token refresh reminder",
                    f'Your reminder for "{account.name}" has been reached.',
                    "/ai-workspace",
                )
            )
        elif minutes_left <= TOKEN_WARNING_WINDOW_MINUTES:
            events.append(
                (
                    f"{account.id}:{iso}:soon",
                    "Token refresh expiring soon",
                    f'"{account.name}" reminder in about {round(minutes_left)} min.',
                    "/ai-workspace",
                )
            )
    return events


def _dispatch_for_user(
    db: Session,
    user_id: str,
    now,
    task_ids: Optional[List[str]] = None,
    account_ids: Optional[List[str]] = None,
) -> Dict[str, int]:
    """The shared send engine behind both triggers: collect this user's
    alert-worthy events, skip everything PushDispatchLog already holds,
    fan each remaining event out to every device, prune dead
    subscriptions, log dedup rows for whatever at least one device
    accepted. Returns {"sent", "pruned", "failed"}.

    task_ids/account_ids scope the scan -- instant dispatch passes just
    the record a mutation touched; the pinger leaves them unset for
    everything. Commits its own writes under the same transaction-scoped
    advisory lock the old monolithic pinger held, re-taken per call,
    which still covers exactly the window that matters (dedup check ->
    send -> log insert), so a pinger tick and an inline trigger can
    never both see an empty log for the same event and double-send."""
    counts: Dict[str, int] = {"sent": 0, "pruned": 0, "failed": 0}

    # Fail fast rather than churning every event into `failed` forever --
    # without signing keys nothing can ever be delivered.
    vapid_claims = _vapid_claims()
    if vapid_claims is None:
        return counts

    events = _collect_task_events(db, user_id, now, task_ids) + _collect_token_events(
        db, user_id, now, account_ids
    )
    if not events:
        return counts

    live_subs = (
        db.query(models.PushSubscription)
        .filter(models.PushSubscription.user_id == user_id)
        .all()
    )
    if not live_subs:
        return counts

    # Serialize concurrent triggers on Postgres (production) so overlapping
    # runs -- uptime bot, Actions fallback, an inline mutation hook -- can't
    # both read an empty dedup log and double-send. Taken only once there's
    # actual work in sight so idle calls never hold the global lock;
    # released by the commit/rollback at the bottom. SQLite (local dev) has
    # no such function and no real concurrency either, hence the gate.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('push_dispatch'))"))

    # Skip everything already delivered (per user + dedup key).
    existing = {
        row_key
        for (row_key,) in db.query(models.PushDispatchLog.dedup_key)
        .filter(
            models.PushDispatchLog.user_id == user_id,
            models.PushDispatchLog.dedup_key.in_([e[0] for e in events]),
        )
        .all()
    }
    pending = [event for event in events if event[0] not in existing]
    if not pending:
        db.rollback()  # release the advisory lock -- nothing to persist
        return counts

    dead_subs: List[models.PushSubscription] = []

    for dedup_key, title, body, url in pending:
        message = json.dumps({"title": title, "body": body, "url": url})
        delivered_to = 0
        still_live: List[models.PushSubscription] = []
        for sub in live_subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=message,
                    ttl=PUSH_TTL_SECONDS,
                    # Urgency: high -> FCM delivers as a high-priority
                    # message that wakes the device out of Doze. Without
                    # it the push sits at normal urgency and Android
                    # defers it until the phone next wakes -- i.e. it
                    # only "arrives" when the app is opened.
                    headers={"Urgency": "high"},
                    vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
                    vapid_claims=vapid_claims,
                )
                sub.last_used_at = now
                delivered_to += 1
                still_live.append(sub)
            except WebPushException as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                if status in (404, 410):
                    # Subscription expired/cleared (site data wiped,
                    # PWA uninstalled, ...) -- prune so we stop paying
                    # for it, and drop it from this run's fan-out.
                    dead_subs.append(sub)
                    counts["pruned"] += 1
                else:
                    # Transient (push service hiccup, bad payload for
                    # this one device): leave the dedup row unwritten
                    # below so the next trigger retries -- but keep the
                    # sub in the live list, since it's healthy and later
                    # events in this run should still reach it.
                    counts["failed"] += 1
                    still_live.append(sub)
            except Exception:
                counts["failed"] += 1
                still_live.append(sub)
        live_subs = still_live
        if delivered_to > 0:
            counts["sent"] += delivered_to
            db.add(models.PushDispatchLog(user_id=user_id, dedup_key=dedup_key))

    for sub in dead_subs:
        db.delete(sub)

    try:
        db.commit()
    except IntegrityError:
        # Belt-and-braces for a race the advisory lock above already makes
        # near-impossible: an overlapping trigger committed its dedup rows
        # first, so ours collide. Roll back quietly instead of failing the
        # caller; any sends we made were real and the next trigger
        # reconciles.
        db.rollback()
    return counts


def dispatch_for_user_now(
    db: Session,
    user_id: str,
    *,
    task_ids: Optional[List[str]] = None,
    account_ids: Optional[List[str]] = None,
) -> None:
    """Instant-dispatch entry point for sibling routers: call right after
    a task / AI-account mutation has committed, so an alert-worthy change
    -- a deadline set 20 minutes out, a reminder moved up -- reaches every
    subscribed device within that same request instead of waiting up to
    five minutes for the next uptime ping. Scope it to the record the
    mutation touched (task_ids / account_ids) so an unrelated backlog
    can't ride along on this request's latency.

    Time-only transitions stay with the pinger on purpose: no API call
    fires when a deadline simply goes overdue by itself, so nothing could
    relay it except the periodic scan.

    Fire-and-forget by design: every failure is swallowed (and the
    session rolled back clean) because push delivery must never fail the
    mutation that triggered it -- whatever this misses, the next pinger
    retries via the shared dedup log."""
    try:
        _dispatch_for_user(
            db,
            user_id,
            utc_now(),
            # An absent scope here means "this mutation touched nothing of
            # that kind" -- NOT the pinger's "scan everything". Otherwise a
            # task edit would sweep unrelated token-reminder alerts onto its
            # request latency.
            task_ids=task_ids if task_ids is not None else [],
            account_ids=account_ids if account_ids is not None else [],
        )
    except Exception:
        db.rollback()


# HEAD/OPTIONS exist for uptime monitors: probes arrive in every method
# flavor depending on the monitor app's default, and any of them that
# 405s reads as "site down" while silently never triggering a dispatch.
# Each accepted probe doubles as a real dispatch tick instead.
@router.api_route("/dispatch", methods=["GET", "HEAD", "POST", "OPTIONS"])
def dispatch_push_notifications(
    x_dispatch_secret: Optional[str] = Header(default=None),
    key: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Scan every subscriber's tasks/token reminders and push anything
    new -- one run of the shared _dispatch_for_user engine per
    subscriber, the same engine routers/tasks.py and
    routers/ai_accounts.py fire inline after their mutations so
    API-visible changes arrive instantly; this ping exists for the
    time-only transitions those hooks can't see (a deadline crossing
    into overdue on its own). Idempotent per event via PushDispatchLog,
    safe to call at any frequency by any number of overlapping triggers.
    A dedup row is only written once at least one of the user's devices
    accepted the send, so a transient push-service outage retries on the
    next ping instead of eating the alert; devices answering 404/410 Gone
    are pruned on the spot."""
    if not _is_authorized(x_dispatch_secret, key):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Fail fast rather than churning every event into `failed` forever --
    # without signing keys nothing can ever be delivered. (The engine
    # itself treats a missing key as a silent no-op; an attended ping
    # deserves a visible signal instead.)
    if _vapid_claims() is None:
        raise HTTPException(status_code=503, detail="Push not configured (VAPID_PRIVATE_KEY missing)")

    now = utc_now()
    sent = 0
    pruned = 0
    failed = 0
    users_notified = 0

    # One engine run per subscriber (not per device): the engine fans out
    # to all of a user's devices itself.
    subscriber_ids = [
        row[0]
        for row in db.query(models.PushSubscription.user_id).distinct().all()
    ]
    for user_id in sorted(subscriber_ids):
        counts = _dispatch_for_user(db, user_id, now)
        sent += counts["sent"]
        pruned += counts["pruned"]
        failed += counts["failed"]
        if counts["sent"] > 0:
            users_notified += 1

    # Sweep stale dedup rows so the log table stays tiny.
    cutoff = now - timedelta(days=LOG_RETENTION_DAYS)
    db.query(models.PushDispatchLog).filter(models.PushDispatchLog.sent_at < cutoff).delete(
        synchronize_session=False
    )

    try:
        db.commit()
    except IntegrityError:
        # Belt-and-braces alongside the engine's own guard: roll back
        # quietly instead of 500ing the monitor; the sweep simply retries
        # on the next ping.
        db.rollback()
    return {
        "users_notified": users_notified,
        "notifications_sent": sent,
        "subscriptions_pruned": pruned,
        "failed": failed,
    }
