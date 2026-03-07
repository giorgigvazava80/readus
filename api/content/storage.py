from __future__ import annotations

from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage


def build_content_upload_storage() -> Storage:
    """
    Choose storage backend for uploaded source documents.

    Defaults to automatic mode:
    - use Cloudinary Raw Media when Cloudinary is configured
    - fallback to local filesystem storage otherwise

    You can force behavior with CONTENT_UPLOAD_STORAGE:
    - local / filesystem / fs
    - cloudinary_raw / cloudinary / raw
    - auto
    """
    configured_backend = str(getattr(settings, "CONTENT_UPLOAD_STORAGE", "auto")).strip().lower()

    if configured_backend in {"local", "filesystem", "fs"}:
        return FileSystemStorage()

    if configured_backend in {"cloudinary_raw", "cloudinary", "raw"} and getattr(
        settings, "CLOUDINARY_URL", ""
    ).strip():
        try:
            from cloudinary_storage.storage import RawMediaCloudinaryStorage

            return RawMediaCloudinaryStorage()
        except Exception:
            # Keep uploads working even if Cloudinary is misconfigured.
            return FileSystemStorage()

    if configured_backend == "auto" and getattr(settings, "CLOUDINARY_URL", "").strip():
        try:
            from cloudinary_storage.storage import RawMediaCloudinaryStorage

            return RawMediaCloudinaryStorage()
        except Exception:
            return FileSystemStorage()

    return FileSystemStorage()
