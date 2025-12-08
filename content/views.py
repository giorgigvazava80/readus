from rest_framework import viewsets, permissions

from .models import Story, Poem, Book, Chapter

from .serializers import (
    StorySerializer,
    PoemSerializer,
    BookSerializer,
    ChapterSerializer,
)

class IsAuthorOrReadOnly(permissions.BasePermission):

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        #Book, Poem, Story have author; chapter has book.author
        if hasattr(obj, 'author'):
            return obj.author == request.user
        if isinstance(obj, Chapter):
            return obj.book.author == request.user
        return False

class AuthorContentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

class StoryViewSet(AuthorContentViewSet):
    queryset = Story.objects.all()
    serializer_class = StorySerializer



class PoemViewSet(AuthorContentViewSet):
    queryset = Poem.objects.all()
    serializer_class = PoemSerializer

class BookViewSet(AuthorContentViewSet):
    queryset = Book.objects.all().prefetch_related('chapters')
    serializer_class = BookSerializer

class ChapterViewSet(viewsets.ModelViewSet):
    queryset = Chapter.objects.select_related('book', 'book__author')
    serializer_class = ChapterSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def perform_create(self, serializer):
        serializer.save()
