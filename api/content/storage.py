from __future__ import annotations

from django.conf import settings
from django.core.files.storage import FileSystemStorage, Storage


def build_content_upload_storage() -> Storage:
    """
    Use raw Cloudinary storage for document uploads when Cloudinary is enabled.
    Fallback to local filesystem storage in all other cases.
    """
    if getattr(settings, "CLOUDINARY_URL", "").strip():
        try:
            from cloudinary_storage.storage import RawMediaCloudinaryStorage

            return RawMediaCloudinaryStorage()
        except Exception:
            # Keep uploads working even if Cloudinary is misconfigured.
            return FileSystemStorage()
    return FileSystemStorage()

