from django.urls import path

from .views import NotificationListView, NotificationMarkReadView, NotificationUnreadCountView, NotificationUpdateView

urlpatterns = [
    path("", NotificationListView.as_view()),
    path("mark-read/", NotificationMarkReadView.as_view()),
    path("unread-count/", NotificationUnreadCountView.as_view()),
    path("<int:pk>/", NotificationUpdateView.as_view()),
]
