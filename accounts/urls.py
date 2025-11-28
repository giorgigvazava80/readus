from django.urls import path
from .views import WriterApplicationCreateView, PendingWriterApplicationListView, ReviewWriterApplicationView

urlpatterns = [
    path("writer-application/", WriterApplicationCreateView.as_view()),
    path('writer-application/pending/', PendingWriterApplicationListView.as_view()),
    path('writer-application/<int:pk>/review/', ReviewWriterApplicationView.as_view()),
]