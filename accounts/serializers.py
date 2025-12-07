from django.utils import timezone
from django.utils.timezone import override
from rest_framework import serializers
from .models import WriterApplication
from django.contrib.auth.models import Group


from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers
from django.contrib.auth.models import Group

class CustomRegisterSerializer(RegisterSerializer):
    role = serializers.ChoiceField(choices=[("writer", "Writer"), ("reader", "Reader")])

    def save(self, request):
        user = super().save(request)

        reader_group, _ = Group.objects.get(name="Reader")
        user.groups.add(reader_group)

        return user

class WriterApplicationSerializer(serializers.ModelSerializer):
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
    @override
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

            writer_group = Group.objects.get(name='Writers')
            reader_group = Group.objects.get(name='Reader')

            user.groups.remove(reader_group)
            user.groups.add(writer_group)

            user.is_active=True
            user.save()

        return instance