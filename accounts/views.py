from rest_framework import generics, permissions
from .models import WriterApplication
from .serializers import WriterApplicationSerializer
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.contrib.auth.models import Group
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_yasg.utils import swagger_auto_schema

from .models import WriterApplication
from .serializers import WriterApplicationSerializer, WriterApplicationReviewSerializer
from .permissions import IsRedactor


class WriterApplicationCreateView(generics.CreateAPIView):
    queryset = WriterApplication.objects.all()
    serializer_class = WriterApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        serializer.save()

    @swagger_auto_schema(
        operation_description="Create a writer application by providing exactly one of 'sample_text' or 'sample_file' (not both).",
        request_body=WriterApplicationSerializer,
        consumes=['multipart/form-data', 'application/json']
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

class PendingWriterApplicationListView(generics.ListAPIView):
    queryset = WriterApplication.objects.filter(status='pending')
    serializer_class = WriterApplicationSerializer
    permission_classes = [IsAuthenticated, IsRedactor]

class ReviewWriterApplicationView(generics.UpdateAPIView):
    queryset = WriterApplication.objects.all()
    serializer_class = WriterApplicationReviewSerializer
    permission_classes = [IsAuthenticated, IsRedactor]

