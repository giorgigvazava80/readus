from django.urls import path

from .views import MeContinueReadingView, ReadingProgressUpsertView


urlpatterns = [
    path("reading-progress/", ReadingProgressUpsertView.as_view(), name="reading-progress-upsert"),
    path("me/continue-reading/", MeContinueReadingView.as_view(), name="me-continue-reading"),
]
