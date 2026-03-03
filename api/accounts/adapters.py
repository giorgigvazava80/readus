from datetime import date
import logging

import requests
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings

from .emailing import send_email_message
from .utils import get_profile


logger = logging.getLogger(__name__)
GOOGLE_PEOPLE_API_URL = "https://people.googleapis.com/v1/people/me"


def _parse_google_birth_date(extra_data: dict) -> date | None:
    birthdays = extra_data.get("birthdays")
    if not isinstance(birthdays, list):
        return None

    sorted_birthdays = sorted(
        birthdays,
        key=lambda item: not bool((item.get("metadata") or {}).get("primary")),
    )
    for item in sorted_birthdays:
        date_payload = item.get("date") or {}
        year = date_payload.get("year")
        month = date_payload.get("month")
        day = date_payload.get("day")
        if not (year and month and day):
            continue

        try:
            return date(int(year), int(month), int(day))
        except ValueError:
            continue

    return None


def _fetch_google_profile_birth_date(access_token: str) -> date | None:
    if not access_token:
        return None

    try:
        response = requests.get(
            GOOGLE_PEOPLE_API_URL,
            params={"personFields": "birthdays"},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=8,
        )
    except requests.RequestException:
        logger.warning("Could not fetch Google People API birthday payload.", exc_info=True)
        return None

    if response.status_code != 200:
        logger.info("Google People API birthday request skipped with status=%s.", response.status_code)
        return None

    try:
        payload = response.json()
    except ValueError:
        logger.warning("Google People API returned non-JSON birthday payload.")
        return None

    return _parse_google_birth_date(payload)


def _google_birth_date_from_sociallogin(sociallogin) -> date | None:
    extra_data = getattr(sociallogin.account, "extra_data", {}) or {}

    from_people_api = _parse_google_birth_date(extra_data)
    if from_people_api:
        return from_people_api

    serialized = extra_data.get("birth_date")
    if isinstance(serialized, str):
        try:
            return date.fromisoformat(serialized)
        except ValueError:
            return None

    return None


class ReadusAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url(self, request, emailconfirmation):
        frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
        if frontend_base_url:
            return f"{frontend_base_url}/verify-email?key={emailconfirmation.key}"
        return super().get_email_confirmation_url(request, emailconfirmation)

    def send_mail(self, template_prefix, email, context):
        message = self.render_mail(template_prefix, email, context)
        send_email_message(message)


class ReadusSocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        super().pre_social_login(request, sociallogin)

        # In email-authentication flows allauth can resolve sociallogin.user
        # without binding sociallogin.account.user yet.
        if getattr(sociallogin, "user", None) and getattr(sociallogin.account, "user_id", None) is None:
            sociallogin.account.user = sociallogin.user

        if sociallogin.account.provider != "google":
            return

        if not getattr(settings, "GOOGLE_IMPORT_BIRTH_DATE", True):
            return

        token = getattr(sociallogin, "token", None)
        access_token = getattr(token, "token", "") if token else ""
        birth_date = _fetch_google_profile_birth_date(access_token)
        if not birth_date:
            return

        extra_data = sociallogin.account.extra_data or {}
        extra_data["birth_date"] = birth_date.isoformat()
        sociallogin.account.extra_data = extra_data

        user = getattr(sociallogin, "user", None)
        if user and getattr(user, "pk", None):
            profile = get_profile(user)
            if not profile.birth_date:
                profile.birth_date = birth_date
                profile.save(update_fields=["birth_date", "updated_at"])

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)

        if sociallogin.account.provider != "google":
            return user

        birth_date = _google_birth_date_from_sociallogin(sociallogin)
        if not birth_date:
            return user

        profile = get_profile(user)
        if not profile.birth_date:
            profile.birth_date = birth_date
            profile.save(update_fields=["birth_date", "updated_at"])

        return user
