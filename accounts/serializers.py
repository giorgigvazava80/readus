from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth.models import Group
from dj_rest_auth.registration.serializers import RegisterSerializer
from .models import WriterApplication
import os

# Group Names Constants
GROUP_WRITERS = "Writers"
GROUP_READERS = "Readers"
GROUP_REDACTORS = "Redactors"

class CustomRegisterSerializer(RegisterSerializer):
    role = serializers.ChoiceField(choices=[("writer", "Writer"), ("reader", "Reader")])
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)

    def get_cleaned_data(self):
        cleaned_data = super().get_cleaned_data()
        cleaned_data['first_name'] = self.validated_data.get('first_name', '')
        cleaned_data['last_name'] = self.validated_data.get('last_name', '')
        cleaned_data['role'] = self.validated_data.get('role', '')
        return cleaned_data

    def save(self, request):
        user = super().save(request)
        user.first_name = self.validated_data.get('first_name', '')
        user.last_name = self.validated_data.get('last_name', '')
        user.save()

        reader_group, _ = Group.objects.get_or_create(name=GROUP_READERS)
        user.groups.add(reader_group)

        return user

class WriterApplicationSerializer(serializers.ModelSerializer):
    sample_text = serializers.CharField(required=False, allow_blank=True)
    sample_file = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = WriterApplication
        fields = [
            'id',
            'sample_text',
            'sample_file',
            'status',
            'created_at',
            'reviewed_at',
            'review_comment',
        ]
        read_only_fields = [
            'status',
            'created_at',
            'reviewed_at',
            'review_comment',
        ]

    def validate_sample_file(self, value):
        if value:
            ext = os.path.splitext(value.name)[1].lower()
            valid_extensions = ['.pdf', '.doc', '.docx', '.txt']
            if ext not in valid_extensions:
                raise serializers.ValidationError("Unsupported file extension. Please use PDF, DOC, DOCX, or TXT.")
            
            # 5MB limit
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("File size too large. Max size is 5MB.")
        return value

    def validate(self, attrs):
        """
        Require exactly one of sample_text or sample_file.
        """
        text = attrs.get('sample_text')
        file = attrs.get('sample_file')

        if bool(text) == bool(file):
            raise serializers.ValidationError(
                "Provide exactly one of 'sample_text' or 'sample_file'."
            )
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user if request else None

        return WriterApplication.objects.create(
            user=user,
            **validated_data
        )


class WriterApplicationReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = WriterApplication
        fields = [
            'status',
            'review_comment',
        ]

    def update(self, instance, validated_data):
        request = self.context.get('request')

        instance.status = validated_data.get('status', instance.status)
        instance.review_comment = validated_data.get('review_comment', instance.review_comment)
        instance.reviewed_at = timezone.now()
        instance.save()

        if instance.status == 'approved':
            user = instance.user

            writer_group, _ = Group.objects.get_or_create(name=GROUP_WRITERS)
            reader_group, _ = Group.objects.get_or_create(name=GROUP_READERS)

            user.groups.remove(reader_group)
            user.groups.add(writer_group)

            user.is_active=True
            user.save()

        return instance