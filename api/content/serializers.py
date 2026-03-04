import os
from html import unescape

import bleach
from bleach.css_sanitizer import CSSSanitizer
from rest_framework import serializers

from accounts.utils import is_admin_user
from .file_extract import extract_text_from_upload
from .models import Book, Chapter, Poem, SourceType, StatusChoices, Story


ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt"}
ALLOWED_COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024
MAX_COVER_SIZE_BYTES = 5 * 1024 * 1024

ALLOWED_RICH_TEXT_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "div",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "img",
]

ALLOWED_RICH_TEXT_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title"],
    "p": ["style", "align"],
    "div": ["style", "align"],
    "span": ["style"],
    "td": ["colspan", "rowspan", "style"],
    "th": ["colspan", "rowspan", "style"],
}

ALLOWED_RICH_TEXT_STYLES = [
    "color",
    "background-color",
    "text-align",
    "margin-left",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-decoration",
]

RICH_TEXT_CSS_SANITIZER = CSSSanitizer(allowed_css_properties=ALLOWED_RICH_TEXT_STYLES)


def sanitize_plain_text(value: str) -> str:
    cleaned = bleach.clean(value or "", tags=[], attributes={}, strip=True).strip()
    return unescape(cleaned)


def sanitize_rich_html(value: str) -> str:
    return bleach.clean(
        value or "",
        tags=ALLOWED_RICH_TEXT_TAGS,
        attributes=ALLOWED_RICH_TEXT_ATTRIBUTES,
        protocols=["http", "https", "mailto", "data"],
        strip=True,
        css_sanitizer=RICH_TEXT_CSS_SANITIZER,
    ).strip()


class ContentValidationMixin(serializers.ModelSerializer):
    def validate_upload_file(self, value):
        if not value:
            return value

        ext = os.path.splitext(value.name)[1].lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise serializers.ValidationError("Unsupported file type. Allowed: PDF, DOC, DOCX, TXT.")

        if value.size > MAX_UPLOAD_SIZE_BYTES:
            raise serializers.ValidationError("File is too large. Maximum file size is 20MB.")

        return value

    def validate_cover_image(self, value):
        if not value:
            return value

        ext = os.path.splitext(value.name)[1].lower()
        if ext not in ALLOWED_COVER_EXTENSIONS:
            raise serializers.ValidationError("Unsupported image type. Allowed: JPG, PNG, WEBP, GIF.")

        if value.size > MAX_COVER_SIZE_BYTES:
            raise serializers.ValidationError("Cover image is too large. Maximum size is 5MB.")

        return value

    def validate(self, attrs):
        """
        Enforce:
        - manual: upload_file must be empty; body required only for serializers that expose body
        - upload: upload_file is required
        """
        instance = self.instance
        source_type = attrs.get("source_type", getattr(instance, "source_type", SourceType.MANUAL))
        supports_body = "body" in self.fields

        body = None
        if supports_body:
            body = attrs.get("body", getattr(instance, "body", None))

        upload_file = attrs.get("upload_file", getattr(instance, "upload_file", None))

        if source_type == SourceType.MANUAL:
            if supports_body and body is None:
                raise serializers.ValidationError({"body": "When source_type is 'manual', body is required."})
            if upload_file and "upload_file" in attrs:
                raise serializers.ValidationError(
                    {"upload_file": "When source_type is 'manual', upload_file must be empty."}
                )

        elif source_type == SourceType.UPLOAD:
            if not upload_file:
                raise serializers.ValidationError(
                    {"upload_file": "When source_type is 'upload', upload_file is required."}
                )

        else:
            if supports_body and not body and not upload_file:
                raise serializers.ValidationError("You must provide either body or upload_file.")

        return attrs

    def _sync_extracted_text(self, instance):
        if instance.source_type != SourceType.UPLOAD or not instance.upload_file:
            next_value = ""
        else:
            next_value = sanitize_plain_text(extract_text_from_upload(instance.upload_file))

        current = instance.extracted_text or ""
        if next_value != current:
            instance.extracted_text = next_value
            instance.save(update_fields=["extracted_text", "updated_at"])

    def _can_view_real_author(self, obj):
        if not getattr(obj, "is_anonymous", False):
            return True

        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        return bool(user and user.is_authenticated and is_admin_user(user))

    def _public_author_name(self):
        return "Anonymous"

    class Meta:
        abstract = True


class StorySerializer(ContentValidationMixin):
    author_username = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = [
            "id",
            "public_slug",
            "title",
            "description",
            "is_anonymous",
            "is_hidden",
            "body",
            "source_type",
            "upload_file",
            "cover_image",
            "extracted_text",
            "author_username",
            "author_name",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "public_slug",
            "extracted_text",
            "author_username",
            "author_name",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def get_author_username(self, obj):
        if not self._can_view_real_author(obj):
            return self._public_author_name()
        return obj.author.username

    def get_author_name(self, obj):
        if not self._can_view_real_author(obj):
            return self._public_author_name()
        full_name = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return full_name or obj.author.username

    def validate_title(self, value):
        return sanitize_plain_text(value)

    def validate_description(self, value):
        return sanitize_rich_html(value)

    def validate_body(self, value):
        return sanitize_rich_html(value)

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["author"] = request.user
        instance = super().create(validated_data)
        self._sync_extracted_text(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._sync_extracted_text(instance)
        return instance


class PoemSerializer(ContentValidationMixin):
    author_username = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Poem
        fields = [
            "id",
            "public_slug",
            "title",
            "description",
            "is_anonymous",
            "is_hidden",
            "body",
            "source_type",
            "upload_file",
            "cover_image",
            "extracted_text",
            "author_username",
            "author_name",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "public_slug",
            "extracted_text",
            "author_username",
            "author_name",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def get_author_username(self, obj):
        if not self._can_view_real_author(obj):
            return self._public_author_name()
        return obj.author.username

    def get_author_name(self, obj):
        if not self._can_view_real_author(obj):
            return self._public_author_name()
        full_name = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return full_name or obj.author.username

    def validate_title(self, value):
        return sanitize_plain_text(value)

    def validate_description(self, value):
        return sanitize_rich_html(value)

    def validate_body(self, value):
        return sanitize_rich_html(value)

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["author"] = request.user
        instance = super().create(validated_data)
        self._sync_extracted_text(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._sync_extracted_text(instance)
        return instance


class ChapterSerializer(serializers.ModelSerializer):
    auto_label = serializers.ReadOnlyField()

    class Meta:
        model = Chapter
        fields = [
            "id",
            "book",
            "title",
            "order",
            "body",
            "auto_label",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def validate_title(self, value):
        return sanitize_plain_text(value)

    def validate_body(self, value):
        return sanitize_rich_html(value)


class BookChapterCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ["title", "order", "body"]

    def validate_title(self, value):
        return sanitize_plain_text(value)

    def validate_body(self, value):
        return sanitize_rich_html(value)


class BookSerializer(ContentValidationMixin):
    author_username = serializers.SerializerMethodField()
    author_name = serializers.SerializerMethodField()
    chapters = serializers.SerializerMethodField()
    has_draft_chapters = serializers.SerializerMethodField()
    new_chapters = BookChapterCreateSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Book
        fields = [
            "id",
            "public_slug",
            "title",
            "description",
            "is_anonymous",
            "is_hidden",
            "foreword",
            "afterword",
            "numbering_style",
            "source_type",
            "upload_file",
            "cover_image",
            "extracted_text",
            "author_username",
            "author_name",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
            "chapters",
            "has_draft_chapters",
            "new_chapters",
        ]
        read_only_fields = [
            "public_slug",
            "extracted_text",
            "author_username",
            "author_name",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def get_author_username(self, obj):
        if not self._can_view_real_author(obj):
            return self._public_author_name()
        return obj.author.username

    def get_author_name(self, obj):
        if not self._can_view_real_author(obj):
            return self._public_author_name()
        full_name = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return full_name or obj.author.username

    def get_chapters(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        chapters = obj.chapters.all()

        if user and user.is_authenticated:
            from accounts.utils import can_manage_content, can_review_content
            if can_manage_content(user) or can_review_content(user) or obj.author == user:
                return ChapterSerializer(chapters, many=True, context=self.context).data

        approved_chapters = [c for c in chapters if c.status == StatusChoices.APPROVED]
        return ChapterSerializer(approved_chapters, many=True, context=self.context).data

    def get_has_draft_chapters(self, obj):
        return obj.chapters.filter(status=StatusChoices.DRAFT).exists()

    def validate_title(self, value):
        return sanitize_plain_text(value)

    def validate_description(self, value):
        return sanitize_rich_html(value)

    def validate_foreword(self, value):
        return sanitize_rich_html(value)

    def validate_afterword(self, value):
        return sanitize_rich_html(value)

    def create(self, validated_data):
        request = self.context.get("request")
        author = request.user

        chapters_data = validated_data.pop("new_chapters", [])
        book = Book.objects.create(author=author, **validated_data)

        for index, chapter_data in enumerate(chapters_data, start=1):
            chapter_data.setdefault("order", index)
            Chapter.objects.create(book=book, **chapter_data)

        self._sync_extracted_text(book)
        return book

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self._sync_extracted_text(instance)
        return instance


class ContentReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            (StatusChoices.APPROVED, "Approved"),
            (StatusChoices.REJECTED, "Rejected"),
        ]
    )
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        status = attrs.get("status")
        rejection_reason = sanitize_plain_text(attrs.get("rejection_reason", ""))

        if status == StatusChoices.REJECTED and not rejection_reason:
            raise serializers.ValidationError(
                {"rejection_reason": "Rejection reason is required when status is 'rejected'."}
            )

        attrs["rejection_reason"] = rejection_reason
        return attrs
