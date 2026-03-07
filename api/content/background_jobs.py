from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from django.db import close_old_connections


_MAX_WORKERS = max(1, int(os.getenv("CONTENT_UPLOAD_WORKERS", "2")))
_EXECUTOR = ThreadPoolExecutor(max_workers=_MAX_WORKERS, thread_name_prefix="content-upload")
_ASYNC_ENABLED = os.getenv("CONTENT_UPLOAD_ASYNC", "1").strip().lower() in {"1", "true", "yes", "on"}
_LOGGER = logging.getLogger(__name__)


def submit_background_job(func: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    if not _ASYNC_ENABLED:
        _run_job(func, *args, **kwargs)
        return

    try:
        future = _EXECUTOR.submit(_run_job, func, *args, **kwargs)
    except RuntimeError:
        # Executor can be unavailable during shutdown/reload; run inline instead.
        _run_job(func, *args, **kwargs)
        return

    future.add_done_callback(_log_job_exception)


def _run_job(func: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    close_old_connections()
    try:
        func(*args, **kwargs)
    finally:
        close_old_connections()


def _log_job_exception(future) -> None:
    exc = future.exception()
    if exc is not None:
        _LOGGER.exception("Background content upload job failed", exc_info=exc)
