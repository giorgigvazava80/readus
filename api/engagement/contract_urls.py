from django.urls import path

from .contract_views import (
    AnalyticsOverviewView,
    AnalyticsWorkDetailView,
    AnalyticsWorksView,
    ChapterLikeStateView,
    CommentDeleteView,
    CommentHideView,
    CommentsApiView,
    DiscoverRecommendedView,
    DiscoverTrendingView,
    LikesApiView,
    ReferralVisitTrackView,
    ShareCardChapterPngView,
    ShareCardWorkPngView,
    ShareChapterHtmlView,
    ShareWorkHtmlView,
    WorkLikeStateView,
)

urlpatterns = [
    path("likes/", LikesApiView.as_view(), name="likes-api"),
    path("works/<int:work_id>/like-state/", WorkLikeStateView.as_view(), name="work-like-state"),
    path("chapters/<int:chapter_id>/like-state/", ChapterLikeStateView.as_view(), name="chapter-like-state"),
    path("comments/", CommentsApiView.as_view(), name="comments-api"),
    path("comments/<int:comment_id>/hide/", CommentHideView.as_view(), name="comment-hide"),
    path("comments/<int:comment_id>/", CommentDeleteView.as_view(), name="comment-delete"),
    path("discover/trending/", DiscoverTrendingView.as_view(), name="discover-trending"),
    path("discover/recommended/", DiscoverRecommendedView.as_view(), name="discover-recommended"),
    path("me/analytics/overview/", AnalyticsOverviewView.as_view(), name="analytics-overview"),
    path("me/analytics/works/", AnalyticsWorksView.as_view(), name="analytics-works"),
    path("me/analytics/works/<int:work_id>/", AnalyticsWorkDetailView.as_view(), name="analytics-work-detail"),
    path("share-card/work/<int:work_id>.png", ShareCardWorkPngView.as_view(), name="share-card-work-png"),
    path("share-card/chapter/<int:chapter_id>.png", ShareCardChapterPngView.as_view(), name="share-card-chapter-png"),
    path("share/work/<int:work_id>/", ShareWorkHtmlView.as_view(), name="share-work-html"),
    path("share/chapter/<int:chapter_id>/", ShareChapterHtmlView.as_view(), name="share-chapter-html"),
    path("referrals/visit/", ReferralVisitTrackView.as_view(), name="referral-visit-track"),
]
