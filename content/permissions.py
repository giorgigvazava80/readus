from rest_framework import permissions

class IsRedactor(permissions.BasePermission):
    """
    Allows access only to users in the 'Redactor' group.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.groups.filter(name='Redactor').exists()
