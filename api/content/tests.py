from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase

from allauth.account.models import EmailAddress
from accounts.utils import get_profile
from content.models import Book, Poem, StatusChoices, Story


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
