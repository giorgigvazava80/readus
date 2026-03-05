from django.urls import path

from .follow_views import AuthorFollowersView, AuthorFollowStateView, AuthorFollowView, MyFollowingAuthorsView


urlpatterns = [
    path("authors/<int:author_id>/follow/", AuthorFollowView.as_view(), name="author-follow"),
    path("authors/<int:author_id>/followers/", AuthorFollowersView.as_view(), name="author-followers"),
    path("authors/<int:author_id>/follow-state/", AuthorFollowStateView.as_view(), name="author-follow-state"),
    path("me/following/", MyFollowingAuthorsView.as_view(), name="me-following-authors"),
]
