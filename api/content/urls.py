
from rest_framework.routers import DefaultRouter

from .views import PoemViewSet, BookViewSet, ChapterViewSet, StoryViewSet

router = DefaultRouter()
router.register('stories', StoryViewSet, basename='story')
router.register('poems', PoemViewSet, basename='poem')
router.register('books', BookViewSet, basename='book')
router.register('chapters', ChapterViewSet, basename='chapter')

urlpatterns = router.urls


