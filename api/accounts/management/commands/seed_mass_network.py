from __future__ import annotations

import io
import random
from dataclasses import dataclass

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group
from django.contrib.contenttypes.models import ContentType
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageDraw
from rest_framework.test import APIClient

from accounts.constants import GROUP_READERS, GROUP_WRITERS, REGISTERED_ROLE_READER, REGISTERED_ROLE_WRITER
from accounts.models import UserProfile
from accounts.utils import ensure_default_groups
from content.models import Book, Chapter, Poem, StatusChoices, Story
from engagement.models import (
    AuthorFollow,
    CommentAnchorType,
    ContentComment,
    ContentReaction,
    ContentViewEvent,
    ReadingProgress,
    ReactionType,
)


SEED_READER_PREFIX = "seed_reader_"
SEED_WRITER_PREFIX = "seed_writer_"
SEED_COMMENT_PREFIX = "[seed]"
WORD_BANK = [
    "amber", "atlas", "aurora", "autumn", "balcony", "basil", "beacon", "breeze", "bridge", "brook",
    "candle", "canvas", "cedar", "chamber", "chorus", "cinder", "circle", "cloud", "cobalt", "comet",
    "crimson", "dawn", "delta", "drift", "echo", "ember", "fern", "field", "flame", "forest", "fountain",
    "garden", "glade", "glimmer", "golden", "granite", "grove", "harbor", "harmony", "hazel", "horizon",
    "island", "jasmine", "journey", "lantern", "lattice", "legend", "lilac", "lumen", "marble", "meadow",
    "memory", "midnight", "mist", "morning", "mosaic", "mountain", "nacre", "nebula", "nightfall", "oasis",
    "ocean", "opal", "orbit", "origin", "palette", "paper", "parchment", "path", "pearl", "petal",
    "photon", "pillar", "pine", "planet", "plaza", "prairie", "pulse", "quartz", "quiet", "rain",
    "raven", "reed", "river", "rose", "saffron", "sail", "sapphire", "scarlet", "season", "shadow",
    "shore", "signal", "silver", "skyline", "solstice", "spark", "spring", "stone", "summer", "summit",
    "sunrise", "sunset", "table", "tapestry", "thunder", "timber", "trail", "valley", "velvet", "violet",
    "vista", "water", "whisper", "willow", "winter", "woodland", "zephyr",
]


@dataclass
class UserSeedResult:
    users: list
    created: int


def _seed_username(prefix: str, index: int) -> str:
    return f"{prefix}{index:05d}"


def _seed_email(username: str) -> str:
    return f"{username}@seed.readus.local"


def _sample_without_replacement(rng: random.Random, source: list, amount: int):
    if not source or amount <= 0:
        return []
    if amount >= len(source):
        return list(source)
    return rng.sample(source, amount)


class Command(BaseCommand):
    help = "Generate a large persistent reader/writer/content network for manual QA."

    def add_arguments(self, parser):
        parser.add_argument("--readers", type=int, default=2000)
        parser.add_argument("--writers", type=int, default=200)
        parser.add_argument("--reader-start-index", type=int, default=50001)
        parser.add_argument("--writer-start-index", type=int, default=70001)
        parser.add_argument("--reader-password", type=str, default="Reader@123")
        parser.add_argument("--writer-password", type=str, default="Writer@123")
        parser.add_argument("--reset-first", action="store_true")
        parser.add_argument("--stories-per-writer", type=int, default=4)
        parser.add_argument("--poems-per-writer", type=int, default=2)
        parser.add_argument("--books-per-writer", type=int, default=1)
        parser.add_argument("--chapters-per-book", type=int, default=4)
        parser.add_argument("--follows-per-reader", type=int, default=8)
        parser.add_argument("--likes-per-reader", type=int, default=10)
        parser.add_argument("--comments-per-reader", type=int, default=3)
        parser.add_argument("--progress-per-reader", type=int, default=10)
        parser.add_argument("--rng-seed", type=int, default=20260305)
        parser.add_argument("--avatar-pool-size", type=int, default=120)
        parser.add_argument("--cover-pool-size", type=int, default=180)
        parser.add_argument("--min-body-paragraphs", type=int, default=10)
        parser.add_argument("--max-body-paragraphs", type=int, default=16)
        parser.add_argument("--min-body-words", type=int, default=45)
        parser.add_argument("--max-body-words", type=int, default=85)
        parser.add_argument("--skip-body-refresh", action="store_true")
        parser.add_argument("--skip-smoke-check", action="store_true")

    def handle(self, *args, **options):
        readers_target = int(options["readers"])
        writers_target = int(options["writers"])
        reader_start_index = int(options["reader_start_index"])
        writer_start_index = int(options["writer_start_index"])
        if readers_target <= 0 or writers_target <= 0:
            raise CommandError("--readers and --writers must be positive integers.")
        if reader_start_index <= 0 or writer_start_index <= 0:
            raise CommandError("--reader-start-index and --writer-start-index must be positive integers.")

        if options.get("reset_first"):
            self.stdout.write(self.style.WARNING("Resetting previous seed data first..."))
            reset_stats = self._reset_seed_data()
            self.stdout.write(
                self.style.SUCCESS(
                    "Seed reset complete. "
                    f"users_deleted={reset_stats['users_deleted']}, "
                    f"stories_deleted={reset_stats['stories_deleted']}, "
                    f"poems_deleted={reset_stats['poems_deleted']}, "
                    f"books_deleted={reset_stats['books_deleted']}, "
                    f"chapters_deleted={reset_stats['chapters_deleted']}"
                )
            )

        ensure_default_groups()
        reader_group = Group.objects.get(name=GROUP_READERS)
        writer_group = Group.objects.get(name=GROUP_WRITERS)
        rng = random.Random(int(options["rng_seed"]))

        self.stdout.write(self.style.NOTICE("Preparing random photos..."))
        avatar_pool, cover_pool = self._ensure_seed_image_pools(
            rng=rng,
            avatar_pool_size=int(options["avatar_pool_size"]),
            cover_pool_size=int(options["cover_pool_size"]),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Random photos ready. avatars={len(avatar_pool)}, covers={len(cover_pool)}"
            )
        )

        self.stdout.write(self.style.NOTICE("Seeding users..."))
        reader_seed = self._ensure_seed_users(
            prefix=SEED_READER_PREFIX,
            total=readers_target,
            start_index=reader_start_index,
            password=options["reader_password"],
            role=REGISTERED_ROLE_READER,
            writer_approved=False,
            group=reader_group,
            avatar_pool=avatar_pool,
        )
        writer_seed = self._ensure_seed_users(
            prefix=SEED_WRITER_PREFIX,
            total=writers_target,
            start_index=writer_start_index,
            password=options["writer_password"],
            role=REGISTERED_ROLE_WRITER,
            writer_approved=True,
            group=writer_group,
            avatar_pool=avatar_pool,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Users ready. readers={len(reader_seed.users)} (created {reader_seed.created}), "
                f"writers={len(writer_seed.users)} (created {writer_seed.created})"
            )
        )

        self.stdout.write(self.style.NOTICE("Seeding content..."))
        content_stats = self._ensure_seed_content(
            writers=writer_seed.users,
            stories_per_writer=int(options["stories_per_writer"]),
            poems_per_writer=int(options["poems_per_writer"]),
            books_per_writer=int(options["books_per_writer"]),
            chapters_per_book=int(options["chapters_per_book"]),
            cover_pool=cover_pool,
            rng=rng,
            min_body_paragraphs=int(options["min_body_paragraphs"]),
            max_body_paragraphs=int(options["max_body_paragraphs"]),
            min_body_words=int(options["min_body_words"]),
            max_body_words=int(options["max_body_words"]),
            refresh_existing_bodies=not options["skip_body_refresh"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Content ready. "
                f"stories+{content_stats['stories_created']}, poems+{content_stats['poems_created']}, "
                f"books+{content_stats['books_created']}, chapters+{content_stats['chapters_created']}, "
                f"story_bodies_refreshed={content_stats['stories_refreshed']}, "
                f"poem_bodies_refreshed={content_stats['poems_refreshed']}, "
                f"book_bodies_refreshed={content_stats['books_refreshed']}, "
                f"chapter_bodies_refreshed={content_stats['chapters_refreshed']}"
            )
        )

        self.stdout.write(self.style.NOTICE("Seeding follows / likes / progress / views / comments..."))
        engagement_stats = self._seed_engagement(
            readers=reader_seed.users,
            writers=writer_seed.users,
            follows_per_reader=int(options["follows_per_reader"]),
            likes_per_reader=int(options["likes_per_reader"]),
            comments_per_reader=int(options["comments_per_reader"]),
            progress_per_reader=int(options["progress_per_reader"]),
            rng=rng,
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Engagement ready. "
                f"follows+{engagement_stats['follows_created']}, likes+{engagement_stats['likes_created']}, "
                f"progress+{engagement_stats['progress_created']}, views+{engagement_stats['views_created']}, "
                f"comments+{engagement_stats['comments_created']}, replies+{engagement_stats['replies_created']}"
            )
        )

        if not options["skip_smoke_check"]:
            self.stdout.write(self.style.NOTICE("Running API smoke checks..."))
            smoke = self._run_smoke_checks(
                reader=reader_seed.users[0],
                writer=writer_seed.users[0],
                writer_password=options["writer_password"],
            )
            self.stdout.write(self.style.SUCCESS(f"Smoke checks passed: {smoke}"))

        totals = {
            "seed_readers": reader_seed.users,
            "seed_writers": writer_seed.users,
        }
        self.stdout.write(self.style.SUCCESS("Seeding finished. Data was only added/updated, never deleted."))
        self.stdout.write(
            self.style.SUCCESS(
                "Final seed user totals: "
                f"readers={len(totals['seed_readers'])}, writers={len(totals['seed_writers'])}"
            )
        )

    def _reset_seed_data(self) -> dict[str, int]:
        User = get_user_model()

        seed_user_filter = Q(username__startswith=SEED_READER_PREFIX) | Q(username__startswith=SEED_WRITER_PREFIX)
        seed_user_ids = list(User.objects.filter(seed_user_filter).values_list("id", flat=True))

        chapters_deleted = Chapter.objects.filter(
            Q(book__author_id__in=seed_user_ids) | Q(title__startswith="Seed Chapter ")
        ).delete()[0]
        stories_deleted = Story.objects.filter(
            Q(author_id__in=seed_user_ids) | Q(title__startswith="Seed Story ")
        ).delete()[0]
        poems_deleted = Poem.objects.filter(
            Q(author_id__in=seed_user_ids) | Q(title__startswith="Seed Poem ")
        ).delete()[0]
        books_deleted = Book.objects.filter(
            Q(author_id__in=seed_user_ids) | Q(title__startswith="Seed Book ")
        ).delete()[0]
        users_deleted = User.objects.filter(id__in=seed_user_ids).delete()[0]

        return {
            "users_deleted": users_deleted,
            "stories_deleted": stories_deleted,
            "poems_deleted": poems_deleted,
            "books_deleted": books_deleted,
            "chapters_deleted": chapters_deleted,
        }

    def _ensure_seed_users(
        self,
        *,
        prefix: str,
        total: int,
        start_index: int,
        password: str,
        role: str,
        writer_approved: bool,
        group,
        avatar_pool: list[str],
    ) -> UserSeedResult:
        User = get_user_model()
        usernames = [_seed_username(prefix, idx) for idx in range(start_index, start_index + total)]
        password_hash = make_password(password)
        now = timezone.now()

        existing_usernames = set(User.objects.filter(username__in=usernames).values_list("username", flat=True))
        missing = [username for username in usernames if username not in existing_usernames]

        users_to_create = []
        for username in missing:
            users_to_create.append(
                User(
                    username=username,
                    email=_seed_email(username),
                    is_active=True,
                    first_name="Seed",
                    last_name="Writer" if writer_approved else "Reader",
                    password=password_hash,
                )
            )

        with transaction.atomic():
            if users_to_create:
                User.objects.bulk_create(users_to_create, batch_size=500)

            # Enforce expected credentials for all seed users with this prefix.
            User.objects.filter(username__in=usernames).update(password=password_hash, is_active=True)

            users = list(User.objects.filter(username__in=usernames).order_by("username"))
            user_ids = [user.id for user in users]

            profiles_by_user = {
                item.user_id: item
                for item in UserProfile.objects.filter(user_id__in=user_ids)
            }
            missing_profiles = []
            profiles_to_update = []
            for user in users:
                avatar_path = avatar_pool[user.id % len(avatar_pool)] if avatar_pool else ""
                profile = profiles_by_user.get(user.id)
                if not profile:
                    missing_profiles.append(
                        UserProfile(
                            user_id=user.id,
                            role_registered=role,
                            is_writer_approved=writer_approved,
                            forced_password_change=False,
                            profile_photo=avatar_path or None,
                        )
                    )
                    continue
                changed = False
                if profile.role_registered != role:
                    profile.role_registered = role
                    changed = True
                if profile.is_writer_approved != writer_approved:
                    profile.is_writer_approved = writer_approved
                    changed = True
                if profile.forced_password_change:
                    profile.forced_password_change = False
                    changed = True
                if avatar_path and str(profile.profile_photo or "") != avatar_path:
                    profile.profile_photo = avatar_path
                    changed = True
                if changed:
                    profile.updated_at = now
                    profiles_to_update.append(profile)

            if missing_profiles:
                UserProfile.objects.bulk_create(missing_profiles, batch_size=500)
            if profiles_to_update:
                UserProfile.objects.bulk_update(
                    profiles_to_update,
                    fields=["role_registered", "is_writer_approved", "forced_password_change", "profile_photo", "updated_at"],
                    batch_size=500,
                )

            existing_addresses = set(
                EmailAddress.objects.filter(user_id__in=user_ids).values_list("user_id", "email")
            )
            email_rows = []
            for user in users:
                pair = (user.id, user.email)
                if pair not in existing_addresses:
                    email_rows.append(
                        EmailAddress(
                            user_id=user.id,
                            email=user.email,
                            verified=True,
                            primary=True,
                        )
                    )
            if email_rows:
                EmailAddress.objects.bulk_create(email_rows, ignore_conflicts=True, batch_size=500)
            EmailAddress.objects.filter(user_id__in=user_ids).update(verified=True, primary=True)

            group_membership = User.groups.through
            existing_members = set(
                group_membership.objects.filter(user_id__in=user_ids, group_id=group.id).values_list("user_id", flat=True)
            )
            missing_members = [
                group_membership(user_id=user_id, group_id=group.id)
                for user_id in user_ids
                if user_id not in existing_members
            ]
            if missing_members:
                group_membership.objects.bulk_create(missing_members, ignore_conflicts=True, batch_size=1000)

        return UserSeedResult(users=users, created=len(users_to_create))

    def _ensure_seed_content(
        self,
        *,
        writers: list,
        stories_per_writer: int,
        poems_per_writer: int,
        books_per_writer: int,
        chapters_per_book: int,
        cover_pool: list[str],
        rng: random.Random,
        min_body_paragraphs: int,
        max_body_paragraphs: int,
        min_body_words: int,
        max_body_words: int,
        refresh_existing_bodies: bool,
    ) -> dict[str, int]:
        writer_ids = [writer.id for writer in writers]
        now = timezone.now()
        story_existing = set(
            Story.objects.filter(author_id__in=writer_ids, title__startswith="Seed Story ")
            .values_list("author_id", "title")
        )
        poem_existing = set(
            Poem.objects.filter(author_id__in=writer_ids, title__startswith="Seed Poem ")
            .values_list("author_id", "title")
        )
        book_existing = set(
            Book.objects.filter(author_id__in=writer_ids, title__startswith="Seed Book ")
            .values_list("author_id", "title")
        )

        stories_to_create = []
        poems_to_create = []
        books_to_create = []

        for writer in writers:
            for idx in range(1, stories_per_writer + 1):
                title = f"Seed Story {writer.username} #{idx}"
                if (writer.id, title) in story_existing:
                    continue
                cover_path = cover_pool[(writer.id + idx) % len(cover_pool)] if cover_pool else None
                stories_to_create.append(
                    Story(
                        author_id=writer.id,
                        title=title,
                        public_slug=f"seed-story-{writer.id}-{idx}",
                        description=(
                            f"<p>{self._random_paragraph(rng, min_words=22, max_words=36)}</p>"
                        ),
                        body=self._random_body_html(
                            rng=rng,
                            block_prefix=f"{writer.username}-story-{idx}",
                            min_paragraphs=min_body_paragraphs,
                            max_paragraphs=max_body_paragraphs,
                            min_words=min_body_words,
                            max_words=max_body_words,
                        ),
                        status=StatusChoices.APPROVED,
                        status_changed_at=now,
                        is_hidden=False,
                        is_deleted=False,
                        is_anonymous=(idx % 5 == 0),
                        cover_image=cover_path,
                    )
                )

            for idx in range(1, poems_per_writer + 1):
                title = f"Seed Poem {writer.username} #{idx}"
                if (writer.id, title) in poem_existing:
                    continue
                cover_path = cover_pool[(writer.id + 37 + idx) % len(cover_pool)] if cover_pool else None
                poems_to_create.append(
                    Poem(
                        author_id=writer.id,
                        title=title,
                        public_slug=f"seed-poem-{writer.id}-{idx}",
                        description=(
                            f"<p>{self._random_paragraph(rng, min_words=14, max_words=26)}</p>"
                        ),
                        body=self._random_body_html(
                            rng=rng,
                            block_prefix=f"{writer.username}-poem-{idx}",
                            min_paragraphs=max(8, min_body_paragraphs - 2),
                            max_paragraphs=max(10, max_body_paragraphs - 1),
                            min_words=max(10, min_body_words // 2),
                            max_words=max(18, max_body_words // 2),
                        ),
                        status=StatusChoices.APPROVED,
                        status_changed_at=now,
                        is_hidden=False,
                        is_deleted=False,
                        is_anonymous=(idx % 4 == 0),
                        cover_image=cover_path,
                    )
                )

            for idx in range(1, books_per_writer + 1):
                title = f"Seed Book {writer.username} #{idx}"
                if (writer.id, title) in book_existing:
                    continue
                cover_path = cover_pool[(writer.id + 73 + idx) % len(cover_pool)] if cover_pool else None
                books_to_create.append(
                    Book(
                        author_id=writer.id,
                        title=title,
                        public_slug=f"seed-book-{writer.id}-{idx}",
                        description=(
                            f"<p>{self._random_paragraph(rng, min_words=20, max_words=34)}</p>"
                        ),
                        foreword=self._random_body_html(
                            rng=rng,
                            block_prefix=f"{writer.username}-book-{idx}-foreword",
                            min_paragraphs=max(4, min_body_paragraphs // 2),
                            max_paragraphs=max(6, max_body_paragraphs // 2),
                            min_words=max(26, min_body_words - 10),
                            max_words=max(40, max_body_words - 8),
                        ),
                        afterword=self._random_body_html(
                            rng=rng,
                            block_prefix=f"{writer.username}-book-{idx}-afterword",
                            min_paragraphs=max(3, min_body_paragraphs // 3),
                            max_paragraphs=max(5, max_body_paragraphs // 3),
                            min_words=max(18, min_body_words - 20),
                            max_words=max(30, max_body_words - 20),
                        ),
                        status=StatusChoices.APPROVED,
                        status_changed_at=now,
                        is_hidden=False,
                        is_deleted=False,
                        is_anonymous=(idx % 6 == 0),
                        cover_image=cover_path,
                    )
                )

        with transaction.atomic():
            if stories_to_create:
                Story.objects.bulk_create(stories_to_create, batch_size=500)
            if poems_to_create:
                Poem.objects.bulk_create(poems_to_create, batch_size=500)
            if books_to_create:
                Book.objects.bulk_create(books_to_create, batch_size=500)

        seed_books = list(
            Book.objects.filter(author_id__in=writer_ids, title__startswith="Seed Book ").order_by("id")
        )
        book_ids = [book.id for book in seed_books]
        chapter_orders = set(Chapter.objects.filter(book_id__in=book_ids).values_list("book_id", "order"))
        chapters_to_create = []
        for book in seed_books:
            for order in range(1, chapters_per_book + 1):
                if (book.id, order) in chapter_orders:
                    continue
                chapters_to_create.append(
                    Chapter(
                        book_id=book.id,
                        title=f"Seed Chapter {order}",
                        order=order,
                        body=self._random_body_html(
                            rng=rng,
                            block_prefix=f"book-{book.id}-chapter-{order}",
                            min_paragraphs=min_body_paragraphs,
                            max_paragraphs=max_body_paragraphs,
                            min_words=min_body_words,
                            max_words=max_body_words,
                        ),
                        status=StatusChoices.APPROVED,
                        status_changed_at=timezone.now(),
                    )
                )
        if chapters_to_create:
            Chapter.objects.bulk_create(chapters_to_create, batch_size=1000)

        body_refresh_stats = {"stories_refreshed": 0, "poems_refreshed": 0, "books_refreshed": 0, "chapters_refreshed": 0}
        if refresh_existing_bodies:
            body_refresh_stats = self._refresh_existing_seed_bodies(
                writer_ids=writer_ids,
                rng=rng,
                min_body_paragraphs=min_body_paragraphs,
                max_body_paragraphs=max_body_paragraphs,
                min_body_words=min_body_words,
                max_body_words=max_body_words,
            )

        self._ensure_missing_cover_images(writer_ids=writer_ids, cover_pool=cover_pool)

        return {
            "stories_created": len(stories_to_create),
            "poems_created": len(poems_to_create),
            "books_created": len(books_to_create),
            "chapters_created": len(chapters_to_create),
            **body_refresh_stats,
        }

    def _seed_engagement(
        self,
        *,
        readers: list,
        writers: list,
        follows_per_reader: int,
        likes_per_reader: int,
        comments_per_reader: int,
        progress_per_reader: int,
        rng: random.Random,
    ) -> dict[str, int]:
        writer_ids = [writer.id for writer in writers]
        reader_ids = [reader.id for reader in readers]

        story_ct = ContentType.objects.get_for_model(Story).id
        poem_ct = ContentType.objects.get_for_model(Poem).id
        book_ct = ContentType.objects.get_for_model(Book).id
        chapter_ct = ContentType.objects.get_for_model(Chapter).id

        story_ids = list(Story.objects.filter(author_id__in=writer_ids, title__startswith="Seed Story ").values_list("id", flat=True))
        poem_ids = list(Poem.objects.filter(author_id__in=writer_ids, title__startswith="Seed Poem ").values_list("id", flat=True))
        book_ids = list(Book.objects.filter(author_id__in=writer_ids, title__startswith="Seed Book ").values_list("id", flat=True))
        chapter_ids = list(Chapter.objects.filter(book_id__in=book_ids).values_list("id", flat=True))

        work_targets = [(story_ct, item_id) for item_id in story_ids]
        work_targets.extend((poem_ct, item_id) for item_id in poem_ids)
        work_targets.extend((book_ct, item_id) for item_id in book_ids)
        chapter_targets = [(chapter_ct, item_id) for item_id in chapter_ids]
        all_targets = [*work_targets, *chapter_targets]
        if not all_targets:
            raise CommandError("No seed content targets found. Cannot generate engagement.")

        follows = []
        for reader_id in reader_ids:
            for author_id in _sample_without_replacement(rng, writer_ids, follows_per_reader):
                follows.append(AuthorFollow(follower_id=reader_id, author_id=author_id))
        AuthorFollow.objects.bulk_create(follows, ignore_conflicts=True, batch_size=5000)

        likes = []
        for reader_id in reader_ids:
            for content_type_id, object_id in _sample_without_replacement(rng, all_targets, likes_per_reader):
                likes.append(
                    ContentReaction(
                        user_id=reader_id,
                        content_type_id=content_type_id,
                        object_id=object_id,
                        reaction=ReactionType.LIKE,
                    )
                )
        ContentReaction.objects.bulk_create(likes, ignore_conflicts=True, batch_size=10000)

        progresses = []
        views = []
        for reader_id in reader_ids:
            chosen = _sample_without_replacement(rng, all_targets, progress_per_reader)
            for content_type_id, object_id in chosen:
                progress_value = round(rng.uniform(6.0, 100.0), 2)
                paragraph_index = rng.randint(0, 2)
                chapter_id = object_id if content_type_id == chapter_ct else None
                progresses.append(
                    ReadingProgress(
                        user_id=reader_id,
                        content_type_id=content_type_id,
                        object_id=object_id,
                        chapter_id=chapter_id,
                        progress_percent=progress_value,
                        paragraph_index=paragraph_index,
                        cursor=f"seed-{reader_id}-{content_type_id}-{object_id}",
                        last_position={"paragraph_index": paragraph_index},
                        completed=progress_value >= 90.0,
                    )
                )
                views.append(
                    ContentViewEvent(
                        user_id=reader_id,
                        content_type_id=content_type_id,
                        object_id=object_id,
                        paragraph_index=paragraph_index,
                    )
                )
                views.append(
                    ContentViewEvent(
                        user_id=reader_id,
                        content_type_id=content_type_id,
                        object_id=object_id,
                        paragraph_index=paragraph_index,
                    )
                )
        ReadingProgress.objects.bulk_create(progresses, ignore_conflicts=True, batch_size=10000)
        ContentViewEvent.objects.bulk_create(views, batch_size=15000)

        comments = []
        replies = []
        if comments_per_reader > 0:
            comment_targets = all_targets if len(all_targets) < 3000 else all_targets[:3000]
            for reader_id in reader_ids:
                for content_type_id, object_id in _sample_without_replacement(rng, comment_targets, comments_per_reader):
                    paragraph_index = rng.randint(0, 2)
                    comments.append(
                        ContentComment(
                            user_id=reader_id,
                            content_type_id=content_type_id,
                            object_id=object_id,
                            body=f"{SEED_COMMENT_PREFIX} Reader {reader_id} comment on target {object_id}",
                            anchor_type=CommentAnchorType.PARAGRAPH,
                            anchor_key=f"p:{paragraph_index}",
                            paragraph_index=paragraph_index,
                            excerpt="Seed generated comment.",
                        )
                    )
            ContentComment.objects.bulk_create(comments, batch_size=10000)

            seed_roots = list(
                ContentComment.objects.filter(body__startswith=SEED_COMMENT_PREFIX, parent_id__isnull=True)
                .order_by("-id")
                .values("id", "content_type_id", "object_id")[:5000]
            )
            for root in seed_roots[: max(500, len(seed_roots) // 8)]:
                replying_user = reader_ids[rng.randint(0, len(reader_ids) - 1)]
                paragraph_index = rng.randint(0, 2)
                replies.append(
                    ContentComment(
                        user_id=replying_user,
                        content_type_id=root["content_type_id"],
                        object_id=root["object_id"],
                        parent_id=root["id"],
                        body=f"{SEED_COMMENT_PREFIX} Reply to comment {root['id']}",
                        anchor_type=CommentAnchorType.PARAGRAPH,
                        anchor_key=f"p:{paragraph_index}",
                        paragraph_index=paragraph_index,
                        excerpt="Seed generated reply.",
                    )
                )
            if replies:
                ContentComment.objects.bulk_create(replies, batch_size=5000)

        follows_count = AuthorFollow.objects.filter(follower_id__in=reader_ids, author_id__in=writer_ids).count()
        likes_count = ContentReaction.objects.filter(
            user_id__in=reader_ids,
            reaction=ReactionType.LIKE,
            content_type_id__in=[story_ct, poem_ct, book_ct, chapter_ct],
        ).count()
        progress_count = ReadingProgress.objects.filter(user_id__in=reader_ids).count()
        views_count = ContentViewEvent.objects.filter(user_id__in=reader_ids).count()
        comments_count = ContentComment.objects.filter(body__startswith=SEED_COMMENT_PREFIX, parent_id__isnull=True).count()
        replies_count = ContentComment.objects.filter(body__startswith=SEED_COMMENT_PREFIX, parent_id__isnull=False).count()

        return {
            "follows_created": follows_count,
            "likes_created": likes_count,
            "progress_created": progress_count,
            "views_created": views_count,
            "comments_created": comments_count,
            "replies_created": replies_count,
        }

    def _run_smoke_checks(self, *, reader, writer, writer_password: str) -> dict[str, int]:
        client = APIClient()
        client.defaults["HTTP_HOST"] = "localhost"

        sample_story = Story.objects.filter(author=writer, status=StatusChoices.APPROVED, is_hidden=False, is_deleted=False).first()
        sample_chapter = (
            Chapter.objects.filter(book__author=writer, status=StatusChoices.APPROVED, book__is_hidden=False, book__is_deleted=False)
            .order_by("id")
            .first()
        )
        if not sample_story or not sample_chapter:
            raise CommandError("Smoke check could not find sample story/chapter.")

        status_codes: dict[str, int] = {}

        trending = client.get("/api/discover/trending/?range=week&type=story&limit=5")
        status_codes["trending"] = trending.status_code
        if trending.status_code != 200:
            raise CommandError(f"Smoke check failed: trending returned {trending.status_code}")

        client.force_authenticate(user=reader)
        recommended = client.get("/api/discover/recommended/?limit=5")
        status_codes["recommended"] = recommended.status_code
        if recommended.status_code != 200:
            raise CommandError(f"Smoke check failed: recommended returned {recommended.status_code}")

        like = client.post(
            "/api/likes/",
            {"target_type": "work", "target_id": sample_story.id, "work_type": "stories"},
            format="json",
        )
        status_codes["like"] = like.status_code
        if like.status_code != 200:
            raise CommandError(f"Smoke check failed: like returned {like.status_code}")

        unlike = client.delete(
            "/api/likes/",
            {"target_type": "work", "target_id": sample_story.id, "work_type": "stories"},
            format="json",
        )
        status_codes["unlike"] = unlike.status_code
        if unlike.status_code != 200:
            raise CommandError(f"Smoke check failed: unlike returned {unlike.status_code}")

        comment = client.post(
            "/api/comments/",
            {
                "target_type": "chapter",
                "target_id": sample_chapter.id,
                "anchor_type": "paragraph",
                "anchor_key": "p:0",
                "body": f"{SEED_COMMENT_PREFIX} smoke check comment",
            },
            format="json",
        )
        status_codes["comment_create"] = comment.status_code
        if comment.status_code != 201:
            raise CommandError(f"Smoke check failed: comment create returned {comment.status_code}")
        comment_id = int(comment.data["id"])

        client.force_authenticate(user=writer)
        hide = client.patch(
            f"/api/comments/{comment_id}/hide/",
            {"is_hidden": True, "reason": "Smoke-check hide"},
            format="json",
        )
        status_codes["comment_hide"] = hide.status_code
        if hide.status_code != 200:
            raise CommandError(f"Smoke check failed: comment hide returned {hide.status_code}")

        analytics = client.get("/api/me/analytics/overview/?range=30d")
        status_codes["analytics"] = analytics.status_code
        if analytics.status_code != 200:
            raise CommandError(f"Smoke check failed: analytics overview returned {analytics.status_code}")

        notifications = client.get("/api/notifications/unread-count/")
        status_codes["notifications"] = notifications.status_code
        if notifications.status_code != 200:
            raise CommandError(f"Smoke check failed: notifications unread-count returned {notifications.status_code}")

        # Keep writer credentials exercised for manual QA in auth flows if needed.
        if not writer.check_password(writer_password):
            raise CommandError("Smoke check failed: writer password mismatch after seed.")

        return status_codes

    def _random_paragraph(self, rng: random.Random, *, min_words: int, max_words: int) -> str:
        total_words = max(5, rng.randint(min_words, max_words))
        words = [WORD_BANK[rng.randrange(len(WORD_BANK))] for _ in range(total_words)]
        if words:
            words[0] = words[0].capitalize()
        text = " ".join(words).strip()
        if not text.endswith("."):
            text = f"{text}."
        return text

    def _random_body_html(
        self,
        *,
        rng: random.Random,
        block_prefix: str,
        min_paragraphs: int,
        max_paragraphs: int,
        min_words: int,
        max_words: int,
    ) -> str:
        paragraph_count = max(1, rng.randint(min_paragraphs, max_paragraphs))
        rows = []
        for index in range(paragraph_count):
            paragraph_text = self._random_paragraph(rng, min_words=min_words, max_words=max_words)
            if index == 0:
                rows.append(f'<p id="{block_prefix}-p{index}">{paragraph_text}</p>')
            else:
                rows.append(f'<p data-block-id="{block_prefix}-p{index}">{paragraph_text}</p>')
        return "".join(rows)

    def _refresh_existing_seed_bodies(
        self,
        *,
        writer_ids: list[int],
        rng: random.Random,
        min_body_paragraphs: int,
        max_body_paragraphs: int,
        min_body_words: int,
        max_body_words: int,
    ) -> dict[str, int]:
        stories = list(
            Story.objects.filter(author_id__in=writer_ids, title__startswith="Seed Story ")
            .only("id", "author_id", "title", "description", "body")
            .order_by("id")
        )
        poems = list(
            Poem.objects.filter(author_id__in=writer_ids, title__startswith="Seed Poem ")
            .only("id", "author_id", "title", "description", "body")
            .order_by("id")
        )
        books = list(
            Book.objects.filter(author_id__in=writer_ids, title__startswith="Seed Book ")
            .only("id", "author_id", "title", "description", "foreword", "afterword")
            .order_by("id")
        )
        chapters = list(
            Chapter.objects.filter(book__author_id__in=writer_ids, title__startswith="Seed Chapter ")
            .select_related("book")
            .only("id", "book_id", "order", "title", "body", "book__author_id")
            .order_by("id")
        )

        for story in stories:
            local_rng = random.Random(f"story-refresh-{story.id}-{rng.randint(1, 10_000_000)}")
            story.description = f"<p>{self._random_paragraph(local_rng, min_words=22, max_words=36)}</p>"
            story.body = self._random_body_html(
                rng=local_rng,
                block_prefix=f"seed-story-refresh-{story.id}",
                min_paragraphs=min_body_paragraphs,
                max_paragraphs=max_body_paragraphs,
                min_words=min_body_words,
                max_words=max_body_words,
            )

        for poem in poems:
            local_rng = random.Random(f"poem-refresh-{poem.id}-{rng.randint(1, 10_000_000)}")
            poem.description = f"<p>{self._random_paragraph(local_rng, min_words=14, max_words=26)}</p>"
            poem.body = self._random_body_html(
                rng=local_rng,
                block_prefix=f"seed-poem-refresh-{poem.id}",
                min_paragraphs=max(8, min_body_paragraphs - 2),
                max_paragraphs=max(10, max_body_paragraphs - 1),
                min_words=max(10, min_body_words // 2),
                max_words=max(18, max_body_words // 2),
            )

        for book in books:
            local_rng = random.Random(f"book-refresh-{book.id}-{rng.randint(1, 10_000_000)}")
            book.description = f"<p>{self._random_paragraph(local_rng, min_words=20, max_words=34)}</p>"
            book.foreword = self._random_body_html(
                rng=local_rng,
                block_prefix=f"seed-book-refresh-{book.id}-foreword",
                min_paragraphs=max(4, min_body_paragraphs // 2),
                max_paragraphs=max(6, max_body_paragraphs // 2),
                min_words=max(26, min_body_words - 10),
                max_words=max(40, max_body_words - 8),
            )
            book.afterword = self._random_body_html(
                rng=local_rng,
                block_prefix=f"seed-book-refresh-{book.id}-afterword",
                min_paragraphs=max(3, min_body_paragraphs // 3),
                max_paragraphs=max(5, max_body_paragraphs // 3),
                min_words=max(18, min_body_words - 20),
                max_words=max(30, max_body_words - 20),
            )

        for chapter in chapters:
            local_rng = random.Random(f"chapter-refresh-{chapter.id}-{rng.randint(1, 10_000_000)}")
            chapter.body = self._random_body_html(
                rng=local_rng,
                block_prefix=f"seed-chapter-refresh-{chapter.id}",
                min_paragraphs=min_body_paragraphs,
                max_paragraphs=max_body_paragraphs,
                min_words=min_body_words,
                max_words=max_body_words,
            )

        if stories:
            Story.objects.bulk_update(stories, fields=["description", "body"], batch_size=300)
        if poems:
            Poem.objects.bulk_update(poems, fields=["description", "body"], batch_size=300)
        if books:
            Book.objects.bulk_update(books, fields=["description", "foreword", "afterword"], batch_size=300)
        if chapters:
            Chapter.objects.bulk_update(chapters, fields=["body"], batch_size=500)

        return {
            "stories_refreshed": len(stories),
            "poems_refreshed": len(poems),
            "books_refreshed": len(books),
            "chapters_refreshed": len(chapters),
        }

    def _ensure_seed_image_pools(self, *, rng: random.Random, avatar_pool_size: int, cover_pool_size: int) -> tuple[list[str], list[str]]:
        avatar_paths = self._ensure_image_pool(
            subdir="uploads/seed/avatars",
            prefix="avatar",
            count=max(1, avatar_pool_size),
            width=512,
            height=512,
            rng=rng,
        )
        cover_paths = self._ensure_image_pool(
            subdir="uploads/seed/covers",
            prefix="cover",
            count=max(1, cover_pool_size),
            width=1200,
            height=1600,
            rng=rng,
        )
        return avatar_paths, cover_paths

    def _ensure_image_pool(
        self,
        *,
        subdir: str,
        prefix: str,
        count: int,
        width: int,
        height: int,
        rng: random.Random,
    ) -> list[str]:
        relative_paths: list[str] = []
        normalized_subdir = subdir.strip("/").replace("\\", "/")

        for idx in range(1, count + 1):
            filename = f"{prefix}_{idx:04d}.png"
            rel_path = f"{normalized_subdir}/{filename}"
            saved_path = rel_path
            if default_storage.exists(rel_path):
                relative_paths.append(rel_path)
                continue

            local_rng = random.Random(f"{prefix}-{idx}-{rng.randint(1, 10_000_000)}")
            base_color = (
                local_rng.randint(10, 220),
                local_rng.randint(10, 220),
                local_rng.randint(10, 220),
            )
            accent_color = (
                min(255, base_color[0] + local_rng.randint(10, 70)),
                min(255, base_color[1] + local_rng.randint(10, 70)),
                min(255, base_color[2] + local_rng.randint(10, 70)),
            )

            image = Image.new("RGB", (width, height), base_color)
            draw = ImageDraw.Draw(image)

            for _ in range(14):
                left = local_rng.randint(0, max(0, width - 80))
                top = local_rng.randint(0, max(0, height - 80))
                right = min(width, left + local_rng.randint(80, max(90, width // 3)))
                bottom = min(height, top + local_rng.randint(80, max(90, height // 3)))
                fill = (
                    min(255, accent_color[0] + local_rng.randint(-30, 30)),
                    min(255, accent_color[1] + local_rng.randint(-30, 30)),
                    min(255, accent_color[2] + local_rng.randint(-30, 30)),
                )
                draw.ellipse([left, top, right, bottom], fill=fill, outline=None)

            draw.rectangle([0, height - 70, width, height], fill=(0, 0, 0))
            draw.text((24, height - 48), f"Readus Seed {idx}", fill=(255, 255, 255))
            image_buffer = io.BytesIO()
            image.save(image_buffer, format="PNG", optimize=True)
            image_buffer.seek(0)
            saved_path = default_storage.save(rel_path, ContentFile(image_buffer.read()))
            relative_paths.append(saved_path.replace("\\", "/"))

        return relative_paths

    def _ensure_missing_cover_images(self, *, writer_ids: list[int], cover_pool: list[str]) -> None:
        if not cover_pool:
            return

        stories = list(
            Story.objects.filter(author_id__in=writer_ids, title__startswith="Seed Story ").only("id", "cover_image")
        )
        poems = list(
            Poem.objects.filter(author_id__in=writer_ids, title__startswith="Seed Poem ").only("id", "cover_image")
        )
        books = list(
            Book.objects.filter(author_id__in=writer_ids, title__startswith="Seed Book ").only("id", "cover_image")
        )

        story_updates = []
        for item in stories:
            if item.cover_image:
                continue
            item.cover_image = cover_pool[item.id % len(cover_pool)]
            story_updates.append(item)
        if story_updates:
            Story.objects.bulk_update(story_updates, fields=["cover_image"], batch_size=500)

        poem_updates = []
        for item in poems:
            if item.cover_image:
                continue
            item.cover_image = cover_pool[(item.id + 19) % len(cover_pool)]
            poem_updates.append(item)
        if poem_updates:
            Poem.objects.bulk_update(poem_updates, fields=["cover_image"], batch_size=500)

        book_updates = []
        for item in books:
            if item.cover_image:
                continue
            item.cover_image = cover_pool[(item.id + 41) % len(cover_pool)]
            book_updates.append(item)
        if book_updates:
            Book.objects.bulk_update(book_updates, fields=["cover_image"], batch_size=500)
