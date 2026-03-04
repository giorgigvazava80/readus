from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BookViewSet,
    ChapterViewSet,
    PoemViewSet,
    PublicAuthorDetailView,
    PublicAuthorListView,
    StoryViewSet,
)

router = DefaultRouter()
router.register('stories', StoryViewSet, basename='story')
router.register('poems', PoemViewSet, basename='poem')
router.register('books', BookViewSet, basename='book')
router.register('chapters', ChapterViewSet, basename='chapter')

urlpatterns = [
    path("authors/", PublicAuthorListView.as_view(), name="public-authors-list"),
    path("authors/<str:author_key>/", PublicAuthorDetailView.as_view(), name="public-authors-detail"),
    *router.urls,
]


