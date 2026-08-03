"""
Single source of truth for "the current time" and UTC-aware datetimes
across the backend.

ROOT CAUSE THIS FILE FIXES
---------------------------
Every relative timestamp in the app ("5 minutes ago", "today", "6 hours
ago") was off by ~India's UTC offset (5:30). The chain was:

1. SQLAlchemy models stored `datetime.utcnow()` -- a *naive* datetime
   (no tzinfo) that happens to mean UTC, but doesn't say so.
2. Pydantic serialized that naive datetime straight to JSON with no
   timezone marker at all, e.g. "2026-08-03T10:15:30.123456" (no "Z",
   no "+00:00").
3. The frontend parsed that string with `new Date(iso)`. Per the
   ECMAScript Date spec, an ISO 8601 date-time string with **no**
   offset is parsed as *local* time, not UTC. So a truly-UTC instant
   got silently reinterpreted as if it were already in the browser's
   timezone (IST, UTC+5:30) -- shifting every relative timestamp by
   that offset.
4. This hit every page that renders server-provided timestamps
   (Dashboard, Notifications, Activity, Project Workspace, Study Hub,
   AI Workspace) because they all ultimately parse the same
   unmarked API strings. The one exception was the top bar clock,
   which never touches server data -- it just calls `new Date()` for
   "now" in the browser.

THE FIX
-------
Make datetimes timezone-aware (UTC) everywhere they cross the ORM
boundary (see `models.UTCDateTime`), so Pydantic's default JSON
serialization automatically includes the UTC marker ("...Z") and the
frontend's existing `new Date(iso)` calls parse it correctly -- with
no per-page changes needed.

That requires every "now" used for comparisons against a model's
timestamp column to also be timezone-aware (Python refuses to compare
naive and aware datetimes). `utc_now()` is that single replacement for
the `datetime.utcnow()` calls that used to be scattered across the
routers, security code, and urgency engine.
"""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """Timezone-aware 'now' in UTC. Use this everywhere instead of the
    naive `datetime.utcnow()` -- it compares safely against any
    timestamp read back from a `models.UTCDateTime` column."""
    return datetime.now(timezone.utc)
