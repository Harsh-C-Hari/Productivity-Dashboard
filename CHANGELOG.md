# CHANGELOG.md

# Personal Productivity System Changelog

This file tracks notable changes to the project, newest first.

---

## Merge Phase 5/5 — Final Verification

Status: Phase 5 (final) of the 5-phase merge bringing the Authorization
& Multi-user Data Isolation implementation into `main`. This phase did
not port any new code from the `authorisation-fixed` branch -- its job
was to independently verify the merge produced by Phases 1-4 against
the true original `main` (not just against prior phases' intermediate
zips), and to fix anything found broken. This is the last phase; there
is no Phase 6.

### Scope diff (Phase 4 zip vs. original main.zip)

Confirmed exactly 31 files differ from original `main`, matching the
expected breakdown: 4 from Phase 1 (`database.py`, `main.py`,
`models.py` changed; `ownership_helpers.py` new), 24 from Phase 2 (the
bulk auth-only routers, including `activity_log.py`), 0 from Phase 3
(verification only), 3 from Phase 4 (`App.tsx`, `AuthContext.tsx`
changed; `queryClient.ts` new). `AI_HANDOFF.md`/`CHANGELOG.md` differ
as expected (doc updates each phase). Every other file was confirmed
byte-identical to original `main` -- with one exception, below.

### Bug found and fixed: missing `.gitignore`

The root-level `.gitignore` present in original `main` was **absent**
from the Phase 4 zip -- not a file any phase was supposed to touch, so
this was accidental data loss somewhere in Phases 1-4 (most likely
dropped during a re-zip step, since every other dotfile in the tree --
`.env.example`, `.eslintrc.cjs`, `backend/uploads/.gitkeep` -- survived
intact). Fixed by restoring it verbatim from `main.zip`; diffed the
restored file against the original to confirm it is now byte-identical.
This is the only code/asset change made in Phase 5.

### Verification sweep results (no further issues found)

- **Ownership/project-access helper usage**: every `owned_query`,
  `get_owned_or_404`, `get_accessible_project_ids`, and
  `require_project_access` call site (116 call sites total across the
  backend) checked individually for correct model/user/project scoping.
  All correct. `require_owner_id` is defined but has no call sites --
  not a bug: the inherited-ownership modules (`notes.py`,
  `resources.py`, `assignments.py`, `conversations.py`,
  `ai_handoffs.py`, `token_trackers.py`) instead use local
  join-filter-in-one-query helpers that enforce the same ownership
  check via a different (equally correct) technique.
- **Unscoped query sweep**: every `.query(` call site across every
  router reviewed. All hits were either already scoped by an
  ownership/access filter, or narrowed by an already-validated parent
  id (e.g. `token_trackers.get_account_token_total` querying
  `TokenTracker.ai_account_id == account_id` after
  `_get_owned_account` already confirmed that account belongs to the
  caller). No unscoped leaks found.
- **Ownership filter sweep**: every personal-data module (tasks,
  timetable, subjects, study hub, AI accounts, prompt templates,
  knowledge articles, notes, resources, user/notification preferences)
  confirmed to filter by the current user's ownership in every
  endpoint.
- **Project-access sweep**: every project-scoped query confirmed
  protected, including `bugs.py`'s and `project_zips.py`'s
  cross-project listing endpoints (correctly switch between
  `require_project_access` for a single project and
  `get_accessible_project_ids` for the "across every project I can
  access" case).
- **Feature-survival check**: Avatar picker/cropper and the full
  photo-upload chain (`Profile.tsx` -> `schemas.py`'s
  `max_length=2_000_000` -> `models.py`'s `Text` column) traced and
  confirmed intact -- this chain was already correct in original
  `main` and untouched by the merge. Notification Center, the
  resend-invitation -> `delete_stale_invitation_notifications` wiring,
  AI Workspace analytics/navigation, ZIP Manager's cross-project "All
  projects" filter (frontend `ZipManagerView.tsx`/`useProjectZips.ts`
  through to `project_zips.py`), mobile nav, and the Dashboard's
  cross-project Open Bugs widget (`OpenBugsWidget.tsx` calling
  `GET /api/bugs` with no `project_id`) all read through end-to-end and
  confirmed working as designed.
- **Startup/schema integrity**: `database.py`'s
  `run_startup_migrations()` covers exactly the 7 tables that gained a
  `user_id` column in `models.py` (tasks, timetable_slots, subjects,
  study_sessions, ai_accounts, prompt_templates, knowledge_articles);
  confirmed called from `main.py` immediately after
  `models.Base.metadata.create_all(bind=engine)`.
- **Compile check**: every backend `.py` file passes `py_compile`
  cleanly. Frontend `npm install` succeeded (network access available
  this phase) and `npx tsc --noEmit` passed with zero errors, so no
  fallback manual re-read was needed.

### Verdict

**Production-ready**, after the `.gitignore` restoration above. No
authorization gaps, no lost main-branch code, no regressions found.

---

## Merge Phase 4/5 — Frontend Session Isolation

Status: Phase 4 of a 5-phase merge bringing the Authorization &
Multi-user Data Isolation implementation (from the older
`authorisation-fixed` branch) into `main` without losing any of
main's newer features. This phase covers the frontend half of the
merge: a `QueryClient` extraction and the logout cache-clearing fix
that depends on it.

### `frontend/src/lib/queryClient.ts` (new)

Added verbatim from the authorization branch. Pulls the `QueryClient`
instance out of `App.tsx` into its own module so `AuthContext.tsx` can
import and call `.clear()` on it without creating a circular
dependency (`App.tsx` renders `AuthProvider`, so `AuthProvider` can't
import the client back out of `App.tsx`).

### `frontend/src/App.tsx`

Now imports `queryClient` from `lib/queryClient.ts` instead of
constructing it inline. No other changes.

### `frontend/src/context/AuthContext.tsx`

`clearSession` — the single choke point that `logout`, the
refresh-failure path, and the `onAuthExpired` listener all run
through — now calls `queryClient.clear()`. Previously, logging out
left every cached query (dashboard widgets, tasks, Study Hub, Project
Workspace, AI Workspace, notifications) sitting in memory, so on a
shared device the next person to log in could briefly see the
previous user's cached data before their own refetch resolved. No
other changes.

### `frontend/src/pages/Profile.tsx` — investigated, no change made

This was originally flagged as needing a hand-merge (main's
file-picker + image-editing avatar UI vs. the authorization branch's
older plain text-URL input). Diffing it against the authorization
branch confirms the same false-positive pattern seen with
`bugs.py`/`project_zips.py` in Phase 3: the authorization branch's
`Profile.tsx` has no authorization-specific content at all — the only
differences are the older avatar-input UI (a plain URL `<Input>`
instead of main's file-picker/image-editing flow), nothing related to
permissions, ownership, or access control. `Profile.tsx` was left
unchanged. This should not be re-flagged in Phase 5.

---

## Merge Phase 3/5 — Authorization Verification (Bugs, ZIPs, Invitations)

Status: Phase 3 of a 5-phase merge bringing the Authorization &
Multi-user Data Isolation implementation (from the older
`authorisation-fixed` branch) into `main` without losing any of
main's newer features. The original merge plan assumed
`bugs.py`, `project_zips.py`, `notification_helpers.py`, and
`project_invitations.py` each had real, competing logic on both
branches requiring a hand-merge. That assumption was checked and found
incorrect: all 4 files were already in their correct final state in
`main` before this merge began, and **no code changes were made in
this phase.**

### `backend/app/routers/bugs.py` and `backend/app/routers/project_zips.py`

Diffing both files against the authorization branch shows the
authorization branch is the one that's behind, not competing: its
`list_bugs`/`list_project_zips` require `project_id` and return
single-project results only. Main's versions already had the more
complete behavior — `project_id` optional (`Optional[str]`, powering
the Dashboard's cross-project "Open Bugs" widget and the ZIP Manager's
"All projects" filter), `require_project_access` called when a
`project_id` is supplied, and `get_accessible_project_ids` filtering
the query when it's omitted. Every other endpoint in both files
(get/create/update/delete) was independently confirmed to already call
`require_project_access` before touching data. Main was ahead of the
authorization branch on these two files, not merging against it.

### `backend/app/notification_helpers.py` + `backend/app/routers/project_invitations.py`

`delete_stale_invitation_notifications(db, invitation_id)` — which
clears a resent invitation's stale earlier notification so its
now-rotated token's link doesn't sit in the invitee's Notification
Center pointing at a 404 forever — was confirmed present in
`notification_helpers.py` and confirmed called from the resend
endpoint in `project_invitations.py`. This is a main-only feature that
simply postdates the authorization branch's snapshot of these files;
diffing shows no other difference between the two branches' copies of
either file, so there was no competing authorization logic to
reconcile here either.

---

## Merge Phase 2/5 — Bulk Authorization Routers

Status: Phase 2 of a 5-phase merge bringing the Authorization &
Multi-user Data Isolation implementation (from the older
`authorisation-fixed` branch) into `main` without losing any of
main's newer features. This phase bulk-copies 24 backend router/helper
files that were pure auth/ownership-filtering additions in the
authorization branch, with no competing feature work from main in the
same file — each was verbatim-replaced in full after diffing to
confirm no non-auth changes were present.

### Changed (verbatim from `authorisation-fixed` branch)

- `backend/app/activity_log.py`
- `backend/app/routers/activity.py`
- `backend/app/routers/ai_accounts.py`
- `backend/app/routers/ai_analytics.py`
- `backend/app/routers/ai_handoffs.py`
- `backend/app/routers/analytics.py`
- `backend/app/routers/assignments.py`
- `backend/app/routers/conversations.py`
- `backend/app/routers/dashboard.py`
- `backend/app/routers/knowledge_articles.py`
- `backend/app/routers/notes.py`
- `backend/app/routers/notification_preferences.py`
- `backend/app/routers/projects.py`
- `backend/app/routers/prompt_templates.py`
- `backend/app/routers/resources.py`
- `backend/app/routers/search.py`
- `backend/app/routers/study_hub.py`
- `backend/app/routers/study_sessions.py`
- `backend/app/routers/subjects.py`
- `backend/app/routers/tasks.py`
- `backend/app/routers/timetable.py`
- `backend/app/routers/token_trackers.py`
- `backend/app/routers/user_preferences.py`
- `backend/app/routers/users.py`

No other files were touched in this phase.

---

## Merge Phase 1/5 — Foundation

Status: Phase 1 of a 5-phase merge bringing the Authorization &
Multi-user Data Isolation implementation (from the older
`authorisation-fixed` branch) into `main` without losing any of
main's newer features. This phase lays the foundation only:
migrations, ownership helpers, and the model/schema columns needed by
later phases. No routers or frontend code were touched.

### Added

- **`backend/app/ownership_helpers.py`** (new file, copied verbatim
  from the authorization branch): shared `owned_query`,
  `require_owner_id`, and `get_owned_or_404` helpers used by later
  phases to scope personal (non-Project) data to its owning user.
- **`backend/app/database.py`**: added `run_startup_migrations()` and
  the `_OWNERSHIP_COLUMNS` list, a dependency-free migration that adds
  the new `user_id` ownership columns to any pre-existing
  `dashboard.db` on startup (no-op on a fresh database).
- **`backend/app/main.py`**: imports and calls
  `run_startup_migrations()` on startup, right after table creation.
- **`backend/app/models.py`**: added nullable `user_id` ForeignKey
  columns (to `users.id`, `ondelete="CASCADE"`) to `Task`,
  `TimetableSlot`, `Subject`, `StudySession`, the AI Workspace /
  Conversation-family models, and `KnowledgeArticle`, so each row can
  be scoped to its owning user.

### Excluded (intentional)

- **`avatar_url`**: the authorization branch narrowed this column to
  `Column(String(500), default="")` (models.py) and
  `Field(..., max_length=500)` (schemas.py, 4 occurrences). Main
  already widened `avatar_url` to `Column(Text, default="")` /
  `max_length=2_000_000` to support base64 profile-photo data, a
  main-only feature. That narrowing was **not** applied — main's wider
  version was kept as-is in both files. Every other authorization-branch
  change in models.py and schemas.py was applied; schemas.py in fact
  had no other differences, so it is otherwise identical to main's
  version.

No other files were changed in this phase. See `AI_HANDOFF.md` →
"Authorization Merge Progress" for what's left.

---

## [1.0.0] - Invitation System Completion & Notification Center (Conversation 8)

Status: Feature-complete per task brief (Parts 1-8). Scope: finish the
Invitation System without SMTP, add a Notification Center as a new
top-level module, wire invitations through it, add a Dashboard widget,
then a mobile optimization pass, UX polish, and a placeholder sweep.
All parts are done; only a live build/boot verification remains (no
network access in the sandbox that built this -- see AI_HANDOFF.md
"Next Task"). This entry covers both halves of the work; the mobile/
UX/placeholder-sweep changes are listed separately below under
"Added (Parts 5-8 continuation)" / "Fixed (Parts 5-8 continuation)".

### Added

- **`backend/app/models.py`**: `NotificationCategory` enum (13
  categories) and a new `Notification` table -- persisted per-user
  notifications for the Notification Center. Additive only; extends
  `User` with a `notifications` relationship. Distinct from the
  pre-existing `NotificationPreference` table, which only stores
  channel opt-in/opt-out settings, not actual notifications.
- **`backend/app/notification_helpers.py`** (new): shared
  `create_notification()` helper, importable by any router (invitations
  today; task/study reminders, member changes, etc. later) without a
  circular import against the notifications router.
- **`backend/app/routers/notifications.py`** (new): `GET /api/notifications`
  (filter by read state/category/search), `GET /counts`, mark
  read/unread, `POST /mark-all-read`, `DELETE /{id}` -- all scoped to
  the authenticated caller.
- **`backend/app/routers/project_invitations.py`**: real in-app
  notifications wired into the invitation lifecycle --
  create (notifies an existing-account invitee), accept (notifies the
  inviter + confirms to the new member), reject (notifies the inviter),
  cancel (notifies the invitee if they have an account). New
  `POST /{invitation_id}/resend` endpoint replaces the former
  "Coming Soon" UI placeholder: issues a fresh token, reopens
  expired/revoked invitations, restarts the expiry window, and
  re-notifies an existing-account invitee. No SMTP anywhere in this
  flow, per task brief.
- **`backend/app/schemas.py`**: `NotificationOut`/`NotificationCreate`/
  `NotificationCounts`, and `InvitationPreviewOut` (extends
  `ProjectInvitationOut` with resolved `project_name`/`project_icon`/
  `project_color`/`invited_by_name`/`role_name` for the public invite
  landing page -- an anonymous/not-yet-member invitee can't call the
  membership-gated `GET /api/projects/{id}`).
- **`frontend/src/pages/InvitationLanding.tsx`** (new): the
  `/invite/{token}` page. Validates the token, shows Project/Owner/
  Role/Status/Expiry, and Accept/Reject buttons. Handles pending
  (with an emailmismatch-in-review not fully implemented -- see Known
  Issues), accepted, rejected, expired, and revoked/invalid states.
  Unauthenticated visitors get a name field (new account, no
  password set -- see Known Issues) or a "Sign in first" link that
  round-trips through `/login`'s existing `location.state.from`
  pattern.
- **`frontend/src/pages/Notifications.tsx`** (new): the Notification
  Center. Read/unread/all tabs, category filter, search, mark-all-read,
  per-row mark read/unread/delete, inline Accept/Reject for
  `project_invitation` notifications.
- **`frontend/src/components/notifications/NotificationRow.tsx`**,
  **`frontend/src/components/dashboard/NotificationsWidget.tsx`**,
  **`frontend/src/hooks/useNotificationCenter.ts`**,
  **`frontend/src/lib/notificationMeta.ts`**,
  **`frontend/src/types/notifications.ts`** (all new).
- **Sidebar / MobileNav / TopBar**: Notifications nav item with a live
  unread-count badge (polls `/api/notifications/counts` every 30s).
  MobileNav now has 8 items -- tight on small screens; flagged for the
  Part 5 mobile pass.
- **`frontend/src/pages/Dashboard.tsx`**: mounted
  `NotificationsWidget` next to `AIWorkspaceWidget`.

### Fixed

- **`frontend/src/components/collaboration/InvitationRow.tsx` /
  `InvitationDetailsDialog.tsx`**: "Resend (coming soon)" placeholder
  removed and replaced with a real resend action. Raw invitation
  tokens are no longer shown in the UI (`InvitationDetailsDialog`
  used to display `invitation.token` directly); both now offer
  "Copy invite link" (the full `/invite/{token}` URL) instead.

### Added (Parts 5-8 continuation)

- **Invitation flow**: `InviteMemberDialog.tsx` no longer closes
  immediately after sending an invitation -- it now shows an inline
  success screen with the full `/invite/{token}` link and a Copy
  button, closing the real friction gap the no-SMTP flow left open
  (previously the owner had to close the dialog and find the row in
  the Invitations tab to get the link).
- **Mobile optimization pass** across the areas named in the task
  brief: fixed non-wrapping filter rows in `MemberList.tsx` and
  `pages/Notifications.tsx`; fixed three hard-coded `grid-cols-2`
  layouts with no mobile breakpoint (`ProjectSettingsGeneral.tsx`,
  `RoleFormDialog.tsx`); made `ProjectSettingsDangerZone.tsx`'s
  Archive/Delete cards stack vertically on mobile instead of cramming
  explanatory text against a button; aligned `RoleList.tsx`'s header
  row to the same responsive pattern already used by
  `MemberList.tsx`/`InvitationList.tsx`. `components/ui/dialog.tsx`
  and `MemberRow.tsx` were reviewed and left unchanged -- already
  solid from earlier sessions.
- **UX polish**: staggered entrance animation on the Notifications
  list (`framer-motion`); subtle zoom/fade-in entrance animation
  (via the existing `tailwindcss-animate` plugin) on all three
  unread-count badges (TopBar, Sidebar, MobileNav).
- **Placeholder sweep**: full grep of `frontend/src` for "Coming
  Soon"/`TODO`/"Not Implemented"/standalone "Placeholder" text --
  zero remaining matches outside the explicitly allowed categories
  (SMTP, Git Sync, Cloud Collaboration, Realtime Collaboration,
  Project Templates), none of which currently render as UI
  placeholders.

### Fixed (Parts 5-8 continuation)

- `InvitationLanding.tsx` and `NotificationRow.tsx`'s accept/reject
  actions now also invalidate the accepting user's own project
  members/invitations cache (previously only the notifications cache
  was invalidated), so a same-session Team tab view doesn't show
  stale membership data after accepting an invitation.

### Known Issues / Deferred

- An invitee who accepts anonymously (not signed in) gets a
  placeholder `User` row with no password (existing behavior of
  `get_or_create_user_by_email`, unchanged this session -- registration/
  auth for that path is still a future auth session's scope per
  `AI_HANDOFF.md`). The landing page explains this in the success
  state but doesn't solve it.
- `accept`/`reject` by token don't verify the accepting session's
  email matches `invitation.email` when the visitor is already signed
  in under a different account -- flagged in the UI, not enforced
  server-side. Pre-existing endpoint behavior, not introduced this
  session.
- No live push/websocket for badge updates -- relies on React Query's
  30s poll plus same-session cache invalidation; cross-session
  updates (e.g. the owner seeing an invitee's Accept in real time)
  can lag up to 30s. This is exactly what the explicitly-allowed
  "Realtime Collaboration" placeholder category would address; not
  attempted here.
- No live build/boot verification was possible in this sandbox (no
  network access across either half of this session) -- only static
  syntax/compile/import checks were run. See AI_HANDOFF.md "Next
  Task" for the exact steps owed before a real release.

Status: Audit-only session per the task brief -- no new features, no
architecture/database changes. Scope: full engineering review, genuine
findings fixed, documentation synchronized, project packaged as a
Version 1.0 Release Candidate.

### Fixed

- **`backend/app/main.py`**: `allow_credentials=True` on the wildcard
  (`allow_origins=["*"]`) CORS config was dead/unnecessary -- the app
  authenticates via a Bearer token in the `Authorization` header
  (`frontend/src/lib/api.ts`), never cookies, so no credentialed
  cross-site request is ever made. Combining a wildcard origin with
  `allow_credentials=True` is also a recognized CORS misconfiguration.
  Set to `False`; verified no frontend `fetch` call anywhere sets
  `credentials: "include"`.
- **`frontend/vite.config.js` / `vite.config.d.ts`**: stale compiled
  output of `vite.config.ts` (emitted by `tsconfig.node.json`, which
  has `vite.config.ts` in its `include`), accidentally left committed
  next to the source file. Deleted; added to `.gitignore` so they can't
  recur. Also removed committed `tsconfig.app.tsbuildinfo` /
  `tsconfig.node.tsbuildinfo` build caches.
- **`backend/uploads/`**: removed a stray 2-byte test-upload artifact
  (`2ad80ccb...zip`) left over from manual testing; replaced with a
  `.gitkeep` so the directory still exists on a fresh clone.

### Added

- **`.gitignore`** (project root) -- did not exist anywhere in the
  repository before this session. Covers Python/venv/`__pycache__`,
  the SQLite `dashboard.db`, `backend/uploads/*` (runtime user
  uploads), `node_modules`/`dist`, build-info caches, and `.env`
  files.
- **`README.md`**: was written before authentication or Project
  Collaboration existed and had drifted significantly out of sync --
  it still said "no auth/accounts" and listed only 3 of ~30 backend
  routers. Updated: Features list now documents Authentication and
  Project Collaboration, the Project Structure tree reflects the
  actual router/component layout, "Running it locally" now mentions
  registering an account, backend environment variables
  (`AUTH_SECRET_KEY`, token lifetimes) are documented, and "Known
  limitations" no longer contradicts the shipped feature set.

### Verification

- Read `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`,
  `ENGINEERING_GUIDELINES.md`, `SYNC_ARCHITECTURE.md`, `AI_HANDOFF.md`,
  `CHANGELOG.md` before any change, per the task brief.
- Confirmed via grep that `PROJECT_CONTEXT.md`/`ARCHITECTURE.md` were
  already kept in sync with Project Collaboration in prior sessions --
  only `README.md` (the GitHub-facing doc) had drifted.
- Confirmed via grep no `console.log`/`debugger` statements, no
  hardcoded secrets, and no `.env` files committed anywhere in
  `frontend/` or `backend/`.
- **Not possible in this sandbox** (no outbound network access, so
  `npm install`/`pip install` cannot run, and no `node_modules`/`venv`
  were present in the uploaded archive): live `npm run build`,
  `npx tsc --noEmit`, backend boot, or a browser click-through. See
  `AI_HANDOFF.md` "Known Issues" for what's already been statically
  verified in earlier sessions and what still needs a live run before
  tagging the real `v1.0.0`.

---

## [Unreleased] - Project Collaboration Frontend (Conversation 6)

Status: Full frontend for the Project Collaboration backend (Members,
Invitations, Roles, Permissions, Project Settings), built entirely
against the existing production backend -- no backend or database
changes. `tsc --noEmit` and `npm run build` both pass clean.

### Added

- **Types**: `frontend/src/types/collaboration.ts` -- `Permission`,
  `Role`, `ProjectMember`(+`WithUser`), `ProjectInvitation`,
  `ProjectCollaborationSummary`, and the `MemberStatus`/
  `InvitationStatus`/`ProjectVisibility`/`ProjectType` enums, mirroring
  `schemas.py` exactly. `types/index.ts`'s `Project`/`ProjectInput`
  gained `owner_id`, `visibility`, `collaboration_enabled`,
  `project_type`.
- **API layer** (`lib/api.ts`): full call surface for
  `routers/users.py` (read-only `getUsers`/`getUser`, used to resolve
  `user_id` -> displayable identity), `routers/permissions.py`,
  `routers/roles.py` (CRUD + add/remove permissions), 
  `routers/project_members.py` (list/summary/CRUD/transfer-ownership/
  leave), and `routers/project_invitations.py` (project-scoped
  create/list/cancel/expire + token-scoped get/accept/reject).
- **Hooks**: `useUsers`, `usePermissions`, `useRoles` (+ create/update/
  delete/add-permissions/remove-permissions mutations),
  `useProjectMembers` (+ CRUD/transfer-ownership/leave mutations and a
  `useCurrentMembership` helper that resolves the signed-in user's own
  role/effective-permissions for UI-hiding purposes only), and
  `useProjectInvitations` (+ create/cancel/expire mutations).
- **New `ui/` primitives**: `dropdown-menu.tsx`, `switch.tsx`,
  `avatar.tsx`, `alert-dialog.tsx`, `tooltip.tsx`, `checkbox.tsx` --
  same Radix-based pattern as the existing `select.tsx`/`dialog.tsx`.
  Added `@radix-ui/react-dropdown-menu`, `-switch`, `-avatar`,
  `-alert-dialog`, `-tooltip` to `package.json`. `App.tsx` now wraps
  the app in `TooltipProvider`.
- **`components/collaboration/`** (new directory): `RoleBadge`,
  `ConfirmDialog`, `MemberRow`/`MemberList`/`MemberProfileDialog`/
  `InviteMemberDialog`/`TransferOwnershipDialog`, `InvitationRow`/
  `InvitationList`/`InvitationDetailsDialog`, `RoleCard`/`RoleList`/
  `RoleFormDialog`/`RoleDetailsDialog`, `PermissionViewer`/
  `PermissionMatrix`/`PermissionsPanel`, `ProjectSettingsGeneral`/
  `ProjectSettingsDangerZone`/`ProjectSettings` (the six-tab General/
  Members/Invitations/Roles/Permissions/Danger-Zone settings surface).
- `lib/collaborationMeta.ts` -- status/visibility/type badge metadata,
  `initialsOf`/`titleCase` helpers, mirroring `lib/projectMeta.ts`.
- `pages/ProjectDetail.tsx`: header now shows Owner, member count, the
  signed-in user's own role badge, Visibility, Project Type,
  Collaboration on/off, pending-invitation count, and a Quick Invite
  button; a new "Team" tab renders the full `ProjectSettings` surface.

### Architecture notes

- All member/invitation/role mutations call the existing backend
  endpoints directly; the frontend never computes authorization
  itself. `useCurrentMembership`'s `hasPermission()`/`isAdmin`/
  `isOwner` only decide which buttons to *render* -- the backend's
  `require_permission`/`require_owner` dependencies are still the only
  enforcement, per the "never duplicate backend permission logic"
  rule.
- `ProjectMemberOut`/`ProjectInvitationOut` only carry `user_id`s, not
  embedded `User` objects, so the UI resolves identities client-side
  via a single `useUsers({ limit: 200 })` call per page and a `Map`
  lookup, rather than the backend embedding user data on every row.
- Hid Member Management inside a "Team" tab on `ProjectDetail` that
  renders the same `ProjectSettings` component the brief's standalone
  "Project Settings" section describes, instead of building two
  separate member-list implementations.

### Not Included (deferred to Conversation 7 per task scope)

- Dashboard integration (a "pending invitations" / "your projects by
  role" widget)
- Final UI polish pass, end-to-end QA, performance review
- Hackathon Hub, Git Sync, Realtime/Cloud Collaboration, Mobile App,
  Notifications redesign (explicitly out of scope)
- Actual invitation email sending (token/link is surfaced in-app only,
  matching the backend's own documented scope)
- "Resend invitation" is UI-only (disabled menu item) as specified

### Verification

- `npx tsc --noEmit -p tsconfig.app.json` -- clean, no errors.
- `npm run build` -- succeeds (pre-existing >500kB chunk-size warning
  only, not a new regression).
- Cross-checked every new `lib/api.ts` call against its router
  (`project_members.py`, `project_invitations.py`, `roles.py`,
  `permissions.py`, `users.py`) for exact path/query-param/body match,
  and against `main.py::_seed_collaboration_if_empty` for the seeded
  permission keys/system role names used in UI logic
  (`manage_members`, `invite_members`, `manage_roles`,
  Owner/Admin/Member/Viewer).
- **Not run**: manual click-through in a live browser (no running
  backend/frontend dev server in this sandbox) or Playwright/E2E.
  Recommend a manual pass through invite -> accept -> role change ->
  transfer ownership -> remove -> leave before shipping.

---

## [Unreleased] - Identity Integration Fix Pass (Conversation 5 follow-up)

Status: Small integration-fix pass only, exactly as scoped -- no new
features, no redesign, no Conversation 6 work. Fixes the one verified
gap between the Identity frontend and backend flagged at the end of
the Frontend Identity Layer session, then audits the rest of the
Identity frontend/backend contract for drift.

### Fixed

- **`schemas.UserOut` now exposes `email_verified: bool`.** Added to
  `backend/app/schemas.py`; since every Identity endpoint that returns
  a user (`/register`, `/login`, `/refresh`, `/me`, `/status`, every
  `/me/*` PATCH, `/email-verification/confirm`) already responds with
  `UserOut`/`TokenResponse`/`AuthStatusOut`, all of them now return the
  field with no per-endpoint changes needed.
- `frontend/src/types/auth.ts`: `User` gained `email_verified: boolean`;
  removed the comment explaining its prior absence.
- `frontend/src/pages/auth/VerifyEmail.tsx`: `StatusView` now shows a
  real "Your email address is verified" state (and hides the resend
  UI) when `user.email_verified` is true, instead of always offering
  to send a link. `ConfirmView` now calls `updateUser()` with the
  `email-verification/confirm` response so a freshly-verified user's
  local state updates immediately, without a page reload.
- `frontend/src/pages/Profile.tsx`: the Email card now shows a
  Verified/Unverified `Badge`, and hides the "Verify email" link once
  already verified.

### Integration Audit (no further issues found)

Cross-checked, endpoint by endpoint and field by field: `lib/api.ts`'s
Identity call table against every route in `routers/auth.py` /
`routers/sessions.py`; `types/auth.ts`'s request/response interfaces
against `schemas.py`'s `RegisterRequest`/`LoginRequest`/`TokenResponse`/
`UserOut`/`AuthStatusOut`/`SessionWithCurrentOut`/`ProfileUpdateRequest`/
`EmailUpdateRequest`/`DeactivateAccountRequest`/`ChangePasswordRequest`/
`PasswordResetRequestOut`/`EmailVerificationRequestOut`; `UserStatus`/
`AuthProviderType` enum values against `models.UserStatus`/
`models.AuthProvider`; `PasswordStrengthMeter.tsx`'s `REQUIRED_RULES`
against `security.py`'s `_PASSWORD_RULES`; and `AuthContext.tsx` /
`ProtectedRoute.tsx`'s login/register/refresh/logout wiring against
their backend calls. No missing fields, type mismatches, wrong paths,
or payload mismatches found beyond the one fixed above.

### Verification

- `python3 -m py_compile` on `schemas.py`, `models.py`,
  `routers/auth.py`, `routers/sessions.py` -- no syntax errors.
- **Not run** (no network/package access in this sandbox): live
  `uvicorn` boot + OpenAPI load, `npx tsc --noEmit`, `npm run build`.
  Recommend running these before shipping, per this project's own
  "verified live is not the same claim as has a regression suite"
  convention.

---

## [Unreleased] - Identity & Security: Frontend Identity Layer (Conversation 5)

Status: Frontend-only, exactly as scoped in the task brief -- no backend
or database changes. Builds the complete frontend Identity layer on top
of the already-production-ready backend from Session 3 ("Identity &
Security Backend", see the entry below). Member Management, Invitations,
Roles, Permissions UI, and Project Settings are explicitly out of scope
here -- deferred to Conversation 6 ("Project Collaboration frontend").

### Added -- Auth engine (`lib/authClient.ts`, `lib/api.ts`, `context/AuthContext.tsx`)

- `lib/authClient.ts`: token/session storage engine. Refresh tokens
  persist to `localStorage` (Remember Me on) or `sessionStorage`
  (Remember Me off); access tokens live in memory only, never written
  to any Storage. Also a tiny event bus (`onAuthExpired`,
  `onUserRefreshed`) so `lib/api.ts`'s interceptor (outside React) can
  tell `AuthContext` (inside React) about session state changes
  without a circular import between the two files.
- `lib/api.ts` (extended, not rewritten): `request()`/`requestForm()`
  now attach `Authorization: Bearer <token>` automatically, and a
  single-flight `refreshAccessToken()` transparently retries any 401
  once after rotating the refresh token, before giving up and emitting
  `authExpired`. Added the full Identity & Security API surface
  (register/login/logout/refresh/revoke, `/me` + sub-resource PATCHes,
  deactivate, change-password, password-reset request/confirm,
  email-verification request/confirm, sessions list/current/revoke/
  revoke-others/logout-all) as one new `api.*` section, mirroring every
  existing resource's call-table style.
- `context/AuthContext.tsx`: `AuthProvider` + `useAuth()`. Restores a
  session on mount from a persisted refresh token, proactively rotates
  the access token ~2 minutes before its 30-minute expiry (skew timer,
  not just reactive-to-401), and exposes `login`/`register`/`logout`/
  `updateUser`/`refresh`.

### Added -- Routing & guards

- `components/auth/ProtectedRoute.tsx`: gates the existing `AppLayout`
  route subtree; shows a loading shell while the session restores
  (never flashes the login page first), redirects to `/login` with the
  attempted path in `location.state.from` otherwise. Its inverse,
  `RedirectIfAuthenticated`, keeps a signed-in user off the login/
  register/forgot-password pages.
- `App.tsx` (extended): split into public Identity routes (`/login`,
  `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
  -- none inside `AppLayout`, all still route-level code-split) and the
  existing protected route tree, now wrapped once in `ProtectedRoute`.
  Added `/profile`.

### Added -- Pages (`pages/auth/*`, `pages/Profile.tsx`)

Login (with Remember Me), Register (with live password-strength
feedback), Forgot Password, Reset Password (token from the query
string), Verify Email (dual-mode: confirms a `?token=`, or shows
resend/status for a signed-in user), and Profile (profile fields,
email change, password change, active-sessions list with per-session
and "all other devices" revoke, deactivate account). All reuse the
existing `Card`/`Button`/`Input`/`Select`/`Dialog` primitives and the
dark glassmorphism theme -- no new design system introduced.

### Added -- Shared auth components (`components/auth/*`)

`AuthShell` (centered glass-panel shell for the standalone pages),
`PasswordInput` (show/hide toggle), `PasswordStrengthMeter` (mirrors
`security.py`'s `_PASSWORD_RULES` exactly, plus two advisory-only
extras), `FormAlert`, `AuthErrorState` (401/403/expired/invalid-token/
server-unavailable), `SessionRow`.

### Changed -- Nav integration

- `components/layout/Sidebar.tsx`: added an account footer (avatar,
  display name, link to `/profile`, sign-out button).
- `components/layout/TopBar.tsx`: added a profile avatar link (visible
  below the `md` breakpoint, since `Sidebar` is `hidden md:flex` and
  mobile has no other profile entry point -- `MobileNav`'s bottom bar
  was left untouched rather than adding an 8th icon to an already-full
  row).

### Known Issues

- ~~**`schemas.UserOut` never exposes `email_verified`.**~~ **Fixed** in
  the Identity Integration Fix pass (see the entry above this one) --
  `UserOut` now includes `email_verified: bool`, `types/auth.ts`'s
  `User` type carries it, and `pages/auth/VerifyEmail.tsx` /
  `pages/Profile.tsx` render a real Verified/Unverified state instead
  of the generic copy described below.
- Timezone/locale changes save via the same generic `PATCH /api/auth/me`
  as display name/avatar; there's no dedicated timezone/locale
  validation beyond the schema's `max_length`, so a free-typed value
  would round-trip even though the UI only offers a curated `<Select>`.
  Low risk (no free-text input exposed), noting for completeness.

### Testing completed

- `npx tsc --noEmit` -- passes, zero errors.
- `npm run build` -- production build succeeds (route-level chunks for
  every new auth page confirmed in the output).
- Live backend smoke test (`uvicorn` + `curl`, `AUTH_DEBUG_EXPOSE_TOKENS=true`):
  register, login, `/me` with and without a token (200 / 401), session
  list (`is_current` correct), and password-reset request (debug token
  returned) -- response shapes match `types/auth.ts` exactly, no drift
  from the backend's actual `schemas.py`.
- Not run in this session (no browser available in this environment):
  manual click-through of each flow, protected-route redirect behavior,
  proactive token refresh at the 28-minute mark, and mobile/tablet
  responsive layout. Flagging these explicitly rather than claiming
  coverage that wasn't exercised.

---

## [Unreleased] - Backend Stabilization & Security Audit

Status: Backend-only review/hardening session, exactly as scoped in the
task brief (no frontend, no architecture/database redesign, no new
features). Goal: make the backend genuinely production-ready for
frontend integration.

### Fixed -- RBAC gap in Project Workspace / AI Workspace routers

Session 3 ("Identity & Security Backend") wired authorization into the
collaboration routers (`project_members`, `project_invitations`,
`roles`, `permissions`) but never carried it into the routers that
actually serve a project's *content*. That content sits behind the
same membership/ownership boundary conceptually (and the `Permission`
catalog Session 3 seeded already defines the exact keys needed --
`view_tasks`/`manage_tasks`, `manage_documents`,
`view_ai_workspace`/`manage_ai_workspace` -- unused until now), but had
zero auth checks, and several `list` endpoints treated `project_id` as
an optional filter rather than a required scope, so any caller
(anonymous or authenticated) could enumerate or modify any project's
todos/milestones/phases/bugs/features/documents/resources/
conversations/handoffs/knowledge articles/zips/timeline.

- Added `auth_dependencies.require_project_access(db, user, project_id,
  permission_key=None)`: an inline counterpart to the existing
  `require_membership`/`require_permission` dependency factories, for
  routers whose `project_id` is a query param, body field, or only
  known after the target row is fetched (i.e. every Project Workspace
  content router -- none of them nest under
  `/api/projects/{project_id}/...`, so the path-param-reading `require_*`
  dependencies couldn't attach to them directly).
- Wired it into `todos.py`, `milestones.py`, `phases.py`, `bugs.py`,
  `features.py`, `documents.py`, `project_resources.py`,
  `conversations.py`, `ai_handoffs.py`, `knowledge_articles.py`,
  `project_zips.py`, and `timeline.py`. `analytics.py`'s
  `/projects/{project_id}` and `activity.py`'s `/projects/{project_id}`
  do have a real path param, so those use the existing
  `require_permission(...)` dependency directly instead.
- `conversations.py`, `ai_handoffs.py`, and `knowledge_articles.py`
  have a *nullable* `project_id` (they can be personal/unscoped AI
  Workspace items) -- the check only applies when `project_id` is
  actually set, matching every other personal-data router
  (`tasks.py`, `notes.py`, etc.) staying unauthenticated by design.
- List endpoints that filtered by an *optional* `project_id` now
  require it (`todos`, `milestones`, `phases`, `bugs`, `features`,
  `documents`, `project_resources`, `project_zips`, `timeline`) --
  previously omitting it silently returned every project's rows.
- `routers/search.py` (Global Search) and `routers/projects.py`'s own
  `/search` now filter every project-scoped result type down to
  projects the caller can access, via a new
  `project_helpers.get_accessible_project_ids(db, user_id)` helper.
  Personal/global result types (Task, Subject, Assignment, Note,
  AIAccount, PromptTemplate, unscoped Conversation/KnowledgeArticle/
  AIHandoff) are intentionally left unscoped, matching the rest of the
  app's single-user-data routers.

### Fixed -- `projects.py` itself was never wired for auth (root cause)

This was the more serious finding, discovered while testing the fix
above: `create_project` never set `Project.owner_id`, so the
collaboration/RBAC system Session 3 built (and everything above) had
no way to recognize a project's creator as its owner -- every project
was ownerless. Also fixed while in this file, since it directly blocks
the RBAC system from being usable at all:

- `create_project` now requires authentication and sets
  `owner_id = current_user.id` from the session, never from the
  request body.
- **Security fix:** `owner_id` was a client-settable field on both
  `ProjectCreate` and `ProjectUpdate` (inherited from `ProjectBase`,
  which is also `ProjectOut`'s base). Any caller with `manage_project`
  could have silently reassigned a project's ownership via a plain
  `PATCH /api/projects/{id}`, bypassing
  `project_members.transfer_ownership`'s dedicated, audited flow
  entirely. `owner_id` is now stripped from the payload in both
  `create_project` and `update_project`; ownership can only move
  through the existing transfer-ownership endpoint.
- `list_projects`, `get_project`, `get_project_summary`,
  `update_project` (`manage_project`), `delete_project` (owner-only),
  and `get_workspace_summary` are now scoped/gated to the caller
  (previously fully open, returning every project in the system to
  anyone).
- `serialize_project` built a hand-written response dict that silently
  dropped `owner_id`, `visibility`, `collaboration_enabled`, and
  `project_type` -- present on both `models.Project` and
  `schemas.ProjectOut`, but never copied over, so every API response
  reported them as schema defaults regardless of the real DB values.
  Fixed to pass all four through.

### Fixed -- unused imports

Confirmed via `pyflakes` (not guessed): removed unused imports from
`security.py`, `routers/ai_analytics.py`, `routers/auth.py`,
`routers/user_preferences.py`.

### Verified, unchanged

Full regression pass via `TestClient` against a clean DB: app boots,
OpenAPI still reports 139 paths / 221 operations (no routes lost or
duplicated), and 30+ targeted checks confirming: owners can create/read/
write their own project content; non-members get 403; anonymous callers
get 401; personal/unscoped data (`tasks`, `dashboard`, unscoped
conversations) remains open exactly as before; the pre-existing Session
3 routers (`roles`, `project_members`, `project_invitations`,
`permissions`, `auth` sessions) all still function correctly.

---

## [Unreleased] - Identity & Security: Backend Authentication + Authorization

Status: Backend-only session, exactly as scoped in the task brief.
Built the full Identity & Security layer on top of the previous
session's collaboration API: registration, login/logout, JWT access +
opaque rotating refresh tokens, session management, current-user
profile endpoints, password change/reset preparation, email
verification preparation, and reusable authorization middleware wired
into the existing collaboration routers. No frontend, no cloud sync, no
realtime, no OAuth/SSO/MFA -- all explicitly out of scope this session
(see AI_HANDOFF.md "Next Planned Modules").

### Added

- `backend/app/security.py` -- password hashing (bcrypt via passlib,
  timing-safe verify), extensible password-strength policy, JWT
  access-token issuance/decoding, opaque refresh-token generation +
  SHA-256 hashing for storage, password-reset/email-verification token
  generation.
- `backend/app/auth_dependencies.py` -- `get_current_user` /
  `get_current_user_optional` / `get_current_user_and_session`
  (authentication), plus `require_membership` / `require_role` /
  `require_permission` / `require_owner` / `require_admin`
  (authorization dependency factories), all delegating to the existing
  `project_helpers.py` RBAC functions. Denied checks log a
  `permission_denied` Activity Log entry.
- `backend/app/routers/auth.py` -- `POST /register`, `/logout`,
  `/refresh` (rotating), `/revoke`, `GET /me`, `GET
  /status`, `PATCH /me` (+ `/me/avatar`, `/me/display-name`,
  `/me/email`), `POST /me/deactivate`, `POST /change-password`, `POST
  /password-reset/request` + `/confirm`, `POST
  /email-verification/request` + `/confirm`.

- `backend/app/routers/sessions.py` -- `GET /api/auth/sessions` (list),
  `/current`, `DELETE /{session_id}`, `POST /revoke-others`, `POST
  /logout-all`.
- `_seed_collaboration_if_empty()`'s Session table now actively used:
  every login/register creates a real row; refresh rotates it; logout/
  revoke/change-password/deactivate/password-reset flip `revoked`.

### Extended (not replaced)

- `backend/app/models.py` -- `User` gained `email_verified` (bool),
  `email_verification_token`/`email_verification_expires_at`,
  `password_reset_token`/`password_reset_expires_at` (all additive,
  nullable, unique+indexed where they're tokens). `password_hash`,
  `auth_provider`, `external_auth_id`, and `Session` needed **no**
  schema change at all -- the previous session's "future-ready" columns
  were exactly right.
- `backend/app/schemas.py` -- added the full set of auth request/
  response models (`RegisterRequest`, `LoginRequest`, `TokenResponse`,
  `RefreshRequest`, `RevokeRequest`, `ChangePasswordRequest`,
  `PasswordResetRequest(Out)`, `PasswordResetConfirm`,
  `EmailVerificationRequestOut`, `EmailVerificationConfirm`,
  `AuthStatusOut`, `ProfileUpdateRequest`, `AvatarUpdateRequest`,
  `DisplayNameUpdateRequest`, `EmailUpdateRequest`,
  `DeactivateAccountRequest`, `SessionWithCurrentOut`).
- `backend/app/routers/project_members.py` -- list/get/summary now
  require active membership; add/update/remove now require the
  `manage_members` permission; `/transfer-ownership` now requires being
  the current Owner; `/leave` now requires the caller to be removing
  themselves (or, for an Admin/Owner, someone else on that member's
  behalf).
- `backend/app/routers/project_invitations.py` -- list now requires
  membership; create/cancel/expire now require the `invite_members`
  permission; `invited_by_user_id` is now always the authenticated
  caller (the request body's value, if any, is ignored). Token-scoped
  routes (`get`/`accept`/`reject` by token) intentionally left
  unauthenticated.
- `backend/app/routers/roles.py` / `permissions.py` -- mutations now
  require authentication; a project-scoped Role's mutations
  additionally require that project's Admin/Owner.
- `backend/requirements.txt` -- added `pyjwt`, `passlib[bcrypt]`,
  `bcrypt`.
- `backend/app/main.py` -- registers `auth.router` and
  `sessions.router` first among the collaboration layer, since the
  authorization dependencies used by every router after them resolve
  the current User from the tokens these two issue.

### Verified this session (live, not just static)

Booted the app with `TestClient` and ran, end-to-end: registration
(incl. duplicate-username/email and weak-password rejection), login
(incl. wrong-password/nonexistent-user/suspended/deactivated handling,
constant-time dummy-hash comparison), `/me`, `/status`
(authenticated + anonymous), refresh-token rotation (old token
correctly rejected after use), change-password (correctly revokes
every session), the full sessions API (list/current/revoke-one/
revoke-others/logout-all), and a full authorization matrix on a real
project (Owner can manage members/invitations/transfer ownership; a
`Member`-role user gets 403 on `manage_members`/`invite_members`
actions; a non-member gets 403 on read; an anonymous caller gets 401;
invitation accept-by-token still works unauthenticated). All 139
existing OpenAPI route paths (221 operations) still boot and respond
with zero regressions/500s.

---

## [Unreleased] - Collaboration Backend: API Layer

Status: Backend-API session, exactly as scoped in the task brief.
Built the full backend collaboration layer on top of the previous
session's database foundation: CRUD routers and reusable RBAC helper
functions for Project Members, Project Invitations, Roles, Permissions,
Users, User Preferences, Notification Preferences, and a filterable
Activity Log API. No authentication/JWT/login, no frontend -- all
explicitly out of scope this session (see AI_HANDOFF.md "Next Planned
Modules").

### Added

- `backend/app/routers/users.py` -- plain `User` CRUD (list/get/create/
  update/delete + `/summary`). Not an auth API -- no login, no password
  verification; exists because every router below needs a `User` row
  to reference.
- `backend/app/routers/permissions.py` -- list/get/lookup-by-key/
  validate (the required minimum) plus create/update/delete for
  catalog management.
- `backend/app/routers/roles.py` -- CRUD plus assign/remove
  permissions; protects the 4 system roles from rename/reassignment/
  deletion, and blocks deleting a role still assigned to members.
- `backend/app/routers/project_members.py` -- list/get/add/update
  (role and/or status)/remove, `/summary`
  (`ProjectCollaborationSummary`), `/transfer-ownership`, `/leave`.
  Blocks any change that would leave a project with zero active
  Owners.
- `backend/app/routers/project_invitations.py` -- project-scoped
  create/list/cancel/expire, plus token-scoped get/accept/reject under
  `/api/invitations/{token}`. Validates duplicate pending invitations
  and existing active membership before creating one; `accept`
  materializes the invitee's `User` row by email (still no auth) and
  creates/reactivates their `ProjectMember`.
- `backend/app/routers/user_preferences.py` /
  `backend/app/routers/notification_preferences.py` -- per-user CRUD,
  lazily auto-creating the row with column defaults on first GET.
- `backend/app/routers/activity.py` -- one fully-filterable query
  helper (project/user/action/entity/date-range/text search/sort/
  pagination) wrapped by general, per-project, and per-user GET
  endpoints. Read-only; the existing `log_activity` write path is
  unchanged.
- `_seed_collaboration_if_empty()` in `main.py` -- seeds an
  11-permission catalog and the 4 system roles (Owner/Admin/Member/
  Viewer) on first run, mirroring the existing `_seed_if_empty`/
  `_seed_study_hub_if_empty` pattern.

### Extended (not replaced)

- `project_helpers.py` -- added RBAC helpers (`get_project_owner`,
  `get_membership`, `is_member`, `is_owner`, `has_role`,
  `get_effective_permission_keys`, `has_permission`, `is_admin`,
  `can_invite`, `can_manage_members`, `can_manage_project`,
  `count_active_owners`, `get_or_create_user_by_email`) for reuse by
  the next session's authorization middleware.
- `activity_log.py` -- added `log_activity_event`, a sibling of the
  existing `log_activity` that also records `user_id`/`project_id`/
  `action`/`entity_type`/`entity_id`. The original `log_activity`
  signature and every existing call site are untouched.

### Known limitation this session

The sandbox this session ran in had no network access, so the app
could not be `pip install`-ed or booted live; verification was static
(syntax compilation + a scripted cross-check of every model/schema/
enum/column reference against their real definitions) plus a full
manual trace of the membership/ownership/invitation logic, not a live
`TestClient`/OpenAPI run. See AI_HANDOFF.md session 6 "Known Issues"
for detail -- the next session should boot the app first.

---

## [Unreleased] - Collaboration & Identity: Database Foundation

Status: Database-only session, exactly as scoped in the task brief.
Built the collaboration-ready database foundation described in
ARCHITECTURE.md's new "Project Collaboration Architecture" section:
models + schemas for Users, Roles, Permissions, Project Members,
Project Invitations, Sessions, User Preferences, and Notification
Preferences, plus additive extensions to Project and ActivityLog. No
routers, no auth endpoints, no frontend, no dashboard integration --
all explicitly out of scope this session (see AI_HANDOFF.md "Next
Planned Modules").

### Added

- `models.py` -- 8 new tables (`User`, `Permission`, `Role`,
  `ProjectMember`, `ProjectInvitation`, `Session`, `UserPreference`,
  `NotificationPreference`) plus 5 new enums (`ProjectVisibility`,
  `ProjectType`, `UserStatus`, `AuthProvider`, `MemberStatus`,
  `InvitationStatus`). Follows the exact conventions established by
  Project Workspace/AI Workspace: `gen_id()` string UUID PKs,
  JSON-encoded Text columns for lists/dicts, `ondelete=` paired with
  ORM `cascade="all, delete-orphan"` only where a child is truly owned.
- `schemas.py` -- matching `Base`/`Create`/`Update`/`Out` schemas for
  every new table, plus `UserSummary`, `ProjectCollaborationSummary`
  (rollups, not yet wired to a router) and `UserValidation` (future Git
  Sync import validation, matching `AIAccountValidation`'s role).
  `UserOut`/`SessionOut` deliberately never expose
  `password_hash`/`refresh_token_hash`.

### Extended (not replaced)

- `Project` -- added `owner_id`, `visibility`, `collaboration_enabled`,
  `project_type`. All nullable/defaulted; every pre-existing Project
  row remains valid unchanged.
- `ActivityLog` -- added optional `user_id`, `project_id`, `action`,
  `entity_type`, `entity_id`. `log_activity(db, message, icon)` and
  `routers/tasks.py`'s local copy of it keep compiling and keep writing
  valid rows unchanged.

### Architectural Decision

No `RolePermission` join table was added (not in the requested model
list). `Role.permission_keys` is a JSON-encoded `list[str]` of
`Permission.key` values instead -- identical in shape/intent to how
`Project.tags`/`AIHandoff.created_files` already store small lists in
this codebase. `Permission` itself remains a real, seedable catalog
table. See ARCHITECTURE.md "Role-Based Access Control (RBAC)" for the
full rationale.

### Verified

- `Base.metadata.create_all()` against a real SQLite engine builds all
  33 tables cleanly (existing 25 + 8 new).
- FastAPI boots unchanged: 162 routes, `/api/dashboard` and
  `/openapi.json` both return 200, before and after this session's
  changes.
- Full CRUD + cascade round-trip against a real (in-memory) SQLite
  engine: Project deletion cascades ProjectMember/ProjectInvitation and
  un-scopes (not deletes) ActivityLog rows; User deletion cascades
  ProjectMember/Session/UserPreference/NotificationPreference and
  un-scopes owned Projects. Re-verified after adding the
  `ActivityLog.project` <-> `Project.activity_log_entries` relationship
  pair (initially missing, which silently left `project_id` un-nulled
  on project deletion -- caught by the cascade test, not assumed).
- `schemas.py` validators exercised directly: `UserCreate` rejects a
  short/plaintext-looking `password_hash`; `RoleCreate.permission_keys`
  correctly trims/drops blank entries via the shared `_clean_str_list`.

### Modified Files

- `backend/app/models.py`
- `backend/app/schemas.py`
- `ARCHITECTURE.md`
- `DATABASE_SCHEMA.md`
- `PROJECT_CONTEXT.md`
- `AI_HANDOFF.md`

### Not Done This Session (by design, per task brief)

- Authentication APIs, JWT, OAuth, login/registration endpoints
- Authorization middleware / permission-check service
- `RolePermission`-style router or seed script for the 4 default roles
  + permission catalog (data/router concern, not schema)
- Invitation email sending
- Frontend, member management UI, invitation UI
- Cloud database, realtime collaboration, Hackathon module, Git Sync

---

## [Unreleased] - AI Workspace: Token Refresh Reminders, Favorites, Verification Pass

Status: This session found the AI Workspace frontend (all 9 views) already
built, undocumented by a prior session (no matching changelog entry existed).
Rather than assume it was "complete" per the task brief, it was verified
against the running backend before anything else was touched. No existing
component was rewritten; changes are additive.

### Added

- `lib/aiWorkspaceMeta.ts` -- client-side "token refresh reminder" storage
  (`getTokenRefreshReminder`/`setTokenRefreshReminder`/
  `getAllTokenRefreshReminders`), same localStorage convention as the
  existing default-account preference. Necessary because `TokenTracker` has
  no `refresh_time`/`status` column (see `token_trackers.py`'s docstring) --
  this is a reminder the *user* sets, never presented as a real
  provider-side reading.
- `components/ai-workspace/TokenRefreshCountdown.tsx` -- per-account live
  countdown badge, reminder dialog, and "Limited"/"Refreshed" quick actions.
  Wires up `useAccountTokenTotal`, `useMarkAccountTokenLimited`, and
  `useMarkAccountTokenRefreshed` from `useTokenTrackers.ts`, all of which
  existed in a previous session but had no UI calling them. Mounted on
  every card in `AIAccountsView`.
- `hooks/useTokenRefreshScheduler.ts` -- polls reminders and fires "expiring
  soon" / "reminder reached" browser notifications, mirroring
  `useNotificationScheduler.ts`'s task-deadline pattern exactly (same
  interval, same localStorage-log dedupe strategy) instead of introducing a
  second notification mechanism. Mounted in `AppLayout` alongside the
  existing scheduler.
- `PromptLibraryView.tsx` -- one-click favorite star on each prompt card
  (previously favoriting only worked through the full edit-dialog
  checkbox, with no confirmation), with a distinct "Added/Removed from
  favorites" toast.

### Verified (no code changes)

- Backend boots (162 routes) and a live `TestClient` round-trip of
  AI account creation, global search, token usage recording,
  mark-limited/mark-refreshed, and prompt favoriting all pass.
- `tsc -b`, `eslint .`, and `vite build` all pass clean across the whole
  frontend (pre-existing `react-refresh/only-export-components` warnings in
  3 unrelated shared-UI files and `NotificationContext.tsx` were left
  alone, per scope -- see Known Issues in `AI_HANDOFF.md`).
- Global Search: all 6 AI Workspace entity types resolve to a valid route
  (including `conversations/:conversationId`, which `ConversationsView`
  already handles); labels present for every type in `GlobalSearch.tsx`.
  Note: `GlobalSearch` doesn't render per-type icons for *any* entity
  (existing tasks/projects included), so AI Workspace isn't a regression
  here -- flagged as a pre-existing gap, not fixed, since it's a
  cross-cutting shared-UI change outside this session's scope.
- `AIWorkspaceWidget` (dashboard) already hides itself gracefully when
  there's no AI Workspace data; loading/empty states already present
  across all 9 views.

### Not done this session (see AI_HANDOFF.md)

- "Last limit reached" display (Part 1) -- there's no persisted
  timestamp for it; would require either a new column or reading it
  back out of `ActivityLog` by account, which wasn't scoped/verified
  this session.
- Notification coverage for "Conversation unfinished" / "Missing AI
  handoff" -- not implemented; would need a definition of "unfinished"
  (e.g. active conversations idle > N days) that isn't specified anywhere
  in the existing schema or docs.
- Per-account notification settings (enable/disable which of the above
  fire) -- there's a single global browser-permission toggle today, no
  per-account granularity.
- Full accessibility/keyboard-shortcut audit, exhaustive dead-code sweep
  beyond the token-tracker hooks found unused, and a packaged release ZIP
  -- out of scope for the time available this session.

---

## [Unreleased] - AI Workspace: Backend Routers

Status: Full CRUD API for the AI Workspace, built on the previous
session's models + schemas (see the entry below) -- no model, schema,
or existing router was rewritten. No frontend work this session (out
of scope per task brief).

### Added

New Routers (`backend/app/routers/`)

- `ai_accounts.py` -- AIAccount CRUD; filter by provider/status;
  search; sort; pagination; `/summary` and `/{id}/summary`
  (`AIAccountSummary`); `POST /{id}/touch` as a last-used stand-in (no
  `last_used_at`/`is_default` column exists -- see Not Included)
- `conversations.py` -- Conversation CRUD; filter by account/project/
  status; search; sort; pagination; `/{id}/summary`
  (`ConversationSummary`); `clear_project` flag; ActivityLog +
  TimelineEvent on start / status->completed
- `prompt_templates.py` -- PromptTemplate CRUD; category/favorites
  filtering (via `category` value); search; `/recent`, `/categories`,
  duplicate, and usage-count-increment endpoints
- `project_zips.py` -- ProjectZip metadata CRUD plus the file
  lifecycle (`/upload`, `/{id}/replace`, delete), reusing `uploads.py`
  exactly as `project_resources.py` does; `/current?project_id=`
- `ai_handoffs.py` -- AIHandoff CRUD; search; `/latest` scoped by
  project/account/conversation; ActivityLog + TimelineEvent on create
- `token_trackers.py` -- TokenTracker CRUD for the usage-log shape
  Conversation 1 actually modeled; `/summary` and
  `/accounts/{id}/total` rollups; best-effort mark-limited/
  mark-refreshed ActivityLog events (see Not Included)
- `knowledge_articles.py` -- KnowledgeArticle CRUD; project/category/
  source/tag filtering; pinned/favorites via `category` value; search;
  ActivityLog + TimelineEvent on create
- `ai_analytics.py` -- `GET /api/ai-analytics/summary` wires up
  `AIWorkspaceSummary`; plus conversations-per-project,
  conversations-per-provider, prompt-categories, zip-upload-count,
  knowledge-articles, provider-usage, conversation-status, and
  token-limits-reached breakdown endpoints

Changed (`backend/app/routers/search.py`) -- additive only

- Global Search now also spans AI accounts, conversations, prompt
  templates, knowledge articles, project zips, and AI handoffs; every
  existing search entry (Tasks, Study Hub, Project Workspace) is
  untouched

`backend/app/main.py`

- Registers all 8 new routers, after Project Workspace's routers and
  before `search`/`dashboard` (unchanged rationale: `dashboard`
  depends on helpers registered earlier; `ai_analytics` lazily imports
  sibling serializers to avoid a circular import, the same pattern
  `projects.py` uses)

### Not Included (by design -- see task scope and AI_HANDOFF.md Known Issues)

- A persisted token-limit/refresh/notify *settings* shape -- the task
  brief described `TokenTracker` as account-level settings
  (`enabled`/`limit_reached`/`refresh_time`/`notify_enabled`/
  `notify_offset`/`status`), but Conversation 1 modeled it as an
  append-only usage log instead. Implementing the settings shape would
  require new columns/tables, out of scope for a "DO NOT redesign the
  database" session; flagged as a follow-up in AI_HANDOFF.md instead
  of silently reinterpreting the schema.
- `is_default`/`last_used_at` on `AIAccount`, a conversation-numbering
  column -- same reasoning; see AI_HANDOFF.md Known Issues.
- Dashboard integration, frontend
- Live `TestClient`/SQLite execution -- this session's container had
  no network access to install `fastapi`/`sqlalchemy`/`pydantic`, so
  verification was static (`py_compile`, `ast.parse`, manual field-by-
  field cross-checks against `models.py`/`schemas.py`) rather than
  executed. Flagged prominently in AI_HANDOFF.md as the first thing
  the next session (or the user) should do.

---

## [Unreleased] - AI Workspace: Backend Foundation

Status: Database models + schemas only, for the AI Workspace module
(the generalized, multi-provider evolution of the "Claude Workspace"
sketched in PROJECT_CONTEXT.md/ARCHITECTURE.md). No routers, no
frontend, no dashboard integration yet -- following the exact same
"models + schemas first" shape as the very first Project Workspace
session. No existing file's behavior was rewritten: `models.py` and
`schemas.py` were purely extended (one new relationship block added to
the existing `Project` class, everything else is new code appended at
the end of each file); every existing table, enum, schema, and router
is untouched.

### Added

Database Models (`backend/app/models.py`)

- `AIAccount` -- a configured AI assistant (Claude, GPT, Gemini, ...).
  Never stores an actual API key, only the name of the environment
  variable holding it (`api_key_env_var`), per PROJECT_CONTEXT.md's
  "Never expose secrets" / "Never hardcode tokens" rules
- `Conversation` -- a chat/session with an AIAccount, optionally
  scoped to a Project
- `PromptTemplate` -- reusable prompt text, intentionally not scoped
  to any project or account
- `ProjectZip` -- a point-in-time zip snapshot of a project handed off
  to/from an AI account or conversation; mirrors ProjectResource's
  file-storage shape so `uploads.py` can be reused unchanged by a
  future router
- `AIHandoff` -- structured session handoff notes; the database-backed
  analogue of this repo's own AI_HANDOFF.md, one row per handoff
- `TokenTracker` -- append-only token usage log per account/
  conversation, for future cost/usage analytics
- `KnowledgeArticle` -- durable markdown reference notes, optionally
  scoped to a project; mirrors ProjectDocument's shape
- New enums: `AIProvider`, `AIAccountStatus`, `ConversationStatus`,
  `KnowledgeSource`
- New relationships on the existing `Project` model (additive):
  `ai_zips` (owned, `cascade="all, delete-orphan"`, since a zip is a
  snapshot *of* that project) and `ai_conversations`/`ai_handoffs`/
  `knowledge_articles` (associated via `ON DELETE SET NULL`, no
  cascade, since a conversation/handoff/knowledge article can outlive
  or span more than one project) -- deliberately mirrors how
  `ProjectPhase` relates to `Feature`/`ProjectTodo`/`Bug`/`Milestone`
- Indexes on every FK column plus the columns most likely to be
  filtered/sorted on (status, provider, category, source, started_at,
  recorded_at, created_at), matching the Project Workspace precedent

Pydantic Schemas (`backend/app/schemas.py`)

- `Create` / `Update` / `Out` schemas for all 7 new models, following
  the existing Base/Create/Update/Out convention
- `AIAccountSummary` and `ConversationSummary` (per-entity rollups,
  same role as `ProjectSummary`); `AIWorkspaceSummary` (top-level
  aggregate, same role as `ProjectWorkspaceSummary`) -- defined but
  not yet wired to a router
- A `*Validation` schema for every model (`AIAccountValidation`,
  `ConversationValidation`, `PromptTemplateValidation`,
  `ProjectZipValidation`, `AIHandoffValidation`,
  `TokenTrackerValidation`, `KnowledgeArticleValidation`), capturing
  the full persisted shape (including `id`) for the future Git Sync
  Import Engine (SYNC_ARCHITECTURE.md) to validate exported JSON
  before writing it back into SQLite -- not wired to any router today
- `field_validator`-based checks: `api_key_env_var` is rejected if it
  looks like a real pasted-in secret rather than an environment
  variable name; JSON-encoded-list fields (`tags`, `variables`,
  `created_files`, `modified_files`) are normalized (trimmed, empties
  dropped) via a shared `_clean_str_list` helper
- `TokenUsageSummary`/`TokenTrackerAccountTotal` -- aggregate token
  spend rollup, same role as `StudyAnalytics` but for token usage

### Changed

- `DATABASE_SCHEMA.md` -- replaced the old "Future Claude Workspace"
  sketch with full field tables, relationships, and cascade
  documentation for the 7 new tables; updated the Database Overview
  tree, Long-Term Database Vision tree, Index Recommendations, and
  Cascade Rules sections
- `AI_HANDOFF.md` -- updated session summary, current module status,
  and next task

### Notes

- No `PRAGMA foreign_keys=ON` is set anywhere in this app (unchanged),
  so cascade/orphan behavior is implemented at the SQLAlchemy ORM
  level, not the SQLite level -- same caveat as Project Workspace.
  Verified end-to-end against a real (in-memory) SQLite database
  before considering the models complete: deleting an `AIAccount`
  cascades to its `Conversation`/`TokenTracker` rows but only orphans
  (`SET NULL`, not deletes) its `ProjectZip`/`AIHandoff` rows; deleting
  a `Project` cascades to its `ProjectZip` rows but only orphans its
  `Conversation`/`AIHandoff`/`KnowledgeArticle` rows.
- `Project.ai_zips` is the only new relationship added to the existing
  `Project` model, not `Project.zips`, to avoid any risk of colliding
  with a same-named attribute a future Git Sync Engine or other module
  might want to add later.
- `PromptTemplate.variables` / `AIHandoff.created_files` /
  `AIHandoff.modified_files` / `KnowledgeArticle.tags` are stored as
  JSON-encoded text in the database but exposed as `List[str]` in
  their `*Out` schemas, matching the existing `Project.tags` /
  `Assignment.attachments` convention.
- All 7 new models and all new schemas were exercised against a real
  SQLite engine and real Pydantic validation (not just read for
  syntax) before this entry was written -- see AI_HANDOFF.md's
  Session Summary for the specific checks run.

### Not Included (by design -- see task scope)

- API routers (`backend/app/routers/ai_accounts.py` etc.)
- Frontend pages/components/hooks
- Dashboard widget integration
- Timeline/ActivityLog auto-logging wiring for AI Workspace events
- Any actual API call to a real AI provider (this module tracks/
  organizes AI work, it doesn't make AI calls itself)

---

## [Unreleased] - Project Workspace: Kanban, Drag-and-Drop, Global Search, Polish

Status: Project Workspace was already complete end-to-end (see the two
entries below). This session picked up the "Optional polish" items
AI_HANDOFF.md left open, plus a new Global Search module, and closed
out the one outstanding build warning. No existing file's behavior was
rewritten; all changes are additive or scoped to the files below.

### Added

- **Kanban board for Project Todos** (`components/project-workspace/TodoBoard.tsx`)
  — a To do / In progress / Done column view, added as a second view
  alongside the existing filterable list (`TodoList.tsx` now has a
  List/Board toggle), not a replacement. Uses native HTML5
  drag-and-drop (no new dependency) to change status by dragging a
  card between columns, calling the same `useUpdateProjectTodo`
  mutation the list view already uses. Every card also has a
  keyboard-and-screen-reader-operable "Move to…" `<select>`, since
  native drag alone isn't reachable without a pointer.
- **Drag-to-reorder Roadmap phases** (`RoadmapView.tsx`) — phases can
  now be dragged by a grip handle to reorder, using
  `framer-motion`'s `Reorder.Group`/`Reorder.Item` (already a
  dependency, so no new one added) and persisted through the
  `/api/phases/reorder` endpoint that already existed on the backend
  for this purpose. The existing up/down buttons are kept as a fully
  equivalent non-pointer way to reorder, not a fallback bolted on
  after the fact.
- **Global Search** (`Ctrl/Cmd+K`) — a new command-palette component
  (`components/layout/GlobalSearch.tsx`) wired into `TopBar`, backed
  by a new backend endpoint `GET /api/search?q=` (`routers/search.py`)
  that spans Tasks, Study Hub, and Project Workspace in one ranked,
  navigable list. This is additive: the existing scoped searches
  (`/api/study-hub/search`, `/api/projects/search`) are untouched and
  still power their own module's in-page search; the new endpoint
  reuses the same `ilike` query pattern rather than introducing new
  filtering logic.
- **Route-level code-splitting** (`App.tsx`) — every page is now
  `React.lazy`-loaded behind a `Suspense` boundary with a skeleton
  fallback, closing out the "single large chunk" build warning noted
  in the previous session (`vite build` no longer emits a chunk-size
  warning; the largest chunk is 486 KB, down from one ~1.1 MB chunk).
- **App-level error boundary** (`components/ErrorBoundary.tsx`) — a
  render-time error anywhere in the tree now shows a themed recovery
  screen instead of a blank white page. Previously there was no error
  boundary anywhere in the app.
- Missing `.eslintrc.cjs` added to the frontend — `npm run lint` was
  defined in `package.json` and all the ESLint dependencies were
  installed, but no config file existed, so the script silently
  failed. Running it now surfaces 0 errors, 4 pre-existing warnings
  (all the standard shadcn "component + variant helper in one file"
  pattern, left as-is).

### Fixed

- `backend/app/routers/tasks.py` — removed an unused `sqlalchemy.desc`
  import (found via `pyflakes`).

### Known issues / recommendations

See `AI_HANDOFF.md` Known Issues for the current list (CORS wildcard,
unused `ui/badge.tsx` primitive, recharts chunk size, no automated
tests, no live-browser manual QA this session).

---

## [Unreleased] - Project Workspace: Frontend

Status: Full frontend for the Project Workspace, consuming the backend
routers from the previous session (see the entry below) with zero
backend changes. No existing file's behavior was rewritten -- Study
Hub, Tasks, and Timetable code paths are untouched.

### Added

New Hooks (`frontend/src/hooks/`)

- `useProjects.ts` -- projects list/get/summary, workspace summary,
  cross-entity search, create/update/delete. Mutations invalidate the
  project list, the workspace summary, and the main dashboard query
  (mirrors `useSubjects.ts`'s invalidation cascade)
- `usePhases.ts`, `useFeatures.ts`, `useProjectTodos.ts`, `useBugs.ts`,
  `useMilestones.ts` -- CRUD hooks for each entity; each invalidates
  its own list plus every ancestor (phase -> project -> workspace
  summary -> dashboard), matching the nested invalidation pattern
  already used for Topics -> Subjects -> StudyHub summary
- `useProjectDocuments.ts`, `useProjectResources.ts` -- CRUD +
  upload hooks, mirroring `useResources.ts`'s upload mutation shape
- `useTimeline.ts` -- read + manual-entry hooks for TimelineEvent
- `useProjectAnalytics.ts` -- per-project and workspace-wide analytics

New Library Helpers (`frontend/src/lib/`)

- `projectMeta.ts` -- status/priority/severity metadata (label, badge
  color classes, dot color) for Project/Phase/Feature/Bug status
  enums and Priority/BugSeverity, the same shape as `CATEGORY_META` in
  `urgency.ts`, plus derived `*_OPTIONS` arrays for `<Select>` menus

New Components (`frontend/src/components/project-workspace/`)

- `StatusBadge.tsx`, `ProjectIcon.tsx` -- shared primitives
- `ProjectForm.tsx`, `ProjectCard.tsx` -- Project Dashboard grid card
  + create/edit form (icon picker, color tag reusing
  `SUBJECT_COLORS`, status, repo URL, tags)
- `PhaseForm.tsx`, `RoadmapView.tsx` -- vertical phase timeline with
  up/down reordering (calls `POST /api/phases/reorder`)
- `FeatureForm.tsx`, `FeatureCard.tsx`, `FeatureList.tsx`
- `TodoForm.tsx`, `TodoCard.tsx`, `TodoList.tsx` -- mirrors
  `TaskForm`/`TaskCard`/`TaskList` exactly, including `UrgencyRing`/
  `UrgencyBadge` reuse and live urgency preview in the form
- `BugForm.tsx`, `BugCard.tsx`, `BugList.tsx`
- `MilestoneForm.tsx`, `MilestoneCard.tsx`, `MilestoneList.tsx`
- `DocumentList.tsx` -- sidebar + markdown editor/preview for Project
  Documents, reusing `lib/markdown.ts`'s `renderMarkdownLite`
- `ProjectResourceForm.tsx`, `ProjectResourceCard.tsx`,
  `ProjectResourceList.tsx` -- upload-or-link form mirroring
  `ResourceForm`/`ResourceCard`/`ResourceList`, pointed at
  `/api/project-resources` instead of `/api/resources`
- `ProjectTimeline.tsx` -- read-only feed reusing the real icon
  strings the backend logs (`plus-circle`, `check-circle`, `bug`,
  `flag`, `list-tree`, etc.)
- `ProjectAnalyticsView.tsx` -- velocity line chart + bugs-by-severity
  and features-by-status bar charts, mirroring `StudyAnalytics.tsx`
- `ProjectSearch.tsx` -- cross-entity search dropdown, mirrors
  `StudyHubSearch.tsx`

New Pages (`frontend/src/pages/`)

- `Projects.tsx` -- Project Dashboard: search bar, project grid,
  create dialog. Mirrors `StudyHub.tsx` structurally
- `ProjectDetail.tsx` -- Project Detail: header (progress ring, status
  badge, todo/bug/milestone counts) + a single `<Tabs>` block with
  **Overview, Roadmap, Features, Todos, Bugs, Milestones,
  Documentation, Resources, Timeline, Analytics**. Mirrors
  `SubjectDetail.tsx`'s tab structure. See "Design decision" below.

New Dashboard Widgets (`frontend/src/components/dashboard/`)

- `CurrentProjectWidget.tsx` -- the most recently updated active
  (or, if none active, most recently updated) project
- `CurrentPhaseWidget.tsx` -- that project's current (`in_progress`,
  else next `pending`) phase, fetched client-side via `usePhases`
- `UpcomingMilestonesWidget.tsx` -- from `dashboard.upcoming_milestones`
- `OpenBugsWidget.tsx` -- top 5 open bugs workspace-wide, sorted by
  severity via `useBugs({ status: "open", sortBy: "severity" })`
- `ProjectsProgressWidget.tsx` -- horizontal-scroll progress rings,
  mirrors `SubjectsProgressWidget.tsx`
- `ProjectTimelineWidget.tsx` -- recent cross-project activity,
  mirrors `RecentActivity.tsx`, from `dashboard.recent_project_timeline`

### Changed

- `frontend/src/types/index.ts` -- added every Project Workspace type
  (Project, ProjectPhase, Feature, ProjectTodo, Bug, Milestone,
  ProjectResource, ProjectDocument, TimelineEvent, plus summary/
  analytics/search response shapes) and extended `DashboardData` with
  `projects_progress`, `upcoming_milestones`, `overdue_project_todos`,
  `recent_project_timeline`
- `frontend/src/lib/api.ts` -- added methods for all 10 Project
  Workspace routers, additive only
- `frontend/src/pages/Dashboard.tsx` -- added a `hasProjectData` gate
  (mirrors the existing `hasStudyHubData` gate) so the six new
  widgets only render once there's a project to show; renders nothing
  extra for a fresh install with no projects yet
- `frontend/src/App.tsx` -- registered `/projects` and
  `/projects/:projectId` routes
- `frontend/src/components/layout/Sidebar.tsx`,
  `MobileNav.tsx` -- added a "Projects" nav item (`FolderKanban` icon)
- `frontend/src/components/layout/TopBar.tsx` -- added the `/projects`
  title/subtitle entry

### Design decision

The task listed Roadmap, Documentation, Milestones, Features, Todos,
Bug Tracker, Resources, Timeline, and Analytics as separate "pages."
Rather than creating 9 additional top-level routes, these were built
as **tabs inside `ProjectDetail.tsx`**, exactly matching the existing
`SubjectDetail.tsx` precedent (Overview/Assignments/Notes/Resources/
Sessions tabs under one Subject Detail route). This keeps navigation
consistent with the rest of the app and avoids a parallel routing
structure with a different shape. `Projects.tsx` is the Project
Dashboard; `ProjectDetail.tsx` (with its ten tabs) covers the rest.

### Verified

- `npx tsc -b` -- zero type errors across the full project
- `npx vite build` -- production build succeeds (single warning about
  chunk size >500kB, pre-existing and unrelated to this session's
  code; not a build error)
- Responsive layout: every new page/list/widget reuses the project's
  existing responsive grid conventions (`grid-cols-1 sm:grid-cols-2
  lg:grid-cols-3`, `flex-col sm:flex-row`) rather than introducing new
  breakpoint patterns

### Not done (see AI_HANDOFF.md)

- No backend changes were made or needed
- Drag-and-drop phase reordering was intentionally built with simple
  up/down buttons instead of a DnD library, to avoid adding a new
  dependency for a single view
- No dedicated document-version-history UI (the backend doesn't track
  document revisions)

---

## [Unreleased] - Project Workspace: Backend Routers

Status: Full backend API for the Project Workspace. Builds on the
previous session's models + schemas (see the entry below) -- no model,
schema, or existing router/file was rewritten. No frontend work in
this session (out of scope, see AI_HANDOFF.md).

### Added

New Routers (`backend/app/routers/`)

- `projects.py` -- Project CRUD; filtering (status/archived/tag);
  search (`q` over name/description); sorting (name/created_at/
  updated_at/progress); pagination (`limit`/`offset`); per-project
  rollup (`GET /api/projects/{id}/summary`); workspace-wide rollup
  (`GET /api/projects/summary` -> `ProjectWorkspaceSummary`); cross-
  entity search (`GET /api/projects/search` -> spans Projects, Todos,
  Features, Bugs, Documents, Resources)
- `phases.py` -- Phase CRUD; filtering by project/status; bulk
  reordering (`POST /api/phases/reorder`); per-phase rollup
  (`GET /api/phases/{id}/summary`)
- `features.py` -- Feature CRUD; urgency computed via the existing
  Smart Urgency Engine (`urgency.compute_urgency`, no-deadline branch,
  exactly as the schema/model docstrings anticipated); filtering
  (project/phase/status/priority); search; sorting; pagination; phase
  title denormalized onto `FeatureOut`
- `todos.py` -- Project Todo CRUD; full urgency computation (has a
  deadline, same as Task/Assignment); `clear_deadline`/`clear_phase`/
  `clear_feature` convenience flags; progress/status sync (100% ->
  done, done -> 100%) mirroring `tasks.py`; filtering (project/phase/
  feature/status/overdue_only); search; sorting; pagination; phase and
  feature titles denormalized onto `ProjectTodoOut`
- `bugs.py` -- Bug CRUD; `resolved_at` auto-set/cleared on status
  transition to/from `resolved`, mirroring the `completed_at` pattern;
  filtering (project/phase/feature/severity/status); search; sorting
- `milestones.py` -- Milestone CRUD; `complete_now` convenience flag
  (mirrors `StudySessionUpdate.complete_now`); filtering (project/
  phase/completed); search; sorting by target_date (nulls-last)
- `documents.py` -- Project Document CRUD; title/content search;
  ordered listing by `order_index`, mirroring `notes.py`/`topics`
- `project_resources.py` -- Project Resource CRUD (link + file
  upload), reusing `uploads.py` (`save_upload`/`delete_upload`/
  `infer_resource_type`) exactly as the Study Hub's `resources.py`
  does. **Named `project_resources.py` rather than `resources.py`**
  because `backend/app/routers/resources.py` already exists (the
  complete, working Study Hub resource library) -- per the "never
  rewrite/overwrite existing working functionality" rule, this module
  gets its own name and its own prefix (`/api/project-resources`)
  instead of colliding with it. See AI_HANDOFF.md for the full note.
- `timeline.py` -- TimelineEvent list/get/create (manual entries)/
  delete. Every other Project Workspace router writes to this table
  automatically via the new `project_helpers.log_timeline_event` on
  notable events (phase completed, feature done, todo completed, bug
  resolved, milestone reached, project created/completed, resource
  added, document added/deleted)
- `analytics.py` -- `GET /api/analytics/projects/{project_id}` (single-
  project analytics) and `GET /api/analytics/overview` (workspace-
  wide rollup), covering all six requested metrics: Project Progress,
  Todo Completion, Bug Counts (by severity and status), Milestone
  Progress, Feature Status (by status), and Velocity (todos completed/
  bugs resolved/milestones reached, bucketed into the last 8 weeks)

New Helper (`backend/app/project_helpers.py`)

- `log_timeline_event(...)` -- the project-scoped analogue of
  `activity_log.log_activity`; kept in its own module (not inside
  `routers/timeline.py`) so every other Project Workspace router can
  import it without depending on the timeline router itself

Pydantic Schemas (`backend/app/schemas.py`) -- additive only

- `ProjectWorkspaceSearchResult` -- backs `GET /api/projects/search`
- `FeatureStatusCount`, `BugSeverityCount`, `BugStatusCount`,
  `VelocityPoint`, `ProjectAnalytics`, `WorkspaceAnalytics` -- back
  `routers/analytics.py`
- `DashboardOut` extended with four new optional-with-defaults fields
  (`projects_progress`, `upcoming_milestones`, `overdue_project_todos`,
  `recent_project_timeline`), the same backwards-compatible pattern
  used when Study Hub fields were added to this schema previously

Dashboard Integration (`backend/app/routers/dashboard.py`)

- Imports and calls four new aggregation helpers from `projects.py`
  (`get_projects_progress`, `get_upcoming_milestones`,
  `get_overdue_project_todos`, `get_recent_timeline`) and folds their
  results into `DashboardOut`, the same way `study_hub.py`'s helpers
  were folded in previously. `GET /api/dashboard` now returns Project
  Workspace data without any frontend changes (per this session's
  explicit backend-only scope).

`backend/app/main.py`

- Registers all 10 new routers. Project Workspace routers are
  registered after the Study Hub routers and before `dashboard.router`
  (which now depends on `projects.py`'s aggregation helpers, the same
  reason `dashboard.router` was already registered after
  `study_hub.router`).

### Verified

- `app.main.app` boots cleanly (101 routes total); confirmed via
  `TestClient` against a real SQLite database (not mocked)
- Full CRUD verified for all 9 Project Workspace entities: create,
  read (list + get), update (including every convenience flag:
  `clear_deadline`, `clear_phase`, `clear_feature`, `clear_topic`-
  equivalents, `complete_now`), delete
- Cascade/orphan behavior re-verified against the live routers (not
  just the ORM in isolation, as the previous session tested): deleting
  a Project cascades to every child table; deleting a Phase or Feature
  orphans (does not delete) the work items grouped under it, exactly
  as `DATABASE_SCHEMA.md` documents
- Urgency computation verified for both Features (no-deadline branch)
  and Project Todos (full deadline-aware branch) -- same
  `urgency.compute_urgency` function Tasks/Assignments use, zero new
  calculation logic
- File upload/delete verified against `ProjectResource` via the
  existing `uploads.py` helpers (upload endpoint + on-delete cleanup)
- Search, filtering, sorting, and pagination query parameters
  exercised on `projects`, `features`, and `todos` list endpoints
- Existing endpoints re-tested after this change and confirmed
  unaffected: `/api/tasks`, `/api/subjects`, `/api/study-hub/summary`,
  `/api/dashboard` all still return 200 with their original shapes
  intact (Study Hub/MVP fields unchanged; new Project Workspace fields
  are additive)

### Not Included (by design -- see task scope)

- Frontend pages/components/hooks/types for the Project Workspace
- Notification system wiring for Project Workspace events (todos/bugs/
  milestones don't yet trigger browser notifications)
- Git Sync Engine (still not started, per AI_HANDOFF.md priority order)

---

## [Unreleased] - Project Workspace: Backend Foundation

Status: Database models + schemas only. No routers, no frontend, no
dashboard integration yet.

### Added

Database Models (`backend/app/models.py`)

- `Project` -- top-level container (name, description, icon, color,
  status, repository_url, local_repository, progress, archived, tags)
- `ProjectPhase` -- ordered roadmap stage (order_index, status, progress)
- `Feature` -- planned/in-progress work item (status, priority, effort)
- `ProjectTodo` -- fine-grained task item, reuses `TaskStatus` and the
  existing Task/Assignment field shape for Smart Urgency Engine reuse
- `Bug` -- defect tracking (severity, status, resolution)
- `Milestone` -- dated checkpoint (target_date, completed)
- `ProjectResource` -- file/link reference, mirrors the Study Hub
  `Resource` model so `uploads.py` can be reused unchanged
- `ProjectDocument` -- markdown documentation page
- `TimelineEvent` -- append-only, reusable per-project event trail
  (the project-scoped analogue of `ActivityLog`)
- New enums: `ProjectStatus`, `PhaseStatus`, `FeatureStatus`,
  `Priority`, `BugSeverity`, `BugStatus`
- SQLAlchemy `relationship()`s with `cascade="all, delete-orphan"` on
  every Project-owned child collection, verified against a real SQLite
  engine (deleting a Project cascades correctly; deleting a Phase or
  Feature orphans its children via `SET NULL` instead of deleting them)
- Indexes on every FK column plus the columns most likely to be
  filtered/sorted on (status, severity, priority, deadline/target_date,
  order_index, archived, event_type)

Pydantic Schemas (`backend/app/schemas.py`)

- `Create` / `Update` / `Out` schemas for all 9 new models, following
  the existing `Base`/`Create`/`Update`/`Out` convention
- `ProjectSummary` and `ProjectPhaseSummary` (per-entity rollups, same
  role as the existing `SubjectProgress`)
- `ProjectWorkspaceSummary` (top-level aggregate, same role as the
  existing `StudyHubSummary`) -- defined but not yet wired to a router
- Field validation matching existing conventions: `min_length`/
  `max_length` on titles, `ge=0, le=100` on progress fields, `ge=0` on
  effort-hour fields
- `clear_*` boolean convenience flags on Update schemas (e.g.
  `clear_deadline`, `clear_phase`, `clear_feature`), matching the
  existing `TaskUpdate.clear_deadline` / `AssignmentUpdate.clear_topic`
  pattern

### Changed

- `DATABASE_SCHEMA.md` -- replaced the old "Future Tables" sketches
  with full field tables, relationships, and cascade documentation for
  the 9 new tables; updated the Database Overview tree, ERD, Index
  Recommendations, and Cascade Rules sections
- `AI_HANDOFF.md` -- updated session summary, current module status,
  and next task

### Notes

- No `PRAGMA foreign_keys=ON` is set anywhere in this app (unchanged
  from before this session), so the new cascades are implemented at
  the SQLAlchemy ORM level, not the SQLite level. This was verified
  with an end-to-end test against a real (in-memory) SQLite database
  before considering the models complete.
- `Project.tags` is stored as JSON-encoded text in the database but
  exposed as `List[str]` in `ProjectOut`, matching the existing
  `Assignment.attachments` / `AssignmentOut.attachments` convention.
  The JSON encode/decode is left as router-layer work.
- No existing file was rewritten. `models.py` and `schemas.py` were
  purely extended; every existing table, enum, and schema is untouched.

### Not Included (by design -- see task scope)

- API routers (`backend/app/routers/projects.py` etc.)
- Frontend pages/components/hooks
- Dashboard widget integration
- Activity/Timeline auto-logging wiring
- Smart Urgency Engine wiring into a live endpoint

---

## Study Hub

Subjects, Topics, Assignments, Notes, Resources, Study Sessions,
Analytics, Search, Dashboard integration, File uploads. Complete.

---

## MVP

Dashboard, Task Manager, Smart Urgency Engine, Notifications, Weekly
Timetable, Progressive Web App. Complete.
