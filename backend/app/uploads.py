"""
Shared file-upload handling, used by Study Hub attachments, the
Project Workspace resource library, and AI Workspace project-zip
snapshots.

Two storage backends, chosen automatically at import time:

- **Supabase Storage** (production): used whenever `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` are set (see backend/.env.example).
  Required on Vercel -- serverless functions don't have a writable,
  *persistent* local disk (only an ephemeral `/tmp` that's gone the
  moment the invocation ends), so files saved locally would vanish
  before anyone could ever fetch them back.
- **Local disk** (dev default): files land in `backend/uploads/` and
  are served back out via the static file mount in `main.py`
  (`/uploads/...`). Zero external setup, matching this app's
  "works immediately after cloning" design.

Every router (assignments/notes/resources/project_resources/
project_zips) only ever calls `save_upload` / `delete_upload` -- which
backend is active is entirely invisible to callers, so no router needed
to change when Supabase support was added here.
"""
import os
import urllib.error
import urllib.request
import uuid

from fastapi import UploadFile

from .models import ResourceType

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# Generous but bounded: keeps a single mistaken upload from filling the
# disk (local mode) or running up storage costs (Supabase mode). 25 MB
# is plenty for course PDFs/PPTs and zip snapshots.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "attachments")
# AI Workspace project-zip snapshots go in their own bucket by default
# (kept separate from everyday attachments/resources -- zip snapshots
# tend to be far larger and have a different retention story). Falls
# back to SUPABASE_STORAGE_BUCKET if unset, so a single-bucket setup
# still works.
SUPABASE_ZIPS_BUCKET = os.environ.get("SUPABASE_ZIPS_BUCKET", SUPABASE_STORAGE_BUCKET)

EXTENSION_TO_RESOURCE_TYPE = {
    ".pdf": ResourceType.pdf,
    ".ppt": ResourceType.ppt,
    ".pptx": ResourceType.ppt,
    ".doc": ResourceType.docx,
    ".docx": ResourceType.docx,
    ".png": ResourceType.image,
    ".jpg": ResourceType.image,
    ".jpeg": ResourceType.image,
    ".gif": ResourceType.image,
    ".webp": ResourceType.image,
    ".zip": ResourceType.zip,
}


def supabase_storage_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def ensure_upload_dir():
    """No-op (and never called) in Supabase mode -- Vercel's filesystem
    is read-only outside `/tmp`, so attempting `os.makedirs` against a
    path under the deployed source tree would raise. Local disk mode
    still needs this to boot on a fresh clone."""
    if not supabase_storage_configured():
        os.makedirs(UPLOAD_DIR, exist_ok=True)


def infer_resource_type(filename: str) -> ResourceType:
    ext = os.path.splitext(filename)[1].lower()
    return EXTENSION_TO_RESOURCE_TYPE.get(ext, ResourceType.other)


def _supabase_request(
    method: str, path: str, bucket: str, data: bytes = b"", content_type: str = "application/octet-stream"
) -> None:
    """Minimal Supabase Storage REST client using only the stdlib
    (`urllib`) -- avoids adding `requests`/`httpx` as a dependency for
    what's just two calls (upload, delete). Raises on any non-2xx
    response; callers decide how to surface that."""
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    if method == "POST":
        headers["Content-Type"] = content_type
        # Overwrite if a stored_name collision ever happens (shouldn't,
        # given the uuid4 prefix, but the SDKs default to this too).
        headers["x-upsert"] = "true"

    req = urllib.request.Request(url, data=data or None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30):
            return
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase Storage {method} {path} failed ({exc.code}): {body}") from exc


def _public_url(stored_name: str, bucket: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{stored_name}"


async def save_upload(file: UploadFile, bucket: str = SUPABASE_STORAGE_BUCKET) -> dict:
    """Persists an UploadFile (to Supabase Storage or local disk,
    whichever is configured) and returns attachment metadata (filename,
    original_name, url, size_bytes, content_type). Raises ValueError if
    the file exceeds MAX_UPLOAD_BYTES. `bucket` is ignored in local-disk
    mode (there's only ever one uploads/ folder there) -- pass
    SUPABASE_ZIPS_BUCKET for project-zip snapshots, the default
    SUPABASE_STORAGE_BUCKET otherwise."""
    original_name = file.filename or "upload"
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    content_type = file.content_type or "application/octet-stream"

    if supabase_storage_configured():
        # No true streaming upload via urllib -- read fully (bounded by
        # MAX_UPLOAD_BYTES, checked as we go) and send in one request.
        chunks = []
        size_bytes = 0
        while chunk := await file.read(1024 * 1024):
            size_bytes += len(chunk)
            if size_bytes > MAX_UPLOAD_BYTES:
                raise ValueError("File exceeds the 25 MB upload limit")
            chunks.append(chunk)
        _supabase_request("POST", stored_name, bucket, data=b"".join(chunks), content_type=content_type)
        url = _public_url(stored_name, bucket)
    else:
        ensure_upload_dir()
        dest_path = os.path.join(UPLOAD_DIR, stored_name)
        size_bytes = 0
        with open(dest_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size_bytes += len(chunk)
                if size_bytes > MAX_UPLOAD_BYTES:
                    out.close()
                    os.remove(dest_path)
                    raise ValueError("File exceeds the 25 MB upload limit")
                out.write(chunk)
        url = f"/uploads/{stored_name}"

    return {
        "filename": stored_name,
        "original_name": original_name,
        "url": url,
        "size_bytes": size_bytes,
        "content_type": content_type,
    }


def delete_upload(stored_filename: str, bucket: str = SUPABASE_STORAGE_BUCKET):
    """Best-effort delete; missing files are not an error. Pass the same
    `bucket` used in the matching `save_upload` call."""
    if supabase_storage_configured():
        try:
            _supabase_request("DELETE", stored_filename, bucket)
        except RuntimeError:
            # Best-effort, same contract as the local-disk branch below
            # (a missing/already-deleted object shouldn't fail the
            # caller's own delete flow, e.g. deleting a resource whose
            # file was already cleaned up).
            pass
        return

    path = os.path.join(UPLOAD_DIR, stored_filename)
    if os.path.exists(path):
        os.remove(path)
