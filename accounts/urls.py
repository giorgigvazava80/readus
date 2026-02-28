from django.urls import path

from .views import (
    CurrentUserStateView,
    MyWriterApplicationListView,
    PendingWriterApplicationListView,
    ReviewWriterApplicationView,
    WriterApplicationCreateView,
)

urlpatterns = [
    path("me/", CurrentUserStateView.as_view()),
    path("writer-application/", WriterApplicationCreateView.as_view()),
    path("writer-application/my/", MyWriterApplicationListView.as_view()),
    path("writer-application/pending/", PendingWriterApplicationListView.as_view()),
    path("writer-application/<int:pk>/review/", ReviewWriterApplicationView.as_view()),
]
