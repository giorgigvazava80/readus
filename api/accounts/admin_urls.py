from django.urls import path

from .views import AuditLogListView, RedactorDetailView, RedactorListCreateView

urlpatterns = [
    path("redactors/", RedactorListCreateView.as_view()),
    path("redactors/<int:pk>/", RedactorDetailView.as_view()),
    path("audit-logs/", AuditLogListView.as_view()),
]
