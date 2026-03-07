from __future__ import annotations

from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from core.throttling import SafeAnonRateThrottle, SafeUserRateThrottle


class SafeThrottleTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_safe_anon_throttle_falls_open_when_cache_errors(self):
        throttle = SafeAnonRateThrottle()
        request = self.factory.get("/api/test/")
        request.user = AnonymousUser()

        with mock.patch(
            "rest_framework.throttling.AnonRateThrottle.allow_request",
            side_effect=RuntimeError("cache unavailable"),
        ):
            self.assertTrue(throttle.allow_request(request, view=None))

    def test_safe_user_throttle_falls_open_when_cache_errors(self):
        throttle = SafeUserRateThrottle()
        user_model = get_user_model()
        request = self.factory.get("/api/test/")
        request.user = user_model(username="reader")

        with mock.patch(
            "rest_framework.throttling.UserRateThrottle.allow_request",
            side_effect=RuntimeError("cache unavailable"),
        ):
            self.assertTrue(throttle.allow_request(request, view=None))
