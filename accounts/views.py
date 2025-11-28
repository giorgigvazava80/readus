from rest_framework import generics, permissions
from .models import WriterApplication
from .serializers import WriterApplicationSerializer
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.contrib.auth.models import Group

from .models import WriterApplication
from .serializers import WriterApplicationSerializer, WriterApplicationReviewSerializer
from .permissions import IsRedactor


class WriterApplicationCreateView(generics.CreateAPIView):
    queryset = WriterApplication.objects.all()
    serializer_class = WriterApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save()

class PendingWriterApplicationListView(generics.ListAPIView):
    queryset = WriterApplication.objects.filter(status='pending')
    serializer_class = WriterApplicationSerializer
    permission_classes = [IsAuthenticated, IsRedactor]

class ReviewWriterApplicationView(generics.UpdateAPIView):
    queryset = WriterApplication.objects.all()
    serializer_class = WriterApplicationReviewSerializer
    permission_classes = [IsAuthenticated, IsRedactor]

