from __future__ import annotations

import re
from datetime import timedelta
from collections.abc import Iterable
from hashlib import sha256
from html import unescape
from typing import Any
from uuid import uuid4

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from accounts.models import Notification
from accounts.utils import can_manage_content, can_review_content, create_notification
from content.models import Book, Chapter, Poem, Story

from .models import AuthorFollow
from .targets import (
    extract_target_excerpt,
    get_target_author,
    get_target_category,
    get_target_public_identifier,
    get_target_title,
    is_target_accessible_for_author,
    is_target_public,
)


CONTENT_MODEL_TO_CATEGORY = {
    "book": "books",
    "story": "stories",
    "poem": "poems",
    "chapter": "chapters",
}

def bump_public_content_cache_version() -> None:
    # Import lazily to avoid circular imports on startup.
    from content.views import _bump_public_cache_version

    _bump_public_cache_version()


def is_target_anonymous(instance) -> bool:
    if isinstance(instance, Chapter):
        return bool(instance.book.is_anonymous)
    return bool(getattr(instance, "is_anonymous", False))


def is_target_follow_feed_eligible(instance) -> bool:
    return is_target_public(instance) and not is_target_anonymous(instance)


def user_can_access_target(user, instance) -> bool:
    if is_target_public(instance):
        return True

    if not user or not user.is_authenticated:
        return False

    if can_manage_content(user) or can_review_content(user):
        return True

    author = get_target_author(instance)
    return bool(author and author.id == user.id and is_target_accessible_for_author(instance))


def user_can_moderate_target_comments(user, instance) -> bool:
    if not user or not user.is_authenticated:
        return False

    if can_manage_content(user) or can_review_content(user):
        return True

    author = get_target_author(instance)
    return bool(author and author.id == user.id)


def get_viewer_anon_key(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    remote = request.META.get("REMOTE_ADDR", "")
    seed = f"{forwarded}|{remote}".strip()
    return sha256(seed.encode("utf-8")).hexdigest()[:64]


def get_referral_visitor_id(request) -> str:
    current = (request.COOKIES.get("readus_vid") or "").strip()
    if current:
        return current[:120]

    return f"v_{uuid4().hex}"[:120]


def normalize_ref_code(raw_value: str | None) -> str:
    value = (raw_value or "").strip()
    if not value:
        return ""
    if value.startswith("@"):
        value = value[1:]
    return value[:64]


def _abs_media_url(request, media_field) -> str | None:
    if not media_field:
        return None

    try:
        url = media_field.url
    except Exception:
        return None

    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    return request.build_absolute_uri(url) if request else url


def build_frontend_read_path(instance) -> str:
    category = get_target_category(instance)
    identifier = get_target_public_identifier(instance)
    return f"/read/{category}/{identifier}"


def build_frontend_read_url(instance) -> str:
    base = (getattr(settings, "FRONTEND_BASE_URL", "") or "").rstrip("/")
    return f"{base}{build_frontend_read_path(instance)}" if base else build_frontend_read_path(instance)


def build_target_payload(instance, *, request=None) -> dict[str, Any]:
    category = get_target_category(instance)
    identifier = get_target_public_identifier(instance)
    author = get_target_author(instance)
    anonymous = is_target_anonymous(instance)
    author_display_name = "Anonymous"
    author_username = None

    if author and not anonymous:
        full_name = f"{author.first_name} {author.last_name}".strip()
        author_display_name = full_name or author.username
        author_username = author.username

    cover_source = instance.book.cover_image if isinstance(instance, Chapter) else getattr(instance, "cover_image", None)
    excerpt = extract_target_excerpt(instance)
    created_at = getattr(instance, "created_at", None)

    return {
        "category": category,
        "id": instance.id,
        "identifier": identifier,
        "title": get_target_title(instance),
        "excerpt": excerpt,
        "author_username": author_username,
        "author_display_name": author_display_name,
        "author_key": "anonymous" if anonymous else (author.username if author else None),
        "is_anonymous": anonymous,
        "cover_image": _abs_media_url(request, cover_source),
        "created_at": created_at,
        "read_path": build_frontend_read_path(instance),
        "read_url": build_frontend_read_url(instance),
    }


def notify_follow_event(*, actor, author) -> None:
    if not author or actor.id == author.id:
        return

    create_notification(
        user=author,
        category=Notification.Category.FOLLOW,
        title="New follower",
        message=f"{actor.username} started following you.",
        title_ka="ახალი გამომწერი",
        message_ka=f"{actor.username} გამოგიწერათ.",
        metadata={"follower_id": actor.id, "follower_username": actor.username},
    )


def notify_like_event(*, actor, target) -> None:
    author = get_target_author(target)
    if not author or author.id == actor.id:
        return

    anonymous_target = is_target_anonymous(target)
    actor_display = "A reader" if anonymous_target else actor.username
    actor_display_ka = "მკითხველი" if anonymous_target else actor.username
    create_notification(
        user=author,
        category=Notification.Category.LIKE,
        title="New like",
        message=f"{actor_display} liked '{get_target_title(target)}'.",
        title_ka="ახალი მოწონება",
        message_ka=f"{actor_display_ka}-მა მოიწონა „{get_target_title(target)}“.",
        metadata={
            "actor_id": actor.id,
            "actor_username": actor.username,
            "actor_display_name": actor_display,
            "target_is_anonymous": anonymous_target,
            "target_category": get_target_category(target),
            "target_id": target.id,
            "target_identifier": get_target_public_identifier(target),
        },
    )


def notify_comment_event(*, actor, target, comment_id: int, reply_to_user=None) -> None:
    author = get_target_author(target)
    recipients = []
    if author and author.id != actor.id:
        recipients.append(author)
    if reply_to_user and reply_to_user.id not in {actor.id, getattr(author, "id", None)}:
        recipients.append(reply_to_user)

    for recipient in recipients:
        if reply_to_user and recipient.id == reply_to_user.id:
            title = "New reply"
            message = f"{actor.username} replied to your comment on '{get_target_title(target)}'."
            title_ka = "ახალი პასუხი"
            message_ka = f"{actor.username}-მა უპასუხა თქვენს კომენტარს „{get_target_title(target)}“-ზე."
        else:
            title = "New comment"
            message = f"{actor.username} commented on '{get_target_title(target)}'."
            title_ka = "ახალი კომენტარი"
            message_ka = f"{actor.username}-მა დააკომენტარა „{get_target_title(target)}“."
        create_notification(
            user=recipient,
            category=Notification.Category.COMMENT,
            title=title,
            message=message,
            title_ka=title_ka,
            message_ka=message_ka,
            metadata={
                "actor_id": actor.id,
                "actor_username": actor.username,
                "comment_id": comment_id,
                "target_category": get_target_category(target),
                "target_id": target.id,
                "target_identifier": get_target_public_identifier(target),
            },
        )


def notify_followers_about_publication(target) -> None:
    if not is_target_follow_feed_eligible(target):
        return

    author = get_target_author(target)
    if not author:
        return

    follower_ids = list(AuthorFollow.objects.filter(author=author).values_list("follower_id", flat=True))
    if not follower_ids:
        return

    category = get_target_category(target)
    identifier = get_target_public_identifier(target)
    title = get_target_title(target)
    model_title = "chapter" if isinstance(target, Chapter) else "work"
    message = f"{author.username} published a new {model_title}: {title}"
    message_ka = f"{author.username}-მა გამოაქვეყნა ახალი {('თავი' if isinstance(target, Chapter) else 'ნაშრომი')}: {title}"

    # Fetch once to avoid per-row queries.
    from django.contrib.auth import get_user_model

    users_by_id = {
        user.id: user
        for user in get_user_model().objects.filter(id__in=follower_ids)
    }

    for follower_id in follower_ids:
        recipient = users_by_id.get(follower_id)
        if not recipient:
            continue
        create_notification(
            user=recipient,
            category=Notification.Category.PUBLICATION,
            title="New publication from followed author",
            message=message,
            title_ka="ახალი პუბლიკაცია გამომწერი ავტორისგან",
            message_ka=message_ka,
            metadata={
                "author_id": author.id,
                "author_username": author.username,
                "target_category": category,
                "target_id": target.id,
                "target_identifier": identifier,
            },
        )


def category_for_content_type_id(content_type_id: int) -> str | None:
    ct = ContentType.objects.filter(id=content_type_id).first()
    if not ct:
        return None
    return CONTENT_MODEL_TO_CATEGORY.get(ct.model)


def extract_keywords_from_text(value: str, *, max_items: int = 8) -> list[str]:
    if not value:
        return []

    cleaned = unescape(value)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"[^A-Za-z0-9\u10A0-\u10FF\s#]", " ", cleaned)
    tokens = [token.lower().strip("#") for token in cleaned.split()]
    tokens = [token for token in tokens if len(token) >= 4]

    scores: dict[str, int] = {}
    for token in tokens:
        if token in {"this", "that", "with", "from", "there", "about", "were", "have", "into", "your"}:
            continue
        scores[token] = scores.get(token, 0) + 1

    ranked = sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))
    return [item[0] for item in ranked[:max_items]]


def extract_keywords_from_target(instance, *, max_items: int = 8) -> list[str]:
    base_text = [get_target_title(instance), extract_target_excerpt(instance)]
    if isinstance(instance, (Book, Story, Poem)):
        base_text.append(getattr(instance, "description", ""))
    if isinstance(instance, Chapter):
        base_text.append(getattr(instance, "body", ""))

    return extract_keywords_from_text(" ".join(base_text), max_items=max_items)


def merge_unique_keywords(source_lists: Iterable[list[str]], *, max_items: int = 10) -> list[str]:
    frequency: dict[str, int] = {}
    for keyword_list in source_lists:
        for word in keyword_list:
            frequency[word] = frequency.get(word, 0) + 1

    ranked = sorted(frequency.items(), key=lambda pair: (-pair[1], pair[0]))
    return [word for word, _ in ranked[:max_items]]


def get_period_start(range_key: str):
    now = timezone.now()
    normalized = (range_key or "").strip().lower()
    if normalized == "30d":
        return now - timedelta(days=30), "30d"
    if normalized == "all":
        return None, "all"
    return now - timedelta(days=7), "7d"
