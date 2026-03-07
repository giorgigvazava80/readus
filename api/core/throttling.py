from __future__ import annotations

import logging

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


logger = logging.getLogger(__name__)


class _CacheFailOpenThrottleMixin:
    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            logger.warning(
                "Throttle check skipped because cache backend is unavailable.",
                exc_info=True,
            )
            return True


class SafeAnonRateThrottle(_CacheFailOpenThrottleMixin, AnonRateThrottle):
    pass


class SafeUserRateThrottle(_CacheFailOpenThrottleMixin, UserRateThrottle):
    pass
