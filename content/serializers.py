from rest_framework import serializers
from .models import Story, Poem, Book, Chapter

class StorySerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField()

    class Meta:
        model = Story
        fields = ['id', 'title', 'body', 'status', 'author', 'created_at', 'updated_at']
        read_only_fields = ['status', 'author', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        return Story.objects.create(author=user, **validated_data)

class PoemSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Poem
        fields = ['id', 'title', 'body', 'status', 'author', 'created_at', 'updated_at']
        read_only_fields = ['status', 'author', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        return Poem.objects.create(author=user, **validated_data)


class ChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chapter
        fields = ['id', 'order', 'title', 'body']


class BookSerializer(serializers.ModelSerializer):
    author = serializers.StringRelatedField(read_only=True)
    chapters = ChapterSerializer(many=True)


    class Meta:
        model = Book
        fields = [
            'id',
            'title',
            'foreword',
            'final_word',
            'status',
            'author',
            'chapters',
            'created_at',
            'updated_at',
        ]

        read_only_fields = ['status', 'author', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        chapter_data = validated_data.pop('chapters', [])

        if not chapter_data:
            raise serializers.ValidationError("A book must have at least one chapter")

        book = Book.objects.create(author=user, **validated_data)

        for i, chapter_data in enumerate(chapter_data, start=1):
            chapter_data.setdefault('order', i)
            chapter_data.objects.create(book=book, **chapter_data)

        return book