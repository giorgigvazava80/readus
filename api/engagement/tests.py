from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from rest_framework.test import APITestCase

from allauth.account.models import EmailAddress
from accounts.models import AuditLog, Notification
from accounts.utils import get_profile
from content.models import Book, Chapter, StatusChoices, Story
from engagement.models import (
    AuthorFollow,
    ContentComment,
    ContentReaction,
    ContentViewEvent,
    ReadingProgress,
    ReferralVisit,
    ReactionType,
)


class EngagementApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.author = User.objects.create_user(
            username="writer",
            email="writer@example.com",
            password="Test1234!",
            first_name="Writer",
            last_name="One",
        )
        self.reader = User.objects.create_user(
            username="reader",
            email="reader@example.com",
            password="Test1234!",
            first_name="Reader",
            last_name="One",
        )
        self.hidden_author = User.objects.create_user(
            username="hidden_writer",
            email="hidden-writer@example.com",
            password="Test1234!",
            first_name="Hidden",
            last_name="Writer",
        )
        self.anonymous_only_author = User.objects.create_user(
            username="anon_writer",
            email="anon-writer@example.com",
            password="Test1234!",
            first_name="Anonymous",
            last_name="Writer",
        )
        self.admin = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password="Test1234!",
            is_staff=True,
            is_superuser=True,
        )
        EmailAddress.objects.create(user=self.author, email=self.author.email, verified=True, primary=True)
        EmailAddress.objects.create(user=self.reader, email=self.reader.email, verified=True, primary=True)
        EmailAddress.objects.create(user=self.hidden_author, email=self.hidden_author.email, verified=True, primary=True)
        EmailAddress.objects.create(
            user=self.anonymous_only_author,
            email=self.anonymous_only_author.email,
            verified=True,
            primary=True,
        )
        EmailAddress.objects.create(user=self.admin, email=self.admin.email, verified=True, primary=True)

        self.story = Story.objects.create(
            author=self.author,
            title="Public Story",
            description="<p>Story description</p>",
            body="<p>Paragraph one</p><p>Paragraph two</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        self.book = Book.objects.create(
            author=self.author,
            title="Public Book",
            description="<p>Book description</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        self.chapter = Chapter.objects.create(
            book=self.book,
            title="Chapter One",
            order=1,
            body="<p>Book chapter body</p>",
            status=StatusChoices.APPROVED,
        )
        Story.objects.create(
            author=self.hidden_author,
            title="Hidden Story",
            description="<p>Hidden</p>",
            body="<p>Hidden story text</p>",
            status=StatusChoices.APPROVED,
            is_hidden=True,
            is_deleted=False,
            is_anonymous=False,
        )
        Story.objects.create(
            author=self.anonymous_only_author,
            title="Anonymous Story",
            description="<p>Anonymous</p>",
            body="<p>Anonymous story text</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=True,
        )

    def test_follow_and_unfollow_author(self):
        self.client.force_authenticate(self.reader)

        follow_response = self.client.post(f"/api/authors/{self.author.id}/follow/")
        self.assertEqual(follow_response.status_code, 200)
        self.assertTrue(follow_response.data["is_following"])
        self.assertEqual(follow_response.data["follower_count"], 1)
        self.assertEqual(follow_response.data["author_id"], self.author.id)
        self.assertTrue(AuthorFollow.objects.filter(follower=self.reader, author=self.author).exists())

        repeat_follow = self.client.post(f"/api/authors/{self.author.id}/follow/")
        self.assertEqual(repeat_follow.status_code, 200)
        self.assertEqual(repeat_follow.data["follower_count"], 1)

        state_response = self.client.get(f"/api/authors/{self.author.id}/follow-state/")
        self.assertEqual(state_response.status_code, 200)
        self.assertTrue(state_response.data["is_following"])
        self.assertEqual(state_response.data["follower_count"], 1)

        unfollow_response = self.client.delete(f"/api/authors/{self.author.id}/follow/")
        self.assertEqual(unfollow_response.status_code, 200)
        self.assertFalse(unfollow_response.data["is_following"])
        self.assertEqual(unfollow_response.data["follower_count"], 0)
        self.assertFalse(AuthorFollow.objects.filter(follower=self.reader, author=self.author).exists())
        self.assertTrue(AuditLog.objects.filter(action="author_followed").exists())
        self.assertTrue(AuditLog.objects.filter(action="author_unfollowed").exists())

    def test_follow_hidden_or_anonymous_only_author_is_not_allowed(self):
        self.client.force_authenticate(self.reader)

        hidden_follow = self.client.post(f"/api/authors/{self.hidden_author.id}/follow/")
        self.assertEqual(hidden_follow.status_code, 404)

        anonymous_only_follow = self.client.post(f"/api/authors/{self.anonymous_only_author.id}/follow/")
        self.assertEqual(anonymous_only_follow.status_code, 404)

    def test_me_following_endpoint(self):
        self.client.force_authenticate(self.reader)
        self.client.post(f"/api/authors/{self.author.id}/follow/")

        response = self.client.get("/api/me/following/?page=1")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["author_id"], self.author.id)
        self.assertEqual(response.data["results"][0]["author_username"], self.author.username)

    def test_author_followers_endpoint_visibility(self):
        self.client.force_authenticate(self.reader)
        self.client.post(f"/api/authors/{self.author.id}/follow/")

        self.client.force_authenticate(None)
        public_view = self.client.get(f"/api/authors/{self.author.id}/followers/")
        self.assertEqual(public_view.status_code, 200)
        self.assertEqual(public_view.data["follower_count"], 1)
        self.assertNotIn("results", public_view.data)

        self.client.force_authenticate(self.admin)
        admin_view = self.client.get(f"/api/authors/{self.author.id}/followers/?page=1")
        self.assertEqual(admin_view.status_code, 200)
        self.assertEqual(admin_view.data["follower_count"], 1)
        self.assertEqual(admin_view.data["count"], 1)
        self.assertEqual(admin_view.data["results"][0]["username"], self.reader.username)

    def test_progress_upsert(self):
        self.client.force_authenticate(self.reader)

        upsert_first = self.client.put(
            f"/api/engagement/content/stories/{self.story.public_slug}/progress/",
            {"progress_percent": "35.50", "paragraph_index": 0, "cursor": "p0", "completed": False},
            format="json",
        )
        self.assertEqual(upsert_first.status_code, 200)
        self.assertTrue(upsert_first.data["created"])
        self.assertEqual(str(upsert_first.data["progress"]["progress_percent"]), "35.50")

        upsert_second = self.client.put(
            f"/api/engagement/content/stories/{self.story.public_slug}/progress/",
            {"progress_percent": "100.00", "paragraph_index": 1, "completed": True},
            format="json",
        )
        self.assertEqual(upsert_second.status_code, 200)
        self.assertFalse(upsert_second.data["created"])
        self.assertTrue(upsert_second.data["progress"]["completed"])

        fetch_progress = self.client.get(f"/api/engagement/content/stories/{self.story.public_slug}/progress/")
        self.assertEqual(fetch_progress.status_code, 200)
        self.assertEqual(str(fetch_progress.data["progress"]["progress_percent"]), "100.00")
        self.assertTrue(fetch_progress.data["progress"]["completed"])

    def test_new_reading_progress_upsert_and_continue_reading(self):
        self.client.force_authenticate(self.reader)

        upsert = self.client.post(
            "/api/reading-progress/",
            {
                "work_id": self.story.id,
                "work_type": "stories",
                "progress_percent": "44.50",
                "last_position": {"scroll_y": 210, "cursor": "story-pos"},
            },
            format="json",
        )
        self.assertEqual(upsert.status_code, 200)
        self.assertEqual(str(upsert.data["progress_percent"]), "44.50")
        self.assertEqual(upsert.data["work"]["id"], self.story.id)
        self.assertIsNone(upsert.data["chapter"])
        self.assertEqual(upsert.data["last_position"]["scroll_y"], 210)

        upsert_again = self.client.post(
            "/api/reading-progress/",
            {
                "work_id": self.story.id,
                "work_type": "stories",
                "progress_percent": "81.00",
                "last_position": {"scroll_y": 640},
            },
            format="json",
        )
        self.assertEqual(upsert_again.status_code, 200)
        self.assertFalse(upsert_again.data["created"])

        continue_reading = self.client.get("/api/me/continue-reading/?limit=10")
        self.assertEqual(continue_reading.status_code, 200)
        self.assertEqual(len(continue_reading.data["results"]), 1)
        self.assertEqual(continue_reading.data["results"][0]["work"]["id"], self.story.id)
        self.assertEqual(str(continue_reading.data["results"][0]["progress_percent"]), "81.00")

    def test_new_reading_progress_supports_chapter_target(self):
        self.client.force_authenticate(self.reader)

        upsert = self.client.post(
            "/api/reading-progress/",
            {
                "work_id": self.book.id,
                "chapter_id": self.chapter.id,
                "progress_percent": "25.00",
                "last_position": {"paragraph_index": 1},
            },
            format="json",
        )
        self.assertEqual(upsert.status_code, 200)
        self.assertEqual(upsert.data["work"]["id"], self.book.id)
        self.assertIsNotNone(upsert.data["chapter"])
        self.assertEqual(upsert.data["chapter"]["id"], self.chapter.id)

        continue_reading = self.client.get("/api/me/continue-reading/?limit=10")
        self.assertEqual(continue_reading.status_code, 200)
        self.assertEqual(continue_reading.data["results"][0]["chapter"]["id"], self.chapter.id)

    def test_reading_progress_upsert_dedupes_view_events_per_user_day(self):
        self.client.force_authenticate(self.reader)

        first = self.client.post(
            "/api/reading-progress/",
            {
                "work_id": self.story.id,
                "work_type": "stories",
                "progress_percent": "11.00",
                "last_position": {"scroll_y": 100},
            },
            format="json",
        )
        second = self.client.post(
            "/api/reading-progress/",
            {
                "work_id": self.story.id,
                "work_type": "stories",
                "progress_percent": "33.00",
                "last_position": {"scroll_y": 300},
            },
            format="json",
        )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            ContentViewEvent.objects.filter(user=self.reader).count(),
            1,
        )

    def test_continue_reading_hides_non_public_items(self):
        self.client.force_authenticate(self.reader)
        self.client.post(
            "/api/reading-progress/",
            {
                "work_id": self.story.id,
                "work_type": "stories",
                "progress_percent": "50.00",
                "last_position": {"scroll_y": 200},
            },
            format="json",
        )

        self.story.is_hidden = True
        self.story.save(update_fields=["is_hidden", "updated_at"])

        continue_reading = self.client.get("/api/me/continue-reading/?limit=10")
        self.assertEqual(continue_reading.status_code, 200)
        self.assertEqual(continue_reading.data["results"], [])

    def test_like_unlike_and_cooldown(self):
        self.client.force_authenticate(self.reader)

        like_response = self.client.post(f"/api/engagement/content/stories/{self.story.public_slug}/like/")
        self.assertEqual(like_response.status_code, 200)
        self.assertEqual(like_response.data["likes_count"], 1)
        self.assertTrue(like_response.data["liked_by_me"])

        throttled_like = self.client.post(f"/api/engagement/content/stories/{self.story.public_slug}/like/")
        self.assertEqual(throttled_like.status_code, 429)

        unlike_response = self.client.delete(f"/api/engagement/content/stories/{self.story.public_slug}/like/")
        self.assertEqual(unlike_response.status_code, 200)
        self.assertEqual(unlike_response.data["likes_count"], 0)
        self.assertFalse(unlike_response.data["liked_by_me"])

    def test_comment_create_reply_and_moderation(self):
        self.client.force_authenticate(self.reader)

        create_comment = self.client.post(
            f"/api/engagement/content/stories/{self.story.public_slug}/comments/",
            {"body": "Great story", "paragraph_index": 0},
            format="json",
        )
        self.assertEqual(create_comment.status_code, 201)
        root_comment_id = create_comment.data["id"]

        create_reply = self.client.post(
            f"/api/engagement/content/stories/{self.story.public_slug}/comments/",
            {"body": "Reply here", "parent_id": root_comment_id},
            format="json",
        )
        self.assertEqual(create_reply.status_code, 201)

        list_comments = self.client.get(f"/api/engagement/content/stories/{self.story.public_slug}/comments/")
        self.assertEqual(list_comments.status_code, 200)
        self.assertEqual(len(list_comments.data["results"]), 1)
        self.assertEqual(len(list_comments.data["results"][0]["replies"]), 1)

        self.client.force_authenticate(self.author)
        moderate_response = self.client.patch(
            f"/api/engagement/comments/{root_comment_id}/moderate/",
            {"is_hidden": True, "reason": "Spoiler"},
            format="json",
        )
        self.assertEqual(moderate_response.status_code, 200)
        self.assertTrue(moderate_response.data["is_hidden"])
        self.assertTrue(AuditLog.objects.filter(action="comment_moderated", target_id=str(root_comment_id)).exists())

    def test_trending_endpoint(self):
        self.client.force_authenticate(self.reader)
        self.client.post(f"/api/engagement/content/stories/{self.story.public_slug}/view/", {}, format="json")
        self.client.post(f"/api/engagement/content/stories/{self.story.public_slug}/like/", {}, format="json")
        self.client.post(
            f"/api/engagement/content/stories/{self.story.public_slug}/comments/",
            {"body": "Very good", "paragraph_index": 0},
            format="json",
        )

        self.client.force_authenticate(None)
        trending = self.client.get("/api/engagement/trending/?window=week&limit=5")
        self.assertEqual(trending.status_code, 200)
        self.assertGreaterEqual(len(trending.data["results"]), 1)
        identifiers = {item["identifier"] for item in trending.data["results"]}
        self.assertIn(self.story.public_slug, identifiers)

    def test_view_counter_is_deduped_by_user_per_day(self):
        self.client.force_authenticate(self.reader)

        first = self.client.post(f"/api/engagement/content/stories/{self.story.public_slug}/view/", {}, format="json")
        second = self.client.post(f"/api/engagement/content/stories/{self.story.public_slug}/view/", {}, format="json")
        self.assertEqual(first.status_code, 204)
        self.assertEqual(second.status_code, 204)
        self.assertEqual(ContentViewEvent.objects.filter(user=self.reader).count(), 1)

    def test_view_counter_is_deduped_by_anon_ip_per_day(self):
        self.client.force_authenticate(None)
        first = self.client.post(
            f"/api/engagement/content/stories/{self.story.public_slug}/view/",
            {},
            format="json",
            REMOTE_ADDR="127.0.0.1",
        )
        second = self.client.post(
            f"/api/engagement/content/stories/{self.story.public_slug}/view/",
            {},
            format="json",
            REMOTE_ADDR="127.0.0.1",
        )
        self.assertEqual(first.status_code, 204)
        self.assertEqual(second.status_code, 204)
        self.assertEqual(ContentViewEvent.objects.filter(user__isnull=True).count(), 1)


class EngagementContractApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        User = get_user_model()
        self.author = User.objects.create_user(
            username="writer_contract",
            email="writer-contract@example.com",
            password="Test1234!",
            first_name="Writer",
            last_name="Contract",
        )
        self.reader = User.objects.create_user(
            username="reader_contract",
            email="reader-contract@example.com",
            password="Test1234!",
            first_name="Reader",
            last_name="Contract",
        )
        self.other_reader = User.objects.create_user(
            username="reader_two",
            email="reader-two@example.com",
            password="Test1234!",
        )
        self.followed_author = User.objects.create_user(
            username="followed_author",
            email="followed-author@example.com",
            password="Test1234!",
        )
        self.other_author = User.objects.create_user(
            username="other_author",
            email="other-author@example.com",
            password="Test1234!",
        )
        self.admin = User.objects.create_superuser(
            username="admin_contract",
            email="admin-contract@example.com",
            password="Test1234!",
        )

        for user in [
            self.author,
            self.reader,
            self.other_reader,
            self.followed_author,
            self.other_author,
            self.admin,
        ]:
            EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)

        profile = get_profile(self.author)
        profile.is_writer_approved = True
        profile.save(update_fields=["is_writer_approved", "updated_at"])

        self.story = Story.objects.create(
            author=self.author,
            title="Contract Story",
            description="<p>Contract story desc</p>",
            body='<p id="intro">Hello paragraph</p><p data-block-id="middle">Middle paragraph</p>',
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        self.anonymous_story = Story.objects.create(
            author=self.author,
            title="Anonymous Contract Story",
            description="<p>Anonymous desc</p>",
            body="<p>Anonymous paragraph</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=True,
        )
        self.followed_story = Story.objects.create(
            author=self.followed_author,
            title="Followed Story",
            description="<p>Followed desc</p>",
            body="<p>Followed paragraph</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        self.other_story = Story.objects.create(
            author=self.other_author,
            title="Other Story",
            description="<p>Other desc</p>",
            body="<p>Other paragraph</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        self.book = Book.objects.create(
            author=self.author,
            title="Contract Book",
            description="<p>Book desc</p>",
            status=StatusChoices.APPROVED,
            is_hidden=False,
            is_deleted=False,
            is_anonymous=False,
        )
        self.chapter = Chapter.objects.create(
            book=self.book,
            title="Contract Chapter",
            order=1,
            body="<p>Chapter paragraph one</p>",
            status=StatusChoices.APPROVED,
        )

    def _work_like_payload(self, work_id):
        return {"target_type": "work", "target_id": work_id, "work_type": "stories"}

    def test_likes_contract_endpoints_and_state(self):
        self.client.force_authenticate(self.reader)

        like = self.client.post("/api/likes/", self._work_like_payload(self.story.id), format="json")
        self.assertEqual(like.status_code, 200)
        self.assertEqual(like.data["likes_count"], 1)
        self.assertTrue(like.data["liked_by_me"])

        state = self.client.get(f"/api/works/{self.story.id}/like-state/?work_type=stories")
        self.assertEqual(state.status_code, 200)
        self.assertEqual(state.data["target_type"], "work")
        self.assertEqual(state.data["target_id"], self.story.id)
        self.assertTrue(state.data["liked_by_me"])

        chapter_like = self.client.post(
            "/api/likes/",
            {"target_type": "chapter", "target_id": self.chapter.id},
            format="json",
        )
        self.assertEqual(chapter_like.status_code, 200)
        chapter_state = self.client.get(f"/api/chapters/{self.chapter.id}/like-state/")
        self.assertEqual(chapter_state.status_code, 200)
        self.assertEqual(chapter_state.data["likes_count"], 1)
        self.assertTrue(chapter_state.data["liked_by_me"])

        unlike = self.client.delete("/api/likes/", self._work_like_payload(self.story.id), format="json")
        self.assertEqual(unlike.status_code, 200)
        self.assertEqual(unlike.data["likes_count"], 0)
        self.assertFalse(unlike.data["liked_by_me"])

        notification = Notification.objects.filter(user=self.author, category=Notification.Category.LIKE).first()
        self.assertIsNotNone(notification)
        self.assertEqual(notification.metadata.get("actor_id"), self.reader.id)

    def test_like_cooldown_blocks_rapid_repeat(self):
        self.client.force_authenticate(self.reader)

        first_like = self.client.post("/api/likes/", self._work_like_payload(self.story.id), format="json")
        second_like = self.client.post("/api/likes/", self._work_like_payload(self.story.id), format="json")
        self.assertEqual(first_like.status_code, 200)
        self.assertEqual(second_like.status_code, 429)

        first_unlike = self.client.delete("/api/likes/", self._work_like_payload(self.story.id), format="json")
        second_unlike = self.client.delete("/api/likes/", self._work_like_payload(self.story.id), format="json")
        self.assertEqual(first_unlike.status_code, 200)
        self.assertEqual(second_unlike.status_code, 429)

    def test_like_notifications_skip_self_like_and_anonymous_uses_private_actor_display(self):
        self.client.force_authenticate(self.reader)
        anon_like = self.client.post("/api/likes/", self._work_like_payload(self.anonymous_story.id), format="json")
        self.assertEqual(anon_like.status_code, 200)

        notification = (
            Notification.objects.filter(user=self.author, category=Notification.Category.LIKE)
            .order_by("-id")
            .first()
        )
        self.assertIsNotNone(notification)
        self.assertIn("A reader", notification.message)
        self.assertEqual(notification.metadata.get("actor_username"), self.reader.username)

        self.client.force_authenticate(self.author)
        self_like = self.client.post("/api/likes/", self._work_like_payload(self.story.id), format="json")
        self.assertEqual(self_like.status_code, 200)
        self.assertEqual(Notification.objects.filter(user=self.author, category=Notification.Category.LIKE).count(), 1)

    def test_comments_create_get_hide_and_reply_with_anchor(self):
        self.client.force_authenticate(self.reader)
        create_root = self.client.post(
            "/api/comments/",
            {
                "target_type": "work",
                "target_id": self.story.id,
                "work_type": "stories",
                "anchor_type": "block",
                "anchor_key": "intro",
                "body": "Great opening paragraph",
            },
            format="json",
        )
        self.assertEqual(create_root.status_code, 201)
        root_id = create_root.data["id"]
        self.assertEqual(create_root.data["anchor_type"], "block")
        self.assertEqual(create_root.data["anchor_key"], "intro")
        self.assertEqual(create_root.data["paragraph_index"], 0)

        cache.clear()
        reply = self.client.post(
            "/api/comments/",
            {
                "target_type": "work",
                "target_id": self.story.id,
                "work_type": "stories",
                "body": "Replying inline",
                "parent_comment": root_id,
            },
            format="json",
        )
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data["parent_comment"], root_id)
        self.assertEqual(reply.data["anchor_key"], "intro")

        self.client.force_authenticate(None)
        listing = self.client.get(f"/api/comments/?target_type=work&target_id={self.story.id}&work_type=stories")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(len(listing.data["results"][0]["replies"]), 1)

        self.client.force_authenticate(self.author)
        hide = self.client.patch(
            f"/api/comments/{root_id}/hide/",
            {"is_hidden": True, "reason": "Spoiler"},
            format="json",
        )
        self.assertEqual(hide.status_code, 200)
        self.assertTrue(hide.data["is_hidden"])
        self.assertTrue(AuditLog.objects.filter(action="comment_hidden", target_id=str(root_id)).exists())

        self.client.force_authenticate(None)
        hidden_listing = self.client.get(f"/api/comments/?target_type=work&target_id={self.story.id}&work_type=stories")
        self.assertEqual(hidden_listing.status_code, 200)
        self.assertEqual(hidden_listing.data["results"], [])

    def test_comment_cooldown_prevents_spam(self):
        self.client.force_authenticate(self.reader)
        first = self.client.post(
            "/api/comments/",
            {
                "target_type": "work",
                "target_id": self.story.id,
                "work_type": "stories",
                "anchor_type": "paragraph",
                "anchor_key": "p:0",
                "body": "First comment",
            },
            format="json",
        )
        second = self.client.post(
            "/api/comments/",
            {
                "target_type": "work",
                "target_id": self.story.id,
                "work_type": "stories",
                "anchor_type": "paragraph",
                "anchor_key": "p:0",
                "body": "Second comment",
            },
            format="json",
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 429)

    def test_comment_delete_soft_for_owner_and_hard_for_admin(self):
        self.client.force_authenticate(self.reader)
        created = self.client.post(
            "/api/comments/",
            {
                "target_type": "work",
                "target_id": self.story.id,
                "work_type": "stories",
                "anchor_type": "paragraph",
                "anchor_key": "p:0",
                "body": "Delete me",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        comment_id = created.data["id"]

        soft = self.client.delete(f"/api/comments/{comment_id}/")
        self.assertEqual(soft.status_code, 200)
        self.assertTrue(soft.data["is_hidden"])
        self.assertTrue(ContentComment.objects.filter(id=comment_id).exists())

        self.client.force_authenticate(self.admin)
        hard = self.client.delete(f"/api/comments/{comment_id}/")
        self.assertEqual(hard.status_code, 204)
        self.assertFalse(ContentComment.objects.filter(id=comment_id).exists())

    def test_discover_trending_uses_expected_score_formula(self):
        story_ct = ContentType.objects.get_for_model(Story)
        other_ct = ContentType.objects.get_for_model(Story)

        ContentViewEvent.objects.create(content_type=story_ct, object_id=self.story.id, user=self.reader)
        ContentReaction.objects.create(
            user=self.reader,
            content_type=story_ct,
            object_id=self.story.id,
            reaction=ReactionType.LIKE,
        )
        ContentComment.objects.create(
            user=self.reader,
            content_type=story_ct,
            object_id=self.story.id,
            body="Comment",
            anchor_type="paragraph",
            anchor_key="p:0",
            paragraph_index=0,
        )
        ReadingProgress.objects.create(
            user=self.reader,
            content_type=story_ct,
            object_id=self.story.id,
            progress_percent="95.00",
            completed=True,
        )

        for i in range(3):
            ContentViewEvent.objects.create(
                content_type=other_ct,
                object_id=self.other_story.id,
                anon_key=f"anon-{i}",
            )

        response = self.client.get("/api/discover/trending/?range=week&type=story&limit=10")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data["results"]), 2)
        top = response.data["results"][0]
        self.assertEqual(top["work"]["id"], self.story.id)
        self.assertEqual(top["score"], 10.0)

    def test_recommendations_require_auth_and_return_reason(self):
        unauth = self.client.get("/api/discover/recommended/?limit=20")
        self.assertEqual(unauth.status_code, 401)

        AuthorFollow.objects.create(follower=self.reader, author=self.followed_author)
        story_ct = ContentType.objects.get_for_model(Story)
        ContentViewEvent.objects.create(content_type=story_ct, object_id=self.followed_story.id, user=self.other_reader)
        ReadingProgress.objects.create(
            user=self.reader,
            content_type=story_ct,
            object_id=self.story.id,
            progress_percent="50.00",
        )

        self.client.force_authenticate(self.reader)
        response = self.client.get("/api/discover/recommended/?limit=20")
        self.assertEqual(response.status_code, 200)
        reasons = {
            item["work"]["id"]: item["reason"]
            for item in response.data["results"]
        }
        self.assertIn(self.followed_story.id, reasons)
        self.assertTrue(reasons[self.followed_story.id].startswith(f"Because you follow @{self.followed_author.username}"))

    def test_writer_analytics_permissions_and_aggregation(self):
        story_ct = ContentType.objects.get_for_model(Story)
        ContentViewEvent.objects.create(content_type=story_ct, object_id=self.story.id, user=self.reader)
        ContentViewEvent.objects.create(content_type=story_ct, object_id=self.story.id, anon_key="anon-reader")
        ContentReaction.objects.create(
            user=self.other_reader,
            content_type=story_ct,
            object_id=self.story.id,
            reaction=ReactionType.LIKE,
        )
        ContentComment.objects.create(
            user=self.other_reader,
            content_type=story_ct,
            object_id=self.story.id,
            body="Strong story",
            anchor_type="paragraph",
            anchor_key="p:0",
            paragraph_index=0,
        )
        ReadingProgress.objects.create(
            user=self.reader,
            content_type=story_ct,
            object_id=self.story.id,
            progress_percent="95.00",
            completed=True,
        )
        AuthorFollow.objects.create(follower=self.reader, author=self.author)

        self.client.force_authenticate(self.reader)
        denied = self.client.get("/api/me/analytics/overview/?range=all")
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.author)
        overview = self.client.get("/api/me/analytics/overview/?range=all")
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.data["metrics"]["views"], 2)
        self.assertEqual(overview.data["metrics"]["unique_readers"], 2)
        self.assertEqual(overview.data["metrics"]["likes"], 1)
        self.assertEqual(overview.data["metrics"]["comments"], 1)
        self.assertEqual(overview.data["metrics"]["completions"], 1)
        self.assertEqual(overview.data["metrics"]["avg_progress"], 95.0)
        self.assertEqual(overview.data["follower_growth"], 1)

        works = self.client.get("/api/me/analytics/works/?range=all&sort=likes")
        self.assertEqual(works.status_code, 200)
        story_row = next((row for row in works.data["results"] if row["work"]["id"] == self.story.id), None)
        self.assertIsNotNone(story_row)
        self.assertEqual(story_row["metrics"]["likes"], 1)
        self.assertEqual(story_row["metrics"]["comments"], 1)

        detail = self.client.get(f"/api/me/analytics/works/{self.story.id}/?range=all&work_type=stories")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["result"]["work"]["id"], self.story.id)
        self.assertEqual(detail.data["result"]["metrics"]["views"], 2)

    def test_referral_tracking_dedupes_by_ref_code_and_visitor(self):
        self.client.force_authenticate(None)
        first = self.client.post("/api/referrals/visit/", {"ref": "@writer_contract"}, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data["tracked"])
        self.assertTrue(first.data["created"])
        self.assertEqual(first.data["ref_code"], "writer_contract")

        second = self.client.post("/api/referrals/visit/", {"ref_code": "writer_contract"}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["tracked"])
        self.assertFalse(second.data["created"])
        self.assertEqual(ReferralVisit.objects.filter(ref_code="writer_contract").count(), 1)

        self.client.force_authenticate(self.author)
        self_ref = self.client.post("/api/referrals/visit/", {"ref": "@writer_contract"}, format="json")
        self.assertEqual(self_ref.status_code, 200)
        self.assertFalse(self_ref.data["tracked"])

    def test_share_routes_return_png_and_og_html(self):
        image = self.client.get(f"/api/share-card/work/{self.story.id}.png?work_type=stories")
        self.assertEqual(image.status_code, 200)
        self.assertEqual(image["Content-Type"], "image/png")
        self.assertGreater(len(image.content), 10)

        html = self.client.get(f"/share/work/{self.story.id}/?work_type=stories")
        self.assertEqual(html.status_code, 200)
        self.assertIn("og:title", html.content.decode("utf-8"))

    def test_trending_related_indexes_exist(self):
        reaction_indexes = {tuple(index.fields) for index in ContentReaction._meta.indexes}
        comment_indexes = {tuple(index.fields) for index in ContentComment._meta.indexes}
        progress_indexes = {tuple(index.fields) for index in ReadingProgress._meta.indexes}
        view_indexes = {tuple(index.fields) for index in ContentViewEvent._meta.indexes}

        self.assertIn(("content_type", "object_id", "reaction", "-created_at"), reaction_indexes)
        self.assertIn(("content_type", "object_id", "anchor_type", "anchor_key", "-created_at"), comment_indexes)
        self.assertIn(("content_type", "object_id", "progress_percent", "-updated_at"), progress_indexes)
        self.assertIn(("content_type", "object_id", "-created_at"), view_indexes)
