from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models


TARGET_MODELS = ("book", "story", "poem", "chapter")


class AuthorFollow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following_authors",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="author_followers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "author"], name="uniq_author_follow"),
            models.CheckConstraint(
                check=~models.Q(follower=models.F("author")),
                name="author_follow_no_self_follow",
            ),
        ]
        indexes = [
            models.Index(fields=["author", "-created_at"]),
            models.Index(fields=["follower", "-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.follower_id}->{self.author_id}"


class EngagementTargetMixin(models.Model):
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        limit_choices_to=models.Q(app_label="content", model__in=TARGET_MODELS),
    )
    object_id = models.PositiveBigIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
        ]


class ReactionType(models.TextChoices):
    LIKE = "like", "Like"


class CommentAnchorType(models.TextChoices):
    BLOCK = "block", "Block"
    PARAGRAPH = "paragraph", "Paragraph"


class ContentReaction(EngagementTargetMixin):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_reactions",
    )
    reaction = models.CharField(max_length=20, choices=ReactionType.choices, default=ReactionType.LIKE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta(EngagementTargetMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["user", "content_type", "object_id", "reaction"],
                name="uniq_content_reaction",
            ),
        ]
        indexes = EngagementTargetMixin.Meta.indexes + [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["content_type", "object_id", "reaction", "-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id}:{self.reaction}:{self.content_type_id}:{self.object_id}"


class ReadingProgress(EngagementTargetMixin):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reading_progress_items",
    )
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    chapter = models.ForeignKey(
        "content.Chapter",
        on_delete=models.SET_NULL,
        related_name="reading_progress_entries",
        blank=True,
        null=True,
    )
    paragraph_index = models.PositiveIntegerField(blank=True, null=True)
    cursor = models.CharField(max_length=120, blank=True)
    last_position = models.JSONField(default=dict, blank=True)
    completed = models.BooleanField(default=False)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(EngagementTargetMixin.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["user", "content_type", "object_id"],
                name="uniq_reading_progress",
            ),
        ]
        indexes = EngagementTargetMixin.Meta.indexes + [
            models.Index(fields=["user", "-updated_at"]),
            models.Index(fields=["content_type", "object_id", "-updated_at"]),
            models.Index(fields=["completed", "-updated_at"]),
            models.Index(fields=["content_type", "object_id", "progress_percent", "-updated_at"]),
        ]
        ordering = ["-updated_at"]

    def clean(self):
        super().clean()
        if self.progress_percent < 0 or self.progress_percent > 100:
            raise ValidationError({"progress_percent": "Progress percent must be between 0 and 100."})

        if self.chapter_id:
            if self.content_type.model != "chapter" or self.object_id != self.chapter_id:
                raise ValidationError(
                    {"chapter": "When chapter is set, progress target must be the same chapter."}
                )

    def __str__(self):
        return f"{self.user_id}:{self.content_type_id}:{self.object_id}:{self.progress_percent}"


class ContentViewEvent(EngagementTargetMixin):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="content_view_events",
        blank=True,
        null=True,
    )
    anon_key = models.CharField(max_length=64, blank=True)
    paragraph_index = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta(EngagementTargetMixin.Meta):
        indexes = EngagementTargetMixin.Meta.indexes + [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["anon_key", "-created_at"]),
            models.Index(fields=["content_type", "object_id", "-created_at"]),
        ]
        ordering = ["-created_at"]

    def clean(self):
        super().clean()
        if not self.user_id and not self.anon_key:
            raise ValidationError("Either user or anon_key must be provided for a view event.")


class ContentComment(EngagementTargetMixin):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="content_comments",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="replies",
    )
    body = models.TextField()
    anchor_type = models.CharField(
        max_length=20,
        choices=CommentAnchorType.choices,
        default=CommentAnchorType.PARAGRAPH,
        db_index=True,
    )
    anchor_key = models.CharField(max_length=120, blank=True, default="", db_index=True)
    paragraph_index = models.PositiveIntegerField(blank=True, null=True, db_index=True)
    excerpt = models.TextField(blank=True)
    is_hidden = models.BooleanField(default=False, db_index=True)
    hidden_reason = models.TextField(blank=True)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="moderated_content_comments",
    )
    hidden_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(EngagementTargetMixin.Meta):
        indexes = EngagementTargetMixin.Meta.indexes + [
            models.Index(fields=["parent", "-created_at"]),
            models.Index(fields=["content_type", "object_id", "paragraph_index", "-created_at"]),
            models.Index(fields=["content_type", "object_id", "anchor_type", "anchor_key", "-created_at"]),
            models.Index(fields=["is_hidden", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]
        ordering = ["created_at"]

    def clean(self):
        super().clean()
        if not (self.body or "").strip():
            raise ValidationError({"body": "Comment body cannot be empty."})
        if self.anchor_type == CommentAnchorType.PARAGRAPH and not self.anchor_key:
            if self.paragraph_index is None and not self.parent_id:
                raise ValidationError({"anchor_key": "Paragraph comments require an anchor key or paragraph index."})
            if self.paragraph_index is not None:
                self.anchor_key = f"p:{self.paragraph_index}"
        if self.anchor_type == CommentAnchorType.BLOCK and not self.anchor_key:
            raise ValidationError({"anchor_key": "Block comments require a block anchor key."})

        if self.parent_id:
            if self.parent_id == self.id:
                raise ValidationError({"parent": "Comment cannot be parent of itself."})
            if (
                self.parent.content_type_id != self.content_type_id
                or self.parent.object_id != self.object_id
            ):
                raise ValidationError({"parent": "Reply parent must target the same content item."})

    def __str__(self):
        return f"{self.user_id}:{self.content_type_id}:{self.object_id}:{self.id}"


class ReferralVisit(models.Model):
    ref_code = models.CharField(max_length=64, db_index=True)
    visitor_id = models.CharField(max_length=120, db_index=True)
    first_seen_at = models.DateTimeField(auto_now_add=True, db_index=True)
    converted_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="referral_visits_converted",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ref_code", "visitor_id"],
                name="uniq_referral_ref_code_visitor",
            ),
        ]
        indexes = [
            models.Index(fields=["ref_code", "-first_seen_at"]),
            models.Index(fields=["visitor_id", "-first_seen_at"]),
            models.Index(fields=["converted_user", "-first_seen_at"]),
        ]
        ordering = ["-first_seen_at"]

    def __str__(self):
        return f"{self.ref_code}:{self.visitor_id}"
