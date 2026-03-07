from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APITestCase

from allauth.account.models import EmailAddress
from accounts.constants import GROUP_REDACTORS
from accounts.models import RedactorPermission
from accounts.utils import get_profile
from content.models import (
    Book,
    Chapter,
    ContentLanguageChoices,
    Poem,
    SourceType,
    StatusChoices,
    Story,
    UploadProcessingStatus,
)
from content.legacy_font_convert import detect_pdf_has_acadnusx_font, maybe_convert_acadnusx_to_unicode
from content.serializers import ChapterSerializer, sanitize_plain_text
from content.upload_processing import process_book_upload, split_text_into_chapters


class PublicAuthorApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.alice = User.objects.create_user(
            username="alice",
            email="alice@example.com",
            password="Test1234!",
            first_name="Alice",
            last_name="Writer",
        )
        self.bob = User.objects.create_user(
            username="bob",
            email="bob@example.com",
            password="Test1234!",
            first_name="Bob",
            last_name="Poet",
        )
        EmailAddress.objects.create(user=self.alice, email=self.alice.email, verified=True, primary=True)
        EmailAddress.objects.create(user=self.bob, email=self.bob.email, verified=True, primary=True)

        self.alice_book = Book.objects.create(
            author=self.alice,
            title="Alice Book",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=False,
        )
        self.alice_story = Story.objects.create(
            author=self.alice,
            title="Alice Story",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=False,
            body="Visible story",
        )
        self.alice_secret_poem = Poem.objects.create(
            author=self.alice,
            title="Alice Secret Poem",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=True,
            body="Anonymous poem",
        )
        self.bob_poem = Poem.objects.create(
            author=self.bob,
            title="Bob Poem",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=False,
            body="Visible poem",
        )
        Story.objects.create(
            author=self.bob,
            title="Bob Hidden Story",
            status=StatusChoices.APPROVED,
            is_hidden=True,
            is_anonymous=False,
            body="Hidden",
        )
        Book.objects.create(
            author=self.bob,
            title="Bob Draft Book",
            status=StatusChoices.DRAFT,
            is_hidden=False,
            is_anonymous=False,
        )

    def _authors_results(self):
        response = self.client.get("/api/content/authors/")
        self.assertEqual(response.status_code, 200)
        return response.data["results"]

    def _author_row(self, author_key: str):
        for row in self._authors_results():
            if row["key"] == author_key:
                return row
        self.fail(f"Author key '{author_key}' not found in list response.")

    def test_authors_list_includes_only_public_approved_visible_works(self):
        results = self._authors_results()
        keys = {row["key"] for row in results}
        self.assertSetEqual(keys, {"alice", "bob", "anonymous"})

        alice = self._author_row("alice")
        bob = self._author_row("bob")
        self.assertEqual(alice["works_count"], 2)
        self.assertEqual(bob["works_count"], 1)

    def test_authors_list_includes_anonymous_aggregate_row(self):
        anonymous = self._author_row("anonymous")
        self.assertTrue(anonymous["is_anonymous"])
        self.assertIsNone(anonymous["username"])
        self.assertEqual(anonymous["books_count"], 0)
        self.assertEqual(anonymous["stories_count"], 0)
        self.assertEqual(anonymous["poems_count"], 1)
        self.assertEqual(anonymous["works_count"], 1)

    def test_author_detail_username_excludes_anonymous_works(self):
        response = self.client.get("/api/content/authors/alice/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["key"], "alice")
        self.assertFalse(response.data["is_anonymous"])
        self.assertEqual(response.data["works_count"], 2)
        self.assertEqual(response.data["books_count"], 1)
        self.assertEqual(response.data["stories_count"], 1)
        self.assertEqual(response.data["poems_count"], 0)

    def test_author_detail_anonymous_contains_only_anonymous_works(self):
        response = self.client.get("/api/content/authors/anonymous/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["key"], "anonymous")
        self.assertTrue(response.data["is_anonymous"])
        self.assertEqual(response.data["works_count"], 1)
        self.assertEqual(response.data["books_count"], 0)
        self.assertEqual(response.data["stories_count"], 0)
        self.assertEqual(response.data["poems_count"], 1)

    def test_content_list_filter_by_author_username_excludes_anonymous_works(self):
        response = self.client.get("/api/content/stories/?author=alice")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        item = response.data["results"][0]
        self.assertEqual(item["title"], "Alice Story")
        self.assertEqual(item["author_key"], "alice")
        self.assertFalse(item["is_anonymous"])

        poem_response = self.client.get("/api/content/poems/?author=alice")
        self.assertEqual(poem_response.status_code, 200)
        self.assertEqual(poem_response.data["count"], 0)

    def test_content_list_filter_by_anonymous_returns_only_anonymous_items(self):
        response = self.client.get("/api/content/poems/?author=anonymous")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        item = response.data["results"][0]
        self.assertEqual(item["title"], "Alice Secret Poem")
        self.assertTrue(item["is_anonymous"])
        self.assertEqual(item["author_key"], "anonymous")

    def test_unknown_author_detail_returns_404(self):
        response = self.client.get("/api/content/authors/not-real/")
        self.assertEqual(response.status_code, 404)

    def test_public_authors_cache_hits_and_invalidates_after_content_update(self):
        first = self.client.get("/api/content/authors/")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.headers.get("X-Cache"), "MISS")

        second = self.client.get("/api/content/authors/")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.headers.get("X-Cache"), "HIT")

        profile = get_profile(self.bob)
        profile.is_writer_approved = True
        profile.save(update_fields=["is_writer_approved", "updated_at"])

        self.client.force_authenticate(self.bob)
        update = self.client.patch(
            f"/api/content/poems/{self.bob_poem.id}/",
            {"is_hidden": True},
            format="json",
        )
        self.assertEqual(update.status_code, 200)
        self.client.force_authenticate(None)

        third = self.client.get("/api/content/authors/")
        self.assertEqual(third.status_code, 200)
        self.assertEqual(third.headers.get("X-Cache"), "MISS")
        keys = {row["key"] for row in third.data["results"]}
        self.assertNotIn("bob", keys)


class RecycleBinApiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.writer = User.objects.create_user(
            username="writer1",
            email="writer1@example.com",
            password="Test1234!",
            first_name="Writer",
            last_name="One",
        )
        EmailAddress.objects.create(user=self.writer, email=self.writer.email, verified=True, primary=True)
        profile = get_profile(self.writer)
        profile.is_writer_approved = True
        profile.save(update_fields=["is_writer_approved", "updated_at"])

        self.story = Story.objects.create(
            author=self.writer,
            title="Soft delete story",
            body="Body",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=False,
        )

        self.client.force_authenticate(self.writer)

    def test_delete_moves_item_to_recycle_bin_and_excludes_from_default_list(self):
        delete_response = self.client.delete(f"/api/content/stories/{self.story.id}/")
        self.assertEqual(delete_response.status_code, 204)

        self.story.refresh_from_db()
        self.assertTrue(self.story.is_deleted)
        self.assertIsNotNone(self.story.deleted_at)

        normal_list = self.client.get("/api/content/stories/?mine=1")
        self.assertEqual(normal_list.status_code, 200)
        self.assertEqual(normal_list.data["count"], 0)

        deleted_list = self.client.get("/api/content/stories/?mine=1&deleted=1")
        self.assertEqual(deleted_list.status_code, 200)
        self.assertEqual(deleted_list.data["count"], 1)
        self.assertTrue(deleted_list.data["results"][0]["is_deleted"])

    def test_restore_returns_item_from_recycle_bin_to_normal_list(self):
        self.client.delete(f"/api/content/stories/{self.story.id}/")

        restore_response = self.client.post(f"/api/content/stories/{self.story.id}/restore/")
        self.assertEqual(restore_response.status_code, 200)
        self.assertFalse(restore_response.data["is_deleted"])

        self.story.refresh_from_db()
        self.assertFalse(self.story.is_deleted)
        self.assertIsNone(self.story.deleted_at)

        normal_list = self.client.get("/api/content/stories/?mine=1")
        self.assertEqual(normal_list.status_code, 200)
        self.assertEqual(normal_list.data["count"], 1)

    def test_hard_delete_removes_item_permanently(self):
        self.client.delete(f"/api/content/stories/{self.story.id}/")

        hard_delete_response = self.client.delete(f"/api/content/stories/{self.story.id}/hard-delete/")
        self.assertEqual(hard_delete_response.status_code, 204)
        self.assertFalse(Story.objects.filter(id=self.story.id).exists())

    def test_deleted_content_is_not_publicly_visible(self):
        self.client.delete(f"/api/content/stories/{self.story.id}/")
        self.client.force_authenticate(None)

        public_list = self.client.get("/api/content/stories/")
        self.assertEqual(public_list.status_code, 200)
        self.assertEqual(public_list.data["count"], 0)

    def test_cleanup_recycle_bin_removes_all_deleted_items_in_category(self):
        second_story = Story.objects.create(
            author=self.writer,
            title="Second soft delete story",
            body="Body",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=False,
        )
        active_story = Story.objects.create(
            author=self.writer,
            title="Active story",
            body="Still active",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_anonymous=False,
        )

        self.client.delete(f"/api/content/stories/{self.story.id}/")
        self.client.delete(f"/api/content/stories/{second_story.id}/")

        cleanup_response = self.client.post("/api/content/stories/cleanup/")
        self.assertEqual(cleanup_response.status_code, 200)
        self.assertEqual(cleanup_response.data["deleted_count"], 2)

        self.assertFalse(Story.objects.filter(id=self.story.id).exists())
        self.assertFalse(Story.objects.filter(id=second_story.id).exists())
        self.assertTrue(Story.objects.filter(id=active_story.id).exists())


class SubmissionWorkflowTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.writer = User.objects.create_user(
            username="submit_writer",
            email="submit_writer@example.com",
            password="Test1234!",
        )
        self.redactor = User.objects.create_user(
            username="submit_redactor",
            email="submit_redactor@example.com",
            password="Test1234!",
        )

        EmailAddress.objects.create(user=self.writer, email=self.writer.email, verified=True, primary=True)
        EmailAddress.objects.create(user=self.redactor, email=self.redactor.email, verified=True, primary=True)

        writer_profile = get_profile(self.writer)
        writer_profile.is_writer_approved = True
        writer_profile.save(update_fields=["is_writer_approved", "updated_at"])

        redactor_group, _ = Group.objects.get_or_create(name=GROUP_REDACTORS)
        self.redactor.groups.add(redactor_group)
        RedactorPermission.objects.update_or_create(
            user=self.redactor,
            defaults={
                "can_review_content": True,
                "can_manage_content": False,
                "can_review_writer_applications": False,
                "can_manage_redactors": False,
                "is_active": True,
            },
        )

    def test_draft_not_visible_for_redactor_until_writer_submits(self):
        story = Story.objects.create(
            author=self.writer,
            title="Draft story",
            body="Text",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.redactor)
        before = self.client.get("/api/content/stories/?status=draft")
        self.assertEqual(before.status_code, 200)
        self.assertEqual(before.data["count"], 0)

        self.client.force_authenticate(self.writer)
        submit_response = self.client.post(f"/api/content/stories/{story.id}/submit/")
        self.assertEqual(submit_response.status_code, 200)
        self.assertTrue(submit_response.data["is_submitted_for_review"])
        self.assertEqual(submit_response.data["status"], StatusChoices.DRAFT)

        self.client.force_authenticate(self.redactor)
        after = self.client.get("/api/content/stories/?status=draft")
        self.assertEqual(after.status_code, 200)
        self.assertEqual(after.data["count"], 1)
        self.assertEqual(after.data["results"][0]["id"], story.id)

    def test_submit_rejected_story_moves_it_back_to_draft(self):
        story = Story.objects.create(
            author=self.writer,
            title="Rejected story",
            body="Text",
            status=StatusChoices.REJECTED,
            rejection_reason="Needs work",
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.writer)
        response = self.client.post(f"/api/content/stories/{story.id}/submit/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], StatusChoices.DRAFT)
        self.assertEqual(response.data["rejection_reason"], "")
        self.assertTrue(response.data["is_submitted_for_review"])

    def test_book_chapter_submission_flow_for_published_book(self):
        book = Book.objects.create(
            author=self.writer,
            title="Published book",
            status=StatusChoices.APPROVED,
        )
        chapter = Chapter.objects.create(
            book=book,
            title="New chapter",
            order=1,
            body="Text",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.redactor)
        before = self.client.get("/api/content/chapters/?status=draft")
        self.assertEqual(before.status_code, 200)
        self.assertEqual(before.data["count"], 0)

        self.client.force_authenticate(None)
        public_before_submit = self.client.get(f"/api/content/chapters/?book={book.id}")
        self.assertEqual(public_before_submit.status_code, 200)
        self.assertEqual(public_before_submit.data["count"], 0)

        self.client.force_authenticate(self.writer)
        submit_response = self.client.post(f"/api/content/chapters/{chapter.id}/submit/")
        self.assertEqual(submit_response.status_code, 200)
        self.assertTrue(submit_response.data["is_submitted_for_review"])

        self.client.force_authenticate(None)
        public_after_submit = self.client.get(f"/api/content/chapters/?book={book.id}")
        self.assertEqual(public_after_submit.status_code, 200)
        self.assertEqual(public_after_submit.data["count"], 0)

        self.client.force_authenticate(self.redactor)
        after = self.client.get("/api/content/chapters/?status=draft")
        self.assertEqual(after.status_code, 200)
        self.assertEqual(after.data["count"], 1)

        review_response = self.client.post(
            f"/api/content/chapters/{chapter.id}/review/",
            {"status": "approved"},
            format="json",
        )
        self.assertEqual(review_response.status_code, 200)

        chapter.refresh_from_db()
        self.assertEqual(chapter.status, StatusChoices.APPROVED)
        self.assertFalse(chapter.is_submitted_for_review)

        self.client.force_authenticate(None)
        public_after_approval = self.client.get(f"/api/content/chapters/?book={book.id}")
        self.assertEqual(public_after_approval.status_code, 200)
        self.assertEqual(public_after_approval.data["count"], 1)

    def test_chapter_publish_submits_whole_book_when_nothing_is_approved(self):
        draft_book = Book.objects.create(
            author=self.writer,
            title="Draft parent book",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )
        first_chapter = Chapter.objects.create(
            book=draft_book,
            title="Draft chapter 1",
            order=1,
            body="Text",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )
        second_chapter = Chapter.objects.create(
            book=draft_book,
            title="Draft chapter 2",
            order=2,
            body="Text",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.writer)
        submit_response = self.client.post(f"/api/content/chapters/{first_chapter.id}/submit/")
        self.assertEqual(submit_response.status_code, 200)

        draft_book.refresh_from_db()
        first_chapter.refresh_from_db()
        second_chapter.refresh_from_db()

        self.assertTrue(draft_book.is_submitted_for_review)
        self.assertTrue(first_chapter.is_submitted_for_review)
        self.assertTrue(second_chapter.is_submitted_for_review)

    def test_chapter_publish_submits_only_target_when_book_has_approved_items(self):
        book = Book.objects.create(
            author=self.writer,
            title="Book with approved chapter",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )
        Chapter.objects.create(
            book=book,
            title="Approved chapter",
            order=1,
            body="Approved",
            status=StatusChoices.APPROVED,
            is_submitted_for_review=False,
        )
        target_chapter = Chapter.objects.create(
            book=book,
            title="Target draft chapter",
            order=2,
            body="Draft",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )
        untouched_chapter = Chapter.objects.create(
            book=book,
            title="Other draft chapter",
            order=3,
            body="Draft",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.writer)
        submit_response = self.client.post(f"/api/content/chapters/{target_chapter.id}/submit/")
        self.assertEqual(submit_response.status_code, 200)

        book.refresh_from_db()
        target_chapter.refresh_from_db()
        untouched_chapter.refresh_from_db()

        self.assertFalse(book.is_submitted_for_review)
        self.assertTrue(target_chapter.is_submitted_for_review)
        self.assertFalse(untouched_chapter.is_submitted_for_review)

    def test_saved_or_submitted_draft_is_not_public_before_approval(self):
        story = Story.objects.create(
            author=self.writer,
            title="Hidden draft story",
            body="Only draft",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(None)
        public_before_submit = self.client.get("/api/content/stories/")
        self.assertEqual(public_before_submit.status_code, 200)
        self.assertEqual(public_before_submit.data["count"], 0)

        self.client.force_authenticate(self.writer)
        submit_response = self.client.post(f"/api/content/stories/{story.id}/submit/")
        self.assertEqual(submit_response.status_code, 200)

        self.client.force_authenticate(None)
        public_after_submit = self.client.get("/api/content/stories/")
        self.assertEqual(public_after_submit.status_code, 200)
        self.assertEqual(public_after_submit.data["count"], 0)

        self.client.force_authenticate(self.redactor)
        review_response = self.client.post(
            f"/api/content/stories/{story.id}/review/",
            {"status": "approved"},
            format="json",
        )
        self.assertEqual(review_response.status_code, 200)

        self.client.force_authenticate(None)
        public_after_approval = self.client.get("/api/content/stories/")
        self.assertEqual(public_after_approval.status_code, 200)
        self.assertEqual(public_after_approval.data["count"], 1)

    def test_saving_book_does_not_submit_without_publish(self):
        book = Book.objects.create(
            author=self.writer,
            title="Save-only draft book",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.writer)
        save_response = self.client.patch(
            f"/api/content/books/{book.id}/",
            {"title": "Updated draft title"},
            format="json",
        )
        self.assertEqual(save_response.status_code, 200)
        self.assertFalse(save_response.data["is_submitted_for_review"])

        book.refresh_from_db()
        self.assertFalse(book.is_submitted_for_review)

        self.client.force_authenticate(self.redactor)
        redactor_queue = self.client.get("/api/content/books/?status=draft")
        self.assertEqual(redactor_queue.status_code, 200)
        self.assertEqual(redactor_queue.data["count"], 0)

    def test_saving_chapter_does_not_submit_without_publish(self):
        book = Book.objects.create(
            author=self.writer,
            title="Approved parent for chapter save",
            status=StatusChoices.APPROVED,
            is_submitted_for_review=False,
        )
        chapter = Chapter.objects.create(
            book=book,
            title="Unsynced chapter draft",
            order=1,
            body="Draft body",
            status=StatusChoices.DRAFT,
            is_submitted_for_review=False,
        )

        self.client.force_authenticate(self.writer)
        save_response = self.client.patch(
            f"/api/content/chapters/{chapter.id}/",
            {"body": "Updated draft body"},
            format="json",
        )
        self.assertEqual(save_response.status_code, 200)
        self.assertFalse(save_response.data["is_submitted_for_review"])

        chapter.refresh_from_db()
        self.assertFalse(chapter.is_submitted_for_review)

        self.client.force_authenticate(self.redactor)
        redactor_queue = self.client.get("/api/content/chapters/?status=draft")
        self.assertEqual(redactor_queue.status_code, 200)
        self.assertEqual(redactor_queue.data["count"], 0)

    def test_create_chapter_defaults_title_to_georgian_when_book_language_is_georgian(self):
        book = Book.objects.create(
            author=self.writer,
            title="Georgian Book",
            content_language=ContentLanguageChoices.GEORGIAN,
            status=StatusChoices.DRAFT,
        )

        self.client.force_authenticate(self.writer)
        create_response = self.client.post(
            "/api/content/chapters/",
            {
                "book": book.id,
                "title": "",
                "order": 1,
                "body": "",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["title"], "თავი 1")

    def test_create_chapter_defaults_title_to_english_when_book_language_is_english(self):
        book = Book.objects.create(
            author=self.writer,
            title="English Book",
            content_language=ContentLanguageChoices.ENGLISH,
            status=StatusChoices.DRAFT,
        )

        self.client.force_authenticate(self.writer)
        create_response = self.client.post(
            "/api/content/chapters/",
            {
                "book": book.id,
                "title": "",
                "order": 1,
                "body": "",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["title"], "Chapter 1")


class UploadProcessingTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.writer = User.objects.create_user(
            username="upload_writer",
            email="upload_writer@example.com",
            password="Test1234!",
        )

    def test_split_text_into_chapters_detects_multiple_heading_styles(self):
        text = (
            "Chapter 1: Dawn\n"
            "First chapter body line.\n\n"
            "თავი 2 - გაგრძელება\n"
            "Second chapter body line.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1: Dawn")
        self.assertEqual(chapters[1].title, "თავი 2 - გაგრძელება")
        self.assertIn("<p>First chapter body line.</p>", chapters[0].body_html)
        self.assertIn("<p>Second chapter body line.</p>", chapters[1].body_html)

    def test_split_text_into_chapters_treats_single_dot_bullet_as_separator(self):
        text = (
            "Chapter 1\n"
            "Alpha body.\n\n"
            "●\n"
            "Beta body.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertEqual(chapters[1].title, "●")
        self.assertIn("<p>Alpha body.</p>", chapters[0].body_html)
        self.assertIn("<p>Beta body.</p>", chapters[1].body_html)

    def test_split_text_into_chapters_treats_single_hyphen_as_separator(self):
        text = (
            "Chapter 1\n"
            "Alpha body.\n\n"
            "-\n"
            "Beta body.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertEqual(chapters[1].title, "-")
        self.assertIn("<p>Alpha body.</p>", chapters[0].body_html)
        self.assertIn("<p>Beta body.</p>", chapters[1].body_html)

    def test_split_text_without_headings_does_not_use_sentence_as_title(self):
        text = (
            "This is a long body sentence that should never become a chapter title.\n"
            "Another body sentence follows.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertIn("This is a long body sentence", chapters[0].body_html)

    def test_split_text_ignores_numeric_marker_headings_as_titles(self):
        text = (
            "I\n"
            "Alpha body.\n\n"
            "II\n"
            "Beta body.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertEqual(chapters[1].title, "Chapter 2")
        self.assertIn("<p>Alpha body.</p>", chapters[0].body_html)
        self.assertIn("<p>Beta body.</p>", chapters[1].body_html)

    def test_split_text_treats_only_real_georgian_tavi_markers_as_headings(self):
        heading_one = "\u10d7\u10d0\u10d5\u10d8 \u10de\u10d8\u10e0\u10d5\u10d4\u10da\u10d8"
        heading_two = "\u10d7\u10d0\u10d5\u10d8 \u10db\u10d4\u10dd\u10e0\u10d4"
        non_heading = "\u10d7\u10d0\u10d5\u10d8 \u10d0\u10db\u10dd\u10e1\u10d3\u10d8\u10e1, - \u10d7\u10e5\u10d5\u10d0 \u10db\u10d0\u10dc."
        text = (
            f"{heading_one}\n"
            "Alpha body.\n\n"
            f"{non_heading}\n"
            "Still chapter one body.\n\n"
            f"{heading_two}\n"
            "Beta body.\n"
        )

        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, heading_one)
        self.assertEqual(chapters[1].title, heading_two)
        self.assertIn(non_heading, chapters[0].body_html)

    def test_split_text_does_not_treat_tavis_word_forms_as_headings(self):
        heading_one = "\u10d7\u10d0\u10d5\u10d8 \u10de\u10d8\u10e0\u10d5\u10d4\u10da\u10d8"
        heading_two = "\u10d7\u10d0\u10d5\u10d8 \u10db\u10d4\u10dd\u10e0\u10d4"
        non_heading = "\u10d7\u10d0\u10d5\u10d8\u10e1 \u10d9\u10d0\u10da\u10d0\u10de\u10dd\u10e2\u10e1."
        text = (
            f"{heading_one}\n"
            f"{non_heading}\n\n"
            f"{heading_two}\n"
            "Beta body.\n"
        )

        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, heading_one)
        self.assertEqual(chapters[1].title, heading_two)
        self.assertIn(non_heading, chapters[0].body_html)

    def test_split_text_recognizes_mechvidmete_and_metvramete_headings(self):
        heading_one = "\u10d7\u10d0\u10d5\u10d8 \u10db\u10d4\u10e9\u10d5\u10d8\u10d3\u10db\u10d4\u10e2\u10d4"
        heading_two = "\u10d7\u10d0\u10d5\u10d8 \u10db\u10d4\u10d7\u10d5\u10e0\u10d0\u10db\u10d4\u10e2\u10d4"
        text = (
            f"{heading_one}\n"
            "Alpha body.\n\n"
            f"{heading_two}\n"
            "Beta body.\n"
        )

        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, heading_one)
        self.assertEqual(chapters[1].title, heading_two)

    def test_split_text_reflows_wrapped_prose_lines(self):
        text = (
            "\u10d4\u10e1 \u10d0\u10e0\u10d8\u10e1 \u10d2\u10e0\u10eb\u10d4\u10da\u10d8 \u10db\u10d8\u10e1\u10d0\u10d3\u10d0\u10d2\u10d8 \u10ec\u10d8\u10dc\u10d0\u10d3\u10d0\u10d3\u10d4\u10d1\u10d0\n"
            "\u10e0\u10dd\u10db\u10d4\u10da\u10d8\u10ea \u10e8\u10d4\u10db\u10d3\u10d4\u10d2 \u10e1\u10e2\u10e0\u10d8\u10e5\u10dd\u10dc\u10d6\u10d4 \u10d2\u10d0\u10d2\u10e0\u10eb\u10d4\u10da\u10d3\u10d0\n"
            "\u10d3\u10d0 \u10d1\u10dd\u10da\u10dd\u10e1 \u10d3\u10d0\u10e1\u10e0\u10e3\u10da\u10d3\u10d0.\n"
        )
        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 1)
        self.assertIn(
            "\u10db\u10d8\u10e1\u10d0\u10d3\u10d0\u10d2\u10d8 \u10ec\u10d8\u10dc\u10d0\u10d3\u10d0\u10d3\u10d4\u10d1\u10d0 \u10e0\u10dd\u10db\u10d4\u10da\u10d8\u10ea",
            chapters[0].body_html,
        )
        self.assertNotIn("<br />", chapters[0].body_html)

    def test_split_text_merges_lines_without_terminal_dot(self):
        text = (
            "\u10d4\u10e1 \u10d0\u10e0\u10d8\u10e1 \u10e8\u10d4\u10d5\u10e0\u10d0\u10de\u10d8\u10e0\u10d4\u10d1\u10e3\u10da\u10d8 \u10de\u10e0\u10dd\u10d6\u10d0\u10d8\u10e1 \u10de\u10d8\u10e0\u10d5\u10d4\u10da\u10d8 \u10e1\u10e2\u10e0\u10d8\u10e5\u10dd\u10dc\u10d8\n"
            "\u10e0\u10dd\u10db\u10d4\u10da\u10d8\u10ea \u10db\u10d4\u10dd\u10e0\u10d4 \u10e1\u10e2\u10e0\u10d8\u10e5\u10dd\u10dc\u10d7\u10d0\u10dc \u10d4\u10e0\u10d7 \u10d0\u10d1\u10d6\u10d0\u10ea\u10d0\u10d3 \u10e3\u10dc\u10d3\u10d0 \u10d2\u10d0\u10d4\u10e0\u10d7\u10d8\u10d0\u10dc\u10d3\u10d4\u10e1\n"
        )
        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 1)
        self.assertNotIn("<br />", chapters[0].body_html)

    def test_split_text_preserves_verse_lines_with_verse_markup(self):
        text = (
            "\u10ea\u10d0 \u10db\u10ec\u10d5\u10d0\u10dc\u10d4\u10d3 \u10d2\u10d0\u10d3\u10d0\u10d8\u10e1\u10d0\n"
            "\u10db\u10d7\u10d0 \u10db\u10d4\u10da\u10dd\u10d3\u10d8\u10e1 \u10e9\u10d0\u10e0\u10e9\u10d5\u10e8\u10d8\n"
            "\u10e5\u10d0\u10e0\u10d8 \u10e9\u10e3\u10db\u10d0\u10d3 \u10d2\u10d0\u10d3\u10d0\u10d8\u10d5\u10da\u10d8\u10e1\n"
            "\u10da\u10e3\u10ea\u10d5\u10d0 \u10db\u10d4 \u10d2\u10e3\u10da\u10e8\u10d8 \u10d3\u10e0\u10e9\u10d4\u10d1\u10d0\n"
        )
        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 1)
        self.assertIn("class=\"verse-block\"", chapters[0].body_html)
        self.assertGreaterEqual(chapters[0].body_html.count("class=\"verse-line\""), 4)
        self.assertNotIn("<br />", chapters[0].body_html)

    def test_split_text_does_not_apply_verse_markup_to_dialogue(self):
        text = (
            "- \u10de\u10d8\u10e0\u10d5\u10d4\u10da\u10d8 \u10e0\u10d4\u10de\u10da\u10d8\u10d9\u10d0\n"
            "- \u10db\u10d4\u10dd\u10e0\u10d4 \u10e0\u10d4\u10de\u10da\u10d8\u10d9\u10d0\n"
            "- \u10db\u10d4\u10e1\u10d0\u10db\u10d4 \u10e0\u10d4\u10de\u10da\u10d8\u10d9\u10d0\n"
        )
        chapters = split_text_into_chapters(text, fallback_language="ka")

        self.assertEqual(len(chapters), 1)
        self.assertNotIn("class=\"verse-block\"", chapters[0].body_html)
        self.assertIn("<br />", chapters[0].body_html)

    def test_split_text_keeps_line_break_only_for_visual_space_and_dot(self):
        keep_break_text = (
            "\u10db\u10dd\u10d9\u10da\u10d4 \u10ec\u10d8\u10dc\u10d0\u10d3\u10d0\u10d3\u10d4\u10d1\u10d0.\n"
            "\u10d4\u10e1 \u10d0\u10e0\u10d8\u10e1 \u10d2\u10d0\u10ea\u10d8\u10da\u10d4\u10d1\u10d8\u10d7 \u10d2\u10e0\u10eb\u10d4\u10da\u10d8 \u10db\u10d4\u10dd\u10e0\u10d4 \u10e1\u10e2\u10e0\u10d8\u10e5\u10dd\u10dc\u10d8, \u10e0\u10dd\u10db\u10d4\u10da\u10d8\u10ea \u10e1\u10d8\u10d2\u10e0\u10eb\u10d8\u10d7 \u10d2\u10d0\u10db\u10dd\u10d0\u10ea\u10d4\u10db\u10e1 \u10db\u10d8\u10e1 \u10e8\u10d0\u10d1\u10da\u10dd\u10dc\u10e1.\n"
        )
        merge_text = (
            "\u10db\u10dd\u10d9\u10da\u10d4 \u10ec\u10d8\u10dc\u10d0\u10d3\u10d0\u10d3\u10d4\u10d1\u10d0\n"
            "\u10d4\u10e1 \u10d0\u10e0\u10d8\u10e1 \u10d2\u10d0\u10ea\u10d8\u10da\u10d4\u10d1\u10d8\u10d7 \u10d2\u10e0\u10eb\u10d4\u10da\u10d8 \u10db\u10d4\u10dd\u10e0\u10d4 \u10e1\u10e2\u10e0\u10d8\u10e5\u10dd\u10dc\u10d8, \u10e0\u10dd\u10db\u10d4\u10da\u10d8\u10ea \u10e1\u10d8\u10d2\u10e0\u10eb\u10d8\u10d7 \u10d2\u10d0\u10db\u10dd\u10d0\u10ea\u10d4\u10db\u10e1 \u10db\u10d8\u10e1 \u10e8\u10d0\u10d1\u10da\u10dd\u10dc\u10e1.\n"
        )

        keep_chapters = split_text_into_chapters(keep_break_text, fallback_language="ka")
        merge_chapters = split_text_into_chapters(merge_text, fallback_language="ka")

        self.assertIn("<br />", keep_chapters[0].body_html)
        self.assertNotIn("<br />", merge_chapters[0].body_html)

    def test_split_text_detects_standalone_numeric_pdf_markers(self):
        text = (
            "Book Title\n"
            "1\n\n"
            "Alpha body.\n\n"
            "2\n\n"
            "Beta body.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertEqual(chapters[1].title, "Chapter 2")
        self.assertIn("<p>Alpha body.</p>", chapters[0].body_html)
        self.assertIn("<p>Beta body.</p>", chapters[1].body_html)

    def test_split_text_repairs_mojibake_dash_separator(self):
        # "â€”" is mojibake for an em dash.
        mojibake_em_dash = "\u00e2\u20ac\u201d"
        text = (
            "Chapter 1\n"
            "Alpha body.\n\n"
            f"{mojibake_em_dash}{mojibake_em_dash}{mojibake_em_dash}\n"
            "Beta body.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertEqual(chapters[1].title, "———")
        self.assertIn("<p>Alpha body.</p>", chapters[0].body_html)
        self.assertIn("<p>Beta body.</p>", chapters[1].body_html)

    def test_split_text_normalizes_leading_cyrillic_g_dialog_marker(self):
        text = (
            "г ჯემალ, სკრიპკა!\n"
            "г იანგული, ლაწირაკო!\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 1)
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertIn("- ჯემალ, სკრიპკა!", chapters[0].body_html)
        self.assertIn("- იანგული, ლაწირაკო!", chapters[0].body_html)

    def test_split_text_normalizes_inline_cyrillic_g_dash_variants(self):
        text = (
            "\u10d2\u10d0\u10db\u10d0\u10e0\u10ef\u10dd\u10d1\u10d0! \u0433 \u10db\u10d8\u10d7\u10ee\u10e0\u10d0 \u10db\u10d0\u10dc.\n"
            "\u10dd\u10e0 \u0433\u10e1\u10d0\u10db \u10d1\u10d8\u10ed\u10e1 \u10d4\u10e0\u10d7\u10d0\u10d3 \u10d2\u10d0\u10d0\u10e1\u10d8\u10da\u10d0\u10e5\u10d4\u10d1\u10d3\u10d0.\n"
            "\u10d6\u10d0\u10db\u10d7\u10d0\u10e0 \u0433\n"
            "\u10d6\u10d0\u10e4\u10ee\u10e3\u10da \u10e1\u10d8\u10d7\u10d1\u10dd \u10d8\u10e7\u10dd.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 1)
        self.assertIn("! - \u10db\u10d8\u10d7\u10ee\u10e0\u10d0", chapters[0].body_html)
        self.assertIn("\u10dd\u10e0-\u10e1\u10d0\u10db", chapters[0].body_html)
        self.assertIn("\u10d6\u10d0\u10db\u10d7\u10d0\u10e0-<br />\u10d6\u10d0\u10e4\u10ee\u10e3\u10da", chapters[0].body_html)

    def test_split_text_keeps_cyrillic_words_intact_when_normalizing_dash_markers(self):
        text = (
            "\u0433 \u041e\u0442\u0440\u0430\u0432\u0438\u043b!\n"
            "\u041c\u0438\u043b\u044b\u0435 \u043c\u043e\u0438, \u0437\u043e\u043b\u043e\u0442\u044b\u0435, \u043d\u0435\u043d\u0430\u0433\u043b\u044f\u0434\u043d\u044b\u0435.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 1)
        self.assertIn("- \u041e\u0442\u0440\u0430\u0432\u0438\u043b!", chapters[0].body_html)
        self.assertIn(
            "\u0437\u043e\u043b\u043e\u0442\u044b\u0435, \u043d\u0435\u043d\u0430\u0433\u043b\u044f\u0434\u043d\u044b\u0435.",
            chapters[0].body_html,
        )

    def test_split_text_converts_acadnusx_legacy_text(self):
        text = (
            "Tqveni naSromi gamoqveynebisaTvis mzadaa.\n"
            "Cemi saTauri.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 1)
        self.assertIn("\u10d7\u10e5\u10d5\u10d4\u10dc\u10d8 \u10dc\u10d0\u10e8\u10e0\u10dd\u10db\u10d8", chapters[0].body_html)
        self.assertIn("\u10e9\u10d4\u10db\u10d8 \u10e1\u10d0\u10d7\u10d0\u10e3\u10e0\u10d8", chapters[0].body_html)
        self.assertNotIn("Tqveni", chapters[0].body_html)

    def test_split_text_does_not_convert_regular_english_text(self):
        text = (
            "This is a simple chapter introduction for readers.\n"
            "It should stay in English.\n"
        )
        chapters = split_text_into_chapters(text)

        self.assertEqual(len(chapters), 1)
        self.assertIn("This is a simple chapter introduction for readers.", chapters[0].body_html)
        self.assertIn("It should stay in English.", chapters[0].body_html)

    def test_detect_pdf_has_acadnusx_font_marker(self):
        self.assertTrue(detect_pdf_has_acadnusx_font(b"/BaseFont /ABCDEF+AcadNusx"))
        self.assertFalse(detect_pdf_has_acadnusx_font(b"/BaseFont /ABCDEF+Sylfaen"))

    def test_force_convert_acadnusx_text(self):
        self.assertEqual(
            maybe_convert_acadnusx_to_unicode("Tqveni", force=True),
            "\u10d7\u10e5\u10d5\u10d4\u10dc\u10d8",
        )

    def test_process_book_upload_creates_draft_chapters_with_separator_titles(self):
        upload = SimpleUploadedFile(
            "upload-book.txt",
            (
                "Chapter 1: Beginning\n"
                "Alpha text.\n\n"
                "Chapter 2: Turning Point\n"
                "Beta text.\n"
            ).encode("utf-8"),
            content_type="text/plain",
        )
        book = Book.objects.create(
            author=self.writer,
            title="Imported Book",
            source_type=SourceType.UPLOAD,
            upload_file=upload,
            upload_processing_status=UploadProcessingStatus.IDLE,
        )

        process_book_upload(book.id, expected_upload_name=book.upload_file.name)

        book.refresh_from_db()
        chapters = list(book.chapters.order_by("order"))

        self.assertEqual(book.upload_processing_status, UploadProcessingStatus.DONE)
        self.assertEqual(book.upload_processing_error, "")
        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "Chapter 1: Beginning")
        self.assertEqual(chapters[1].title, "Chapter 2: Turning Point")
        self.assertEqual(chapters[0].status, StatusChoices.DRAFT)
        self.assertFalse(chapters[0].is_submitted_for_review)


class TextSanitizationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.writer = User.objects.create_user(
            username="space_writer",
            email="space_writer@example.com",
            password="Test1234!",
        )
        self.book = Book.objects.create(
            author=self.writer,
            title="Space Book",
            source_type=SourceType.MANUAL,
        )
        self.chapter = Chapter.objects.create(
            book=self.book,
            title="Initial",
            order=1,
            body="Initial",
        )

    def test_sanitize_plain_text_preserves_single_trailing_space(self):
        self.assertEqual(sanitize_plain_text("Hello "), "Hello ")

    def test_sanitize_plain_text_collapses_multiple_trailing_spaces(self):
        self.assertEqual(sanitize_plain_text("Hello   "), "Hello ")

    def test_chapter_serializer_preserves_single_trailing_space(self):
        serializer = ChapterSerializer(
            instance=self.chapter,
            data={
                "title": "Hello ",
                "body": "Body ",
                "order": 1,
                "book": self.book.id,
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.title, "Hello ")
        self.assertEqual(saved.body, "Body ")

    def test_chapter_serializer_collapses_multiple_trailing_spaces(self):
        serializer = ChapterSerializer(
            instance=self.chapter,
            data={
                "title": "Hello   ",
                "body": "Body   ",
                "order": 1,
                "book": self.book.id,
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        saved = serializer.save()
        self.assertEqual(saved.title, "Hello ")
        self.assertEqual(saved.body, "Body ")
