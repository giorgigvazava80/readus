from rest_framework import serializers
from .models import Story, Poem, Book, Chapter, SourceType, StatusChoices


class validate(serializers.ModelSerializer):
    def validate(self, attrs):
        """
        Enforce:
        - manual  -> body required, upload_file must be empty
        - upload  -> upload_file required, body optional
        """

        # when updating, get old values from instance if not in attrs
        instance = self.instance
        source_type = attrs.get(
            "source_type",
            getattr(instance, "source_type", None),
        )
        body = attrs.get("body", getattr(instance, "body", None))
        upload_file = attrs.get("upload_file", getattr(instance, "upload_file", None))

        if source_type == SourceType.MANUAL:
            if not body:
                raise serializers.ValidationError(
                    {"body": "When source_type is 'manual', body is required."}
                )
            if upload_file:
                raise serializers.ValidationError(
                    {"upload_file": "When source_type is 'manual', upload_file must be empty."}
                )

        elif source_type == SourceType.UPLOAD:
            if not upload_file:
                raise serializers.ValidationError(
                    {"upload_file": "When source_type is 'upload', upload_file is required."}
                )
            # body is optional here

        else:
            # fallback: at least one is required if source_type missing/broken
            if not body and not upload_file:
                raise serializers.ValidationError(
                    "You must provide either body or upload_file."
                )

        return attrs

    class Meta:
        abstract = True

class StorySerializer(validate):
    class Meta:
        model = Story
        fields = [
            "id",
            "title",
            "description",
            "body",
            "source_type",
            "upload_file",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user
        return super().create(validated_data)

class PoemSerializer(validate):
    class Meta:
        model = Poem
        fields = [
            "id",
            "title",
            "description",
            "body",
            "source_type",
            "upload_file",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user
        return super().create(validated_data)


#----------chapters and books-----------

class ChapterSerializer(serializers.ModelSerializer):
    auto_label = serializers.ReadOnlyField()

    class Meta:
        model = Chapter
        fields = [
            "id",
            "book",
            "title",
            "order",
            "body",
            "auto_label",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

class BookChapterCreateSerializer(serializers.ModelSerializer):
    """when creating/updating a book with chapters"""

    class Meta:
        model = Chapter
        fields = ['title', 'order', 'body']


class BookSerializer(validate):
    chapters = ChapterSerializer(many=True, read_only=True)

    new_chapters = BookChapterCreateSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "description",
            "foreword",
            "afterword",
            "numbering_style",
            "source_type",
            "upload_file",
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
            "chapters",
            "new_chapters",
        ]
        read_only_fields = [
            "status",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        author = request.user

        chapters_data = validated_data.pop('new_chapters', [])
        book = Book.objects.create(author=author, **validated_data)

        #if no chapter is create, it's ok. we can add later
        for i, chapter_data in enumerate(chapters_data, start=1):
            #if no order, auto
            chapter_data.setdefault('order', i)
            Chapter.objects.create(book=book, **chapter_data)

        return book


class ContentReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        (StatusChoices.APPROVED, 'Approved'),
        (StatusChoices.REJECTED, 'Rejected')
    ])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        status = attrs.get('status')
        rejection_reason = attrs.get('rejection_reason')

        if status == StatusChoices.REJECTED and not rejection_reason:
            raise serializers.ValidationError(
                {"rejection_reason": "Rejection reason is required when status is 'rejected'."}
            )
        return attrs