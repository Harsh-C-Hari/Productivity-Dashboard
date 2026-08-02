"""
Database configuration.

Uses SQLite for zero-config local persistence. The database file lives
alongside the backend package so the app works immediately after cloning,
with no external services required.
"""
from sqlalchemy import create_engine
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
