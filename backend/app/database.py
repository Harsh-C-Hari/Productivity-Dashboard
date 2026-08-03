"""
Database configuration.

Uses SQLite for zero-config local persistence. The database file lives
alongside the backend package so the app works immediately after cloning,
with no external services required.
"""
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'dashboard.db')}"

# check_same_thread=False is required because SQLite by default only allows
# the thread that created a connection to use it, but FastAPI may serve a
# single request across different threads in its thread pool.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ======================================================================
# Startup migrations
#
# `models.Base.metadata.create_all(bind=engine)` (called from main.py)
# only creates tables that don't exist yet -- it never adds a column to
# a table that's already on disk. The data-isolation fix added a
# `user_id` ownership column to several tables that previously had no
# per-user scoping at all (see models.py's comments on each column for
# why). Anyone who already has a `dashboard.db` from before this fix
# needs those columns added in place, or the app fails to start the
# moment any router tries to SELECT/INSERT the new column. This is a
# minimal, dependency-free stand-in for a real migration tool (no
# alembic is set up in this project -- see requirements.txt) that only
# ever does one thing: add a missing nullable column. It never drops,
# renames, or backfills data.
# ======================================================================

# (table_name, column_name, column_ddl_type) for every ownership column
# added by the data-isolation fix. Kept as plain SQL column defs (not
# derived from models.py) so this stays a dumb, auditable list -- see
# CHANGELOG.md for the full rationale.
_OWNERSHIP_COLUMNS = [
    ("tasks", "user_id", "VARCHAR"),
    ("timetable_slots", "user_id", "VARCHAR"),
    ("subjects", "user_id", "VARCHAR"),
    ("study_sessions", "user_id", "VARCHAR"),
    ("ai_accounts", "user_id", "VARCHAR"),
    ("prompt_templates", "user_id", "VARCHAR"),
    ("knowledge_articles", "user_id", "VARCHAR"),
]


def run_startup_migrations() -> None:
    """Adds any ownership columns that don't exist yet on the current
    database file. Safe to call on every startup (including a brand-new
    `create_all`'d database, where the columns already exist and every
    check here is a no-op) and safe to call more than once."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, col_type in _OWNERSHIP_COLUMNS:
            if table not in existing_tables:
                # Fresh database -- create_all already made this table
                # with the column included, nothing to migrate.
                continue
            existing_columns = {c["name"] for c in inspector.get_columns(table)}
            if column in existing_columns:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
