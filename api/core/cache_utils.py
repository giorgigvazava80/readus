from __future__ import annotations

import logging
import random
from datetime import datetime, timezone as dt_timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from urllib.parse import urlencode

from django.core.cache import cache
from django.http import HttpResponseNotModified
from django.utils import timezone
from django.utils.cache import patch_vary_headers
from django.utils.http import http_date


logger = logging.getLogger(__name__)

PUBLIC_CONTENT_CACHE_VERSION_KEY = "public-content-cache-version"
PUBLIC_CONTENT_CACHE_LAST_MODIFIED_KEY = "public-content-cache-last-modified"


def _normalize_timeout(timeout, *, jitter: bool = False):
    if timeout in (None, 0):
        return timeout

    try:
        normalized = int(timeout)
    except (TypeError, ValueError):
        return timeout

    if not jitter or normalized <= 1:
        return normalized

    spread = min(max(int(normalized * 0.1), 1), 30)
    return normalized + random.randint(0, spread)


def safe_cache_get(key, default=None):
    try:
        return cache.get(key, default)
    except Exception:
        logger.warning("Cache get failed for key '%s'.", key, exc_info=True)
        return default


def safe_cache_set(key, value, *, timeout=None, jitter: bool = False) -> bool:
    try:
        cache.set(key, value, timeout=_normalize_timeout(timeout, jitter=jitter))
        return True
    except Exception:
        logger.warning("Cache set failed for key '%s'.", key, exc_info=True)
        return False


def safe_cache_incr(key, delta: int = 1, *, default=None, timeout=None):
    try:
        return cache.incr(key, delta)
    except ValueError:
        if default is None:
            raise
        safe_cache_set(key, default, timeout=timeout)
        return default
    except Exception:
        logger.warning("Cache incr failed for key '%s'.", key, exc_info=True)
        return default


def canonicalize_request_path(request) -> str:
    params: list[tuple[str, str]] = []
    query_params = getattr(request, "query_params", None) or request.GET
    for key in sorted(query_params.keys()):
        for value in query_params.getlist(key):
            params.append((key, value))

    query_string = urlencode(params, doseq=True)
    if not query_string:
        return request.path
    return f"{request.path}?{query_string}"


def get_public_cache_version() -> int:
    version = safe_cache_get(PUBLIC_CONTENT_CACHE_VERSION_KEY)
    if version is None:
        safe_cache_set(PUBLIC_CONTENT_CACHE_VERSION_KEY, 1, timeout=None)
        return 1

    try:
        return int(version)
    except (TypeError, ValueError):
        safe_cache_set(PUBLIC_CONTENT_CACHE_VERSION_KEY, 1, timeout=None)
        return 1


def get_public_cache_last_modified() -> datetime:
    cached_value = safe_cache_get(PUBLIC_CONTENT_CACHE_LAST_MODIFIED_KEY)
    if cached_value is None:
        current = timezone.now()
        safe_cache_set(PUBLIC_CONTENT_CACHE_LAST_MODIFIED_KEY, current.timestamp(), timeout=None)
        return current

    try:
        return datetime.fromtimestamp(float(cached_value), tz=dt_timezone.utc)
    except (TypeError, ValueError, OSError, OverflowError):
        current = timezone.now()
        safe_cache_set(PUBLIC_CONTENT_CACHE_LAST_MODIFIED_KEY, current.timestamp(), timeout=None)
        return current


def bump_public_cache_version() -> int:
    current_version = get_public_cache_version()
    next_version = safe_cache_incr(
        PUBLIC_CONTENT_CACHE_VERSION_KEY,
        1,
        default=current_version + 1,
        timeout=None,
    )
    safe_cache_set(PUBLIC_CONTENT_CACHE_LAST_MODIFIED_KEY, timezone.now().timestamp(), timeout=None)

    try:
        return int(next_version)
    except (TypeError, ValueError):
        return current_version + 1


def get_public_cache_meta(prefix: str, path: str) -> dict[str, object]:
    version = get_public_cache_version()
    last_modified = get_public_cache_last_modified()
    confirmed_version = get_public_cache_version()
    if confirmed_version != version:
        version = confirmed_version
        last_modified = get_public_cache_last_modified()
    path_hash = sha256(path.encode("utf-8")).hexdigest()
    etag = sha256(f"{prefix}:{version}:{path_hash}".encode("utf-8")).hexdigest()
    return {
        "cache_key": f"{prefix}:v{version}:{path_hash}",
        "etag": f"\"{etag}\"",
        "last_modified": last_modified,
        "version": version,
        "path": path,
    }


def _normalize_etag(value: str) -> str:
    normalized = (value or "").strip()
    if normalized.startswith("W/"):
        normalized = normalized[2:].strip()
    return normalized


def is_public_resource_not_modified(request, *, etag: str, last_modified: datetime) -> bool:
    if_none_match = (request.headers.get("If-None-Match") or "").strip()
    if if_none_match:
        candidates = {
            _normalize_etag(item)
            for item in if_none_match.split(",")
            if item.strip()
        }
        return "*" in candidates or _normalize_etag(etag) in candidates

    if_modified_since = (request.headers.get("If-Modified-Since") or "").strip()
    if not if_modified_since:
        return False

    try:
        parsed = parsedate_to_datetime(if_modified_since)
    except (TypeError, ValueError, IndexError):
        return False

    if parsed is None:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_timezone.utc)

    resource_last_modified = last_modified.astimezone(dt_timezone.utc).replace(microsecond=0)
    return resource_last_modified <= parsed.astimezone(dt_timezone.utc).replace(microsecond=0)


def build_public_not_modified_response(request, *, etag: str, last_modified: datetime):
    if not is_public_resource_not_modified(request, etag=etag, last_modified=last_modified):
        return None
    return HttpResponseNotModified()


def apply_public_cache_headers(response, *, etag: str, last_modified: datetime, vary_on_auth: bool = True):
    response["Cache-Control"] = "public, no-cache, must-revalidate"
    response["ETag"] = etag
    response["Last-Modified"] = http_date(last_modified.timestamp())

    vary_headers = ["Accept"]
    if vary_on_auth:
        vary_headers.extend(["Authorization", "Cookie"])
    patch_vary_headers(response, vary_headers)
    return response


def apply_private_no_store_headers(response, *, vary_on_auth: bool = True):
    response["Cache-Control"] = "private, no-store, max-age=0"
    response["Pragma"] = "no-cache"

    vary_headers = ["Accept"]
    if vary_on_auth:
        vary_headers.extend(["Authorization", "Cookie"])
    patch_vary_headers(response, vary_headers)
    return response
