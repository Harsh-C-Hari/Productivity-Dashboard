"""
Vercel Python entrypoint.

Deployed as the `backend` service in the root-level vercel.json
(Vercel Services -- one project, one domain, shared with the `frontend`
service, routed by the top-level `rewrites`). Vercel's Python runtime
auto-detects any `.py` file under `api/` that exports an `app`
variable -- no extra config needed for FastAPI. This file just
re-exports the real app from `app/main.py` so there's exactly one
app definition -- everything about routes/middleware/startup behavior
lives there, same as when running locally with `uvicorn app.main:app`.
"""
from app.main import app  # noqa: F401
