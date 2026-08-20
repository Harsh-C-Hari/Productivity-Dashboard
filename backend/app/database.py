"""
Database configuration.

Defaults to a local SQLite file (`backend/dashboard.db`) so the app
works immediately after cloning, with no external services required.
Set `DATABASE_URL` (e.g. to a Supabase Postgres connection string) to
point at a real database instead -- see backend/.env.example.
"""
import os

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_SQLITE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'dashboard.db')}"

_raw_database_url = os.environ.get("DATABASE_URL", "").strip()

# Some providers (Supabase included, historically) hand out connection
# strings starting "postgres://" -- SQLAlchemy's psycopg2 dialect only
# recognizes "postgresql://". Normalize rather than making every
# deployment remember to edit the string themselves.
if _raw_database_url.startswith("postgres://"):
    _raw_database_url = "postgresql://" + _raw_database_url[len("postgres://"):]

DATABASE_URL = _raw_database_url or _DEFAULT_SQLITE_URL
IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    # check_same_thread=False is required because SQLite by default only
    # allows the thread that created a connection to use it, but FastAPI
    # may serve a single request across different threads in its thread
    # pool.
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Serverless (Vercel) invocations are short-lived and don't share
    # process state between requests the way a long-running server does,
    # so SQLAlchemy's default connection pool just accumulates idle
    # connections a Supabase project's connection limit can't absorb.
    # NullPool opens one connection per checkout and closes it
    # immediately after -- correct here specifically because Supabase's
    # *pooled* ("Transaction" mode / port 6543) connection string is
    # itself backed by PgBouncer, which already does the actual pooling
    # in front of Postgres. `pool_pre_ping` guards against handing back
    # a connection PgBouncer has silently dropped.
    engine = create_engine(DATABASE_URL, poolclass=NullPool, pool_pre_ping=True)

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
#
# Runs against Postgres too (SQLAlchemy's inspector/DDL here aren't
# SQLite-specific) but every call is an extra round-trip to the
# database, which matters more on serverless where this runs on every
# cold start. Set `RUN_STARTUP_TASKS=false` once a deployment's schema
# is known to be current to skip this (and the sample-data seeders in
# main.py) entirely.
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

# (table_name, column_name, column_ddl_type) for the token-refresh-
# reminder additive migration -- promotes AIAccount.token_refresh_
# reminder_at / is_token_limited from a per-device localStorage-only
# value (see aiWorkspaceMeta.ts / token_trackers.py's module docstring)
# to real columns, so a reminder set on one device/browser is visible
# on every other device the same account is opened from. Same dumb
# ADD-COLUMN-IF-MISSING pattern as _OWNERSHIP_COLUMNS above, kept as
# its own list so each migration's purpose stays self-documenting.
_REMINDER_COLUMNS = [
    ("ai_accounts", "token_refresh_reminder_at", "TIMESTAMP"),
    ("ai_accounts", "is_token_limited", "BOOLEAN NOT NULL DEFAULT FALSE"),
]


def run_startup_migrations() -> None:
    """Adds any ownership/reminder columns that don't exist yet on the
    current database. Safe to call on every startup (including a
    brand-new database, where the columns already exist and every
    check here is a no-op) and safe to call more than once."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, col_type in _OWNERSHIP_COLUMNS + _REMINDER_COLUMNS:
            if table not in existing_tables:
                # Fresh database -- create_all already made this table
                # with the column included, nothing to migrate.
                continue
            existing_columns = {c["name"] for c in inspector.get_columns(table)}
            if column in existing_columns:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
