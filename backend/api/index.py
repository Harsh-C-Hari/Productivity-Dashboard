"""
Vercel Python entrypoint.

Vercel's Python runtime (`@vercel/python`, configured via
backend/vercel.json) looks for an ASGI/WSGI `app` object in each file
under `api/`. This file just re-exports the real FastAPI app from
`app/main.py` so there's exactly one app definition -- everything
about routes/middleware/startup behavior lives there, same as when
running locally with `uvicorn app.main:app`.
"""
from app.main import app  # noqa: F401
