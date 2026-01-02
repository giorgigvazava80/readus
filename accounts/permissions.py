from rest_framework.permissions import BasePermission

class IsRedactor(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.groups.filter(name='Redactors').exists()
        )
