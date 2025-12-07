from django.shortcuts import render
from rest_framework import viewsets, permissions
from .models import Story, Poem, Book
from .serializers import StorySerializer, PoemSerializer, BookSerializer

class IsAuthorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        return  obj.author == request.user or request.user.is_staff


class