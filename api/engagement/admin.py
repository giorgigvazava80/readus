from django.contrib import admin

from .models import AuthorFollow, ContentComment, ContentReaction, ContentViewEvent, ReadingProgress


@admin.register(AuthorFollow)
class AuthorFollowAdmin(admin.ModelAdmin):
    list_display = ("id", "follower", "author", "created_at")
    search_fields = ("follower__username", "author__username", "follower__email", "author__email")
    list_filter = ("created_at",)


@admin.register(ContentReaction)
class ContentReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "reaction", "content_type", "object_id", "created_at")
    search_fields = ("user__username", "user__email")
    list_filter = ("reaction", "content_type", "created_at")


@admin.register(ContentComment)
class ContentCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "content_type", "object_id", "parent", "is_hidden", "created_at")
    search_fields = ("user__username", "body")
    list_filter = ("is_hidden", "content_type", "created_at")


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "content_type", "object_id", "progress_percent", "completed", "updated_at")
    search_fields = ("user__username", "user__email")
    list_filter = ("completed", "content_type", "updated_at")


@admin.register(ContentViewEvent)
class ContentViewEventAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "anon_key", "content_type", "object_id", "created_at")
    search_fields = ("user__username", "anon_key")
    list_filter = ("content_type", "created_at")

