from __future__ import annotations

from django.conf import settings
from django.views.static import serve as static_serve


def serve_cached_media(request, path, document_root=None, show_indexes: bool = False):
    response = static_serve(
        request,
        path,
        document_root=document_root,
        show_indexes=show_indexes,
    )

    cache_seconds = max(int(getattr(settings, "MEDIA_BROWSER_CACHE_SECONDS", 3600)), 0)
    if cache_seconds > 0:
        response["Cache-Control"] = f"public, max-age={cache_seconds}, must-revalidate"
    else:
        response["Cache-Control"] = "public, no-cache, must-revalidate"

    return response
