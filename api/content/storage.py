from __future__ import annotations

from django.core.files.storage import FileSystemStorage, Storage


def build_content_upload_storage() -> Storage:
    """
    Always store uploaded source documents on local filesystem.
    This keeps processing independent from Cloudinary.
    """
    return FileSystemStorage()
