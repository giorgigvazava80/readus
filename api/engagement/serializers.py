from __future__ import annotations

from rest_framework import serializers

from content.serializers import sanitize_plain_text

from .models import CommentAnchorType, ContentComment, ReadingProgress
from .targets import extract_target_paragraphs


class ReadingProgressUpsertSerializer(serializers.Serializer):
    progress_percent = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    paragraph_index = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    cursor = serializers.CharField(required=False, allow_blank=True, max_length=120)
    last_position = serializers.JSONField(required=False)
    completed = serializers.BooleanField(required=False)

    def validate_progress_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Progress must be between 0 and 100.")
        return value

    def validate(self, attrs):
        target = self.context.get("target")
        paragraph_index = attrs.get("paragraph_index")
        if paragraph_index is not None and target is not None:
            paragraphs = extract_target_paragraphs(target)
            if paragraphs and paragraph_index >= len(paragraphs):
                raise serializers.ValidationError(
                    {"paragraph_index": f"Paragraph index must be lower than {len(paragraphs)}."}
                )

        progress = attrs.get("progress_percent")
        completed = attrs.get("completed")
        if completed and progress is None:
            attrs["progress_percent"] = 100

        if "last_position" in attrs and attrs["last_position"] is None:
            attrs["last_position"] = {}
        if "last_position" in attrs and not isinstance(attrs["last_position"], dict):
            raise serializers.ValidationError({"last_position": "Last position must be a JSON object."})

        return attrs


class ReadingProgressSerializer(serializers.ModelSerializer):
    target = serializers.SerializerMethodField()

    class Meta:
        model = ReadingProgress
        fields = [
            "id",
            "progress_percent",
            "paragraph_index",
            "cursor",
            "last_position",
            "completed",
            "started_at",
            "updated_at",
            "target",
        ]
        read_only_fields = ["id", "started_at", "updated_at", "target"]

    def get_target(self, _obj):
        # Views attach the normalized target payload explicitly after serialization.
        return None


class ReadingProgressByWorkUpsertSerializer(serializers.Serializer):
    work_id = serializers.IntegerField(min_value=1)
    chapter_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    work_type = serializers.ChoiceField(
        choices=[("books", "Books"), ("stories", "Stories"), ("poems", "Poems")],
        required=False,
    )
    progress_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    last_position = serializers.JSONField(required=False)

    def validate_progress_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("Progress must be between 0 and 100.")
        return value

    def validate(self, attrs):
        chapter_id = attrs.get("chapter_id")
        work_type = attrs.get("work_type")
        if chapter_id is not None and work_type and work_type != "books":
            raise serializers.ValidationError({"work_type": "work_type must be 'books' when chapter_id is provided."})

        last_position = attrs.get("last_position", {})
        if last_position is None:
            last_position = {}
        if not isinstance(last_position, dict):
            raise serializers.ValidationError({"last_position": "Last position must be a JSON object."})
        attrs["last_position"] = last_position
        return attrs


class ReactionSummarySerializer(serializers.Serializer):
    likes_count = serializers.IntegerField()
    liked_by_me = serializers.BooleanField()


class LikeToggleSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=[("work", "Work"), ("chapter", "Chapter")])
    target_id = serializers.IntegerField(min_value=1)
    work_type = serializers.ChoiceField(
        choices=[("books", "Books"), ("stories", "Stories"), ("poems", "Poems")],
        required=False,
    )

    def validate(self, attrs):
        target_type = attrs.get("target_type")
        work_type = attrs.get("work_type")
        if target_type == "chapter" and work_type:
            raise serializers.ValidationError({"work_type": "work_type is only supported for target_type='work'."})
        return attrs


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=4000)
    target_type = serializers.ChoiceField(choices=[("work", "Work"), ("chapter", "Chapter")], required=False)
    target_id = serializers.IntegerField(required=False, min_value=1)
    anchor_type = serializers.ChoiceField(
        choices=CommentAnchorType.choices,
        required=False,
        default=CommentAnchorType.PARAGRAPH,
    )
    anchor_key = serializers.CharField(required=False, allow_blank=True, max_length=120)
    parent_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    parent_comment = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    paragraph_index = serializers.IntegerField(required=False, allow_null=True, min_value=0)

    def validate_body(self, value):
        cleaned = sanitize_plain_text(value)
        if not cleaned:
            raise serializers.ValidationError("Comment body cannot be empty.")
        return cleaned

    def validate(self, attrs):
        target = self.context.get("target")
        parent = self.context.get("parent")
        anchor_type = attrs.get("anchor_type") or CommentAnchorType.PARAGRAPH
        anchor_key = (attrs.get("anchor_key") or "").strip()
        paragraph_index = attrs.get("paragraph_index")

        if parent and parent.is_hidden:
            raise serializers.ValidationError({"parent_id": "Cannot reply to a hidden comment."})

        if "parent_comment" in attrs and "parent_id" not in attrs:
            attrs["parent_id"] = attrs["parent_comment"]

        if anchor_type == CommentAnchorType.BLOCK and not anchor_key:
            raise serializers.ValidationError({"anchor_key": "Block comments require anchor_key."})

        if anchor_type == CommentAnchorType.PARAGRAPH:
            if anchor_key.startswith("p:"):
                suffix = anchor_key[2:].strip()
                if not suffix.isdigit():
                    raise serializers.ValidationError({"anchor_key": "Paragraph anchor must be in 'p:{index}' format."})
                paragraph_index = int(suffix)
                attrs["paragraph_index"] = paragraph_index
            elif anchor_key:
                raise serializers.ValidationError({"anchor_key": "Paragraph anchor_key must be in 'p:{index}' format."})
            elif paragraph_index is not None:
                attrs["anchor_key"] = f"p:{paragraph_index}"

        if paragraph_index is not None and target is not None:
            paragraphs = extract_target_paragraphs(target)
            if paragraphs and paragraph_index >= len(paragraphs):
                raise serializers.ValidationError(
                    {"paragraph_index": f"Paragraph index must be lower than {len(paragraphs)}."}
                )
            if anchor_type == CommentAnchorType.PARAGRAPH and not attrs.get("anchor_key"):
                attrs["anchor_key"] = f"p:{paragraph_index}"

        return attrs


class CommentQuerySerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=[("work", "Work"), ("chapter", "Chapter")])
    target_id = serializers.IntegerField(min_value=1)
    work_type = serializers.ChoiceField(
        choices=[("books", "Books"), ("stories", "Stories"), ("poems", "Poems")],
        required=False,
    )


class CommentModerationSerializer(serializers.Serializer):
    is_hidden = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_reason(self, value):
        return sanitize_plain_text(value)

    def validate(self, attrs):
        is_hidden = attrs.get("is_hidden", False)
        reason = (attrs.get("reason") or "").strip()
        if is_hidden and not reason:
            raise serializers.ValidationError({"reason": "Reason is required when hiding a comment."})
        attrs["reason"] = reason
        return attrs


class ContentCommentSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_display_name = serializers.SerializerMethodField()
    can_moderate = serializers.SerializerMethodField()
    can_view_hidden = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    parent_comment = serializers.IntegerField(source="parent_id", read_only=True)

    class Meta:
        model = ContentComment
        fields = [
            "id",
            "parent_comment",
            "user_username",
            "user_display_name",
            "body",
            "anchor_type",
            "anchor_key",
            "paragraph_index",
            "excerpt",
            "is_hidden",
            "hidden_reason",
            "created_at",
            "updated_at",
            "can_moderate",
            "can_view_hidden",
            "replies",
        ]

    def _viewer_can_moderate(self) -> bool:
        return bool(self.context.get("viewer_can_moderate"))

    def _viewer_can_view_hidden(self, obj) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        return self._viewer_can_moderate() or bool(user and user.is_authenticated and user.id == obj.user_id)

    def get_user_display_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.username

    def get_can_moderate(self, _obj):
        return self._viewer_can_moderate()

    def get_can_view_hidden(self, obj):
        return self._viewer_can_view_hidden(obj)

    def get_body(self, obj):
        if obj.is_hidden and not self._viewer_can_view_hidden(obj):
            return "[Comment hidden by moderator]"
        return obj.body

    def get_replies(self, obj):
        reply_qs = obj.replies.select_related("user").order_by("created_at")
        if not self._viewer_can_moderate():
            reply_qs = reply_qs.filter(is_hidden=False)
        return ContentCommentSerializer(reply_qs, many=True, context=self.context).data
