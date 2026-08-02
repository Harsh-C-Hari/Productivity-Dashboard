"""
Shared file-upload handling for the Study Hub.

Uploaded files are written to `backend/uploads/` under a UUID-prefixed
filename (to avoid collisions/overwrites) and served back out via the
static file mount configured in `main.py` (`/uploads/...`). This module
centralizes that logic so assignments, notes, and the resource library
all store attachments the same way.
"""
import os
import uuid

from fastapi import UploadFile

from .models import ResourceType

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# Generous but bounded: keeps the local SQLite-backed app from filling the
# disk with a single mistaken upload. 50 MB is plenty for course PDFs/PPTs.
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

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


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def infer_resource_type(filename: str) -> ResourceType:
    ext = os.path.splitext(filename)[1].lower()
    return EXTENSION_TO_RESOURCE_TYPE.get(ext, ResourceType.other)


async def save_upload(file: UploadFile) -> dict:
    """Persists an UploadFile to disk and returns attachment metadata
    (filename, original_name, url, size_bytes, content_type). Raises
    ValueError if the file exceeds MAX_UPLOAD_BYTES."""
    ensure_upload_dir()

    original_name = file.filename or "upload"
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, stored_name)

    size_bytes = 0
    with open(dest_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size_bytes += len(chunk)
            if size_bytes > MAX_UPLOAD_BYTES:
                out.close()
                os.remove(dest_path)
                raise ValueError("File exceeds the 50 MB upload limit")
            out.write(chunk)

    return {
        "filename": stored_name,
        "original_name": original_name,
        "url": f"/uploads/{stored_name}",
        "size_bytes": size_bytes,
        "content_type": file.content_type or "application/octet-stream",
    }


def delete_upload(stored_filename: str):
    """Best-effort delete; missing files are not an error."""
    path = os.path.join(UPLOAD_DIR, stored_filename)
    if os.path.exists(path):
        os.remove(path)
