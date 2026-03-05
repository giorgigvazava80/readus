from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db.models import Count, Exists, OuterRef, Q
from django.http import Http404
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.utils import create_audit_log, is_admin_user, is_redactor_user
from content.models import Book, Poem, StatusChoices, Story

from .models import AuthorFollow
from .services import bump_public_content_cache_version, notify_follow_event


def _is_privileged_user(user) -> bool:
    return bool(user and user.is_authenticated and (is_admin_user(user) or is_redactor_user(user)))


def _author_has_public_profile(author_id: int) -> bool:
    base = {
        "author_id": author_id,
        "status": StatusChoices.APPROVED,
        "is_hidden": False,
        "is_deleted": False,
        "is_anonymous": False,
    }
    return (
        Book.objects.filter(**base).exists()
        or Story.objects.filter(**base).exists()
        or Poem.objects.filter(**base).exists()
    )


def _resolve_profile_photo_url(raw_value: str | None) -> str | None:
    if not raw_value:
        return None

    raw = str(raw_value).strip()
    if not raw:
        return None

    if raw.startswith(("http://", "https://", "//")):
        return raw

    try:
        return default_storage.url(raw)
    except Exception:
        media_url = settings.MEDIA_URL or "/media/"
        if not media_url.endswith("/"):
            media_url = f"{media_url}/"
        return f"{media_url}{raw.lstrip('/')}"


def _get_author_or_404(author_id: int, *, viewer=None, allow_hidden_for_privileged: bool = False):
    User = get_user_model()
    author = User.objects.filter(id=author_id, is_active=True).first()
    if not author:
        raise Http404("Author not found.")

    if _author_has_public_profile(author.id):
        return author

    if allow_hidden_for_privileged and _is_privileged_user(viewer):
        return author

    raise Http404("Author not found.")


def _build_user_row(user, *, followed_at=None) -> dict[str, object]:
    full_name = f"{user.first_name} {user.last_name}".strip()
    profile = getattr(user, "profile", None)
    photo_name = getattr(profile, "profile_photo", None)
    return {
        "user_id": user.id,
        "username": user.username,
        "display_name": full_name or user.username,
        "profile_photo": _resolve_profile_photo_url(str(photo_name) if photo_name else None),
        "followed_at": followed_at,
    }


def _follower_count(author_id: int) -> int:
    return AuthorFollow.objects.filter(author_id=author_id).count()


class AuthorFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, author_id: int):
        author = _get_author_or_404(author_id, viewer=request.user)
        if author.id == request.user.id:
            raise ValidationError({"detail": "You cannot follow yourself."})

        follow_obj, created = AuthorFollow.objects.get_or_create(follower=request.user, author=author)
        if created:
            notify_follow_event(actor=request.user, author=author)
            create_audit_log(
                actor=request.user,
                action="author_followed",
                target_type="author_follow",
                target_id=follow_obj.id,
                description="Author followed",
                metadata={"author_id": author.id, "author_username": author.username},
                request=request,
            )
            bump_public_content_cache_version()

        return Response(
            {
                "is_following": True,
                "follower_count": _follower_count(author.id),
                "author_id": author.id,
            }
        )

    def delete(self, request, author_id: int):
        author = _get_author_or_404(author_id, viewer=request.user)
        deleted, _ = AuthorFollow.objects.filter(follower=request.user, author=author).delete()
        if deleted:
            create_audit_log(
                actor=request.user,
                action="author_unfollowed",
                target_type="author",
                target_id=author.id,
                description="Author unfollowed",
                metadata={"author_id": author.id, "author_username": author.username},
                request=request,
            )
            bump_public_content_cache_version()

        return Response(
            {
                "is_following": False,
                "follower_count": _follower_count(author.id),
                "author_id": author.id,
            }
        )


class AuthorFollowStateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, author_id: int):
        author = _get_author_or_404(author_id, viewer=request.user)
        is_following = False
        if request.user and request.user.is_authenticated:
            is_following = AuthorFollow.objects.filter(follower=request.user, author=author).exists()
        return Response(
            {
                "is_following": is_following,
                "follower_count": _follower_count(author.id),
            }
        )


class MyFollowingAuthorsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        public_books = Book.objects.filter(
            author_id=OuterRef("author_id"),
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        public_stories = Story.objects.filter(
            author_id=OuterRef("author_id"),
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        public_poems = Poem.objects.filter(
            author_id=OuterRef("author_id"),
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )

        queryset = (
            AuthorFollow.objects.filter(follower=request.user)
            .annotate(
                has_public_book=Exists(public_books),
                has_public_story=Exists(public_stories),
                has_public_poem=Exists(public_poems),
            )
            .filter(Q(has_public_book=True) | Q(has_public_story=True) | Q(has_public_poem=True))
            .select_related("author", "author__profile")
            .order_by("-created_at")
        )

        page = self.paginate_queryset(queryset)
        follows = list(page) if page is not None else list(queryset)

        author_ids = [follow.author_id for follow in follows]
        follower_count_map = {
            row["author_id"]: int(row["total"])
            for row in (
                AuthorFollow.objects.filter(author_id__in=author_ids)
                .values("author_id")
                .annotate(total=Count("id"))
            )
        }

        payload = []
        for follow in follows:
            row = _build_user_row(follow.author, followed_at=follow.created_at)
            payload.append(
                {
                    "author_id": row["user_id"],
                    "author_username": row["username"],
                    "author_display_name": row["display_name"],
                    "profile_photo": row["profile_photo"],
                    "followed_at": row["followed_at"],
                    "follower_count": follower_count_map.get(follow.author_id, 0),
                }
            )

        if page is not None:
            return self.get_paginated_response(payload)
        return Response(payload)


class AuthorFollowersView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, author_id: int):
        author = _get_author_or_404(
            author_id,
            viewer=request.user,
            allow_hidden_for_privileged=True,
        )
        follower_count = _follower_count(author.id)
        if not _is_privileged_user(request.user):
            return Response({"follower_count": follower_count})

        queryset = (
            AuthorFollow.objects.filter(author=author)
            .select_related("follower", "follower__profile")
            .order_by("-created_at")
        )
        page = self.paginate_queryset(queryset)
        follows = list(page) if page is not None else list(queryset)
        payload = [
            _build_user_row(follow.follower, followed_at=follow.created_at)
            for follow in follows
        ]

        if page is not None:
            response = self.get_paginated_response(payload)
            response.data["follower_count"] = follower_count
            return response

        return Response({"follower_count": follower_count, "results": payload})
