from django.urls import path

from .views import NotificationListView, NotificationUpdateView

urlpatterns = [
    path("", NotificationListView.as_view()),
    path("<int:pk>/", NotificationUpdateView.as_view()),
]
