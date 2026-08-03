"""
Ownership helpers for personal (non-Project) data.

`project_helpers.py` already covers "does this user have access to this
Project (and its children)?". This module is the equivalent for the
data that ISN'T project-scoped -- Tasks, Timetable, Study Hub, AI
Workspace accounts/templates -- per the task brief's "PERSONAL MODULES"
rule: everything here belongs to exactly one user, and nothing here is
ever exposed by Project Collaboration.

Two access patterns are covered:

1. Direct ownership -- the row itself has a `user_id` column (Task,
   TimetableSlot, Subject, StudySession, AIAccount, PromptTemplate,
   KnowledgeArticle when project_id is NULL). Use `owned_query` /
   `require_owned` directly against that column.

2. Inherited ownership -- the row belongs to a parent that itself has
   `user_id` (Topic/Assignment/Note/Resource -> Subject; Conversation/
   ProjectZip/AIHandoff/TokenTracker -> AIAccount, unless the row also
   carries a project_id, in which case Project access applies instead
   per the "Project Content" rule). Callers resolve the parent first
   (they already need it for a 404 check) and then call
   `require_owner_id` with the parent's own user_id.

Kept in its own module for the same reason `project_helpers.py` is:
every router needs it, and importing it must never risk a circular
import with any router module.
"""
from typing import Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy.orm import Session, Query

from . import models

ModelT = TypeVar("ModelT")


def owned_query(db: Session, model: Type[ModelT], user_id: str) -> Query:
    """`db.query(model)` filtered to rows this user owns. A row whose
    `user_id` is NULL (a legacy row from before the data-isolation fix
    added the column -- see database.py's `run_startup_migrations`) is
    orphaned, not global: it matches nobody's query, the same as if it
    belonged to a deleted user."""
    return db.query(model).filter(model.user_id == user_id)


def require_owner_id(owner_user_id: Optional[str], current_user_id: str, not_found_detail: str) -> None:
    """Raise 404 (never 403 -- see note below) unless `owner_user_id`
    (already loaded off the row or its parent) matches the current
    user. 404 rather than 403 is deliberate: confirming a personal
    resource *exists* but belongs to someone else is itself a data
    leak (it tells an attacker the ID is valid), so an unauthorized
    request looks identical to a nonexistent one."""
    if owner_user_id != current_user_id:
        raise HTTPException(status_code=404, detail=not_found_detail)


def get_owned_or_404(
    db: Session, model: Type[ModelT], row_id: str, user_id: str, not_found_detail: str
) -> ModelT:
    """Fetch a single row by id, scoped to the owning user in the same
    query (rather than fetching first and checking after) so an
    unauthorized row and a nonexistent row are indistinguishable -- see
    `require_owner_id`'s docstring."""
    row = db.query(model).filter(model.id == row_id, model.user_id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return row
