import os

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import connection

from accounts.constants import (
    GROUP_ADMINS,
    GROUP_REDACTORS,
    GROUP_WRITERS,
    REGISTERED_ROLE_WRITER,
    ROOT_DEFAULT_EMAIL,
    ROOT_DEFAULT_PASSWORD,
)
from accounts.models import RedactorPermission
from accounts.utils import ensure_default_groups, get_profile


class Command(BaseCommand):
    help = "Create or update root admin account and enforce password change on first login."

    def handle(self, *args, **options):
        existing_tables = set(connection.introspection.table_names())
        required_tables = {
            "auth_user",
            "accounts_userprofile",
            "accounts_redactorpermission",
            "account_emailaddress",
        }

        if not required_tables.issubset(existing_tables):
            self.stdout.write(self.style.WARNING("Skipping bootstrap_root: required tables are not available yet."))
            return

        user_model = get_user_model()

        email = os.getenv("ROOT_EMAIL", ROOT_DEFAULT_EMAIL)
        password = os.getenv("ROOT_PASSWORD", ROOT_DEFAULT_PASSWORD)
        username = os.getenv("ROOT_USERNAME", "root")
        reset_password = os.getenv("BOOTSTRAP_ROOT_RESET_PASSWORD", "0") == "1"
        force_password_change = os.getenv("BOOTSTRAP_FORCE_PASSWORD_CHANGE", "1") == "1"

        ensure_default_groups()

        user, created = user_model.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "is_active": True,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        fields_to_update = []
        if user.username != username and created:
            user.username = username
            fields_to_update.append("username")

        if not user.is_active:
            user.is_active = True
            fields_to_update.append("is_active")
        if not user.is_staff:
            user.is_staff = True
            fields_to_update.append("is_staff")
        if not user.is_superuser:
            user.is_superuser = True
            fields_to_update.append("is_superuser")

        if created or reset_password:
            user.set_password(password)
            fields_to_update.append("password")

        if fields_to_update:
            user.save(update_fields=fields_to_update)

        email_address, _ = EmailAddress.objects.get_or_create(
            user=user,
            email=email,
            defaults={"verified": True, "primary": True},
        )
        if not email_address.verified or not email_address.primary:
            email_address.verified = True
            email_address.primary = True
            email_address.save(update_fields=["verified", "primary"])

        admin_group, _ = Group.objects.get_or_create(name=GROUP_ADMINS)
        redactor_group, _ = Group.objects.get_or_create(name=GROUP_REDACTORS)
        writer_group, _ = Group.objects.get_or_create(name=GROUP_WRITERS)
        user.groups.add(admin_group, redactor_group, writer_group)

        permissions_obj, _ = RedactorPermission.objects.get_or_create(user=user)
        permissions_obj.can_review_writer_applications = True
        permissions_obj.can_review_content = True
        permissions_obj.can_manage_content = True
        permissions_obj.can_manage_redactors = True
        permissions_obj.is_active = True
        permissions_obj.save()

        profile = get_profile(user)
        profile.is_root = True
        profile.role_registered = REGISTERED_ROLE_WRITER
        profile.is_writer_approved = True
        if created or reset_password:
            profile.forced_password_change = force_password_change
        profile.save(
            update_fields=[
                "is_root",
                "role_registered",
                "is_writer_approved",
                "forced_password_change",
                "updated_at",
            ]
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Root account created: {email}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Root account ensured: {email}"))
