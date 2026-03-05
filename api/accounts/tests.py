from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from allauth.account.models import EmailAddress

from .models import Notification, WriterApplication, WriterApplicationStatus
from .utils import create_notification, get_profile


class NotificationApiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="notify_user",
            email="notify@example.com",
            password="Test1234!",
        )
        self.other_user = User.objects.create_user(
            username="notify_other",
            email="notify-other@example.com",
            password="Test1234!",
        )
        EmailAddress.objects.create(user=self.user, email=self.user.email, verified=True, primary=True)
        EmailAddress.objects.create(user=self.other_user, email=self.other_user.email, verified=True, primary=True)

        self.note_1 = Notification.objects.create(
            user=self.user,
            category=Notification.Category.SYSTEM,
            title="One",
            message="One",
            is_read=False,
        )
        self.note_2 = Notification.objects.create(
            user=self.user,
            category=Notification.Category.COMMENT,
            title="Two",
            message="Two",
            is_read=False,
        )
        self.note_3 = Notification.objects.create(
            user=self.user,
            category=Notification.Category.LIKE,
            title="Three",
            message="Three",
            is_read=False,
        )
        self.other_note = Notification.objects.create(
            user=self.other_user,
            category=Notification.Category.SYSTEM,
            title="Other",
            message="Other",
            is_read=False,
        )

    def test_mark_read_all_updates_all_user_notifications(self):
        self.client.force_authenticate(self.user)
        response = self.client.post("/api/notifications/mark-read/", {"all": True}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "all")
        self.assertEqual(response.data["updated"], 3)

        unread = self.client.get("/api/notifications/unread-count/")
        self.assertEqual(unread.status_code, 200)
        self.assertEqual(unread.data["unread_count"], 0)
        self.assertTrue(Notification.objects.filter(id=self.other_note.id, is_read=False).exists())

    def test_mark_read_ids_updates_only_selected_owned_notifications(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            "/api/notifications/mark-read/",
            {"ids": [self.note_1.id, self.note_2.id, self.other_note.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "ids")
        self.assertEqual(response.data["updated"], 2)

        self.note_1.refresh_from_db()
        self.note_2.refresh_from_db()
        self.note_3.refresh_from_db()
        self.other_note.refresh_from_db()
        self.assertTrue(self.note_1.is_read)
        self.assertTrue(self.note_2.is_read)
        self.assertFalse(self.note_3.is_read)
        self.assertFalse(self.other_note.is_read)

    def test_mark_read_ids_rejects_invalid_payload(self):
        self.client.force_authenticate(self.user)
        non_list = self.client.post("/api/notifications/mark-read/", {"ids": "1,2"}, format="json")
        self.assertEqual(non_list.status_code, 400)

        non_integer = self.client.post("/api/notifications/mark-read/", {"ids": [self.note_1.id, "abc"]}, format="json")
        self.assertEqual(non_integer.status_code, 400)


class WriterApplicationFlowTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="writer_app_user",
            email="writer-app@example.com",
            password="Test1234!",
        )
        self.other_user = User.objects.create_user(
            username="writer_app_other",
            email="writer-app-other@example.com",
            password="Test1234!",
        )
        EmailAddress.objects.create(user=self.user, email=self.user.email, verified=True, primary=True)
        EmailAddress.objects.create(user=self.other_user, email=self.other_user.email, verified=True, primary=True)

    def _submit_application(self, text="sample text"):
        return self.client.post(
            "/api/accounts/writer-application/",
            {"sample_text": text},
            format="multipart",
        )

    def test_cannot_submit_second_application_while_pending(self):
        self.client.force_authenticate(self.user)
        first = self._submit_application("first sample")
        self.assertEqual(first.status_code, 201)

        second = self._submit_application("second sample")
        self.assertEqual(second.status_code, 400)
        self.assertIn("pending", str(second.data).lower())

    def test_user_can_cancel_pending_and_submit_new_application(self):
        self.client.force_authenticate(self.user)
        first = self._submit_application("first sample")
        self.assertEqual(first.status_code, 201)
        first_id = first.data["id"]

        cancel = self.client.post(f"/api/accounts/writer-application/{first_id}/cancel/", {}, format="json")
        self.assertEqual(cancel.status_code, 200)
        self.assertEqual(cancel.data["status"], WriterApplicationStatus.CANCELED)

        next_submit = self._submit_application("second sample")
        self.assertEqual(next_submit.status_code, 201)

    def test_user_cannot_cancel_non_pending_application(self):
        app = WriterApplication.objects.create(
            user=self.user,
            sample_text="already reviewed",
            status=WriterApplicationStatus.REJECTED,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(f"/api/accounts/writer-application/{app.id}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_user_cannot_cancel_other_users_application(self):
        app = WriterApplication.objects.create(
            user=self.other_user,
            sample_text="other pending",
            status=WriterApplicationStatus.PENDING,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(f"/api/accounts/writer-application/{app.id}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 404)


class ProfileNationalityTests(APITestCase):
    def test_default_nationality_is_georgian(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="nat_default_user",
            email="nat-default@example.com",
            password="Test1234!",
        )
        profile = get_profile(user)
        self.assertEqual(profile.nationality, "georgian")

    def test_notification_prefers_georgian_when_nationality_is_georgian(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="nat_ka_user",
            email="nat-ka@example.com",
            password="Test1234!",
        )
        profile = get_profile(user)
        profile.nationality = "georgian"
        profile.save(update_fields=["nationality", "updated_at"])

        note = create_notification(
            user=user,
            category=Notification.Category.SYSTEM,
            title="English title",
            message="English message",
            title_ka="ქართული სათაური",
            message_ka="ქართული ტექსტი",
        )
        self.assertEqual(note.title, "ქართული სათაური")
        self.assertEqual(note.message, "ქართული ტექსტი")
