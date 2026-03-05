from django.urls import path

from .views import (
    AuthorFollowToggleView,
    CommentModerationView,
    ContentCommentsView,
    ContentReactionView,
    ContentViewEventCreateView,
    ContinueReadingView,
    FollowingFeedView,
    ReadingProgressDetailView,
    RecommendationsView,
    ShareImageView,
    ShareMetadataView,
    TrendingView,
    WriterAnalyticsView,
)

urlpatterns = [
    path("authors/<str:author_username>/follow/", AuthorFollowToggleView.as_view(), name="engagement-follow-toggle"),
    path("following/feed/", FollowingFeedView.as_view(), name="engagement-following-feed"),
    path("progress/continue-reading/", ContinueReadingView.as_view(), name="engagement-continue-reading"),
    path("content/<str:category>/<str:identifier>/progress/", ReadingProgressDetailView.as_view(), name="engagement-progress"),
    path("content/<str:category>/<str:identifier>/view/", ContentViewEventCreateView.as_view(), name="engagement-view"),
    path("content/<str:category>/<str:identifier>/like/", ContentReactionView.as_view(), name="engagement-like"),
    path("content/<str:category>/<str:identifier>/comments/", ContentCommentsView.as_view(), name="engagement-comments"),
    path("comments/<int:comment_id>/moderate/", CommentModerationView.as_view(), name="engagement-comment-moderate"),
    path("trending/", TrendingView.as_view(), name="engagement-trending"),
    path("recommendations/", RecommendationsView.as_view(), name="engagement-recommendations"),
    path("writer/analytics/", WriterAnalyticsView.as_view(), name="engagement-writer-analytics"),
    path("share/<str:category>/<str:identifier>/", ShareMetadataView.as_view(), name="engagement-share"),
    path(
        "share/<str:category>/<str:identifier>/image.svg",
        ShareImageView.as_view(),
        name="engagement-share-image",
    ),
]
