#!/bin/sh
set -e

if [ -n "${DATABASE_URL:-}" ]; then
    echo "Waiting for PostgreSQL from DATABASE_URL..."
else
    echo "Waiting for PostgreSQL at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."
fi
python - <<'PY'
import os
import sys
import time

import psycopg2

database_url = os.getenv("DATABASE_URL", "").strip()
max_attempts = 60

for attempt in range(1, max_attempts + 1):
    try:
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
            host = os.getenv("DB_HOST", "postgres")
            port = int(os.getenv("DB_PORT", "5432"))
            user = os.getenv("DB_USER", "postgres")
            password = os.getenv("DB_PASSWORD", "postgres")
            dbname = os.getenv("DB_NAME", "postgres")
            conn = psycopg2.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                dbname=dbname,
            )
        conn.close()
        print("PostgreSQL is ready.")
        break
    except Exception as exc:
        print(f"[{attempt}/{max_attempts}] waiting for database: {exc}")
        time.sleep(1)
else:
    print("Database did not become ready in time.", file=sys.stderr)
    sys.exit(1)
PY

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
python - <<'PY'
import os
import subprocess
import sys
import time

import psycopg2


def connect_db():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "postgres"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "postgres"),
    )


lock_id = int(os.getenv("MIGRATION_LOCK_ID", "38192217"))
lock_timeout = int(os.getenv("MIGRATION_LOCK_TIMEOUT", "300"))
start = time.time()

conn = connect_db()
conn.autocommit = True
cur = conn.cursor()
locked = False

try:
    while True:
        cur.execute("SELECT pg_try_advisory_lock(%s)", (lock_id,))
        locked = bool(cur.fetchone()[0])
        if locked:
            print(f"Acquired migration lock {lock_id}.")
            break

        elapsed = time.time() - start
        if elapsed >= lock_timeout:
            print(f"Timed out waiting for migration lock {lock_id}.", file=sys.stderr)
            sys.exit(1)

        print(f"Another instance is running migrations; waiting... ({int(elapsed)}s)")
        time.sleep(2)

    subprocess.run(["python", "manage.py", "migrate", "--noinput"], check=True)
finally:
    if locked:
        cur.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
        print(f"Released migration lock {lock_id}.")
    cur.close()
    conn.close()
PY
fi

if [ "${BOOTSTRAP_ROOT:-1}" = "1" ]; then
    python manage.py bootstrap_root
fi

run_auto_seed() {
python - <<'PY'
import os
import subprocess
import sys
import time

import psycopg2


def env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        print(f"Invalid integer for {name}: {raw!r}", file=sys.stderr)
        sys.exit(1)


def connect_db():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return psycopg2.connect(database_url)
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "postgres"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        dbname=os.getenv("DB_NAME", "postgres"),
    )


lock_id = env_int("SEED_LOCK_ID", 38192218)
lock_timeout = env_int("SEED_LOCK_TIMEOUT", 600)
start = time.time()
seed_only_if_empty = env_bool("AUTO_SEED_ONLY_IF_EMPTY", True)
seed_only_on_empty_data = env_bool("AUTO_SEED_ONLY_ON_EMPTY_DATA", True)

conn = connect_db()
conn.autocommit = True
cur = conn.cursor()
locked = False

try:
    while True:
        cur.execute("SELECT pg_try_advisory_lock(%s)", (lock_id,))
        locked = bool(cur.fetchone()[0])
        if locked:
            print(f"Acquired seed lock {lock_id}.")
            break

        elapsed = time.time() - start
        if elapsed >= lock_timeout:
            print(f"Timed out waiting for seed lock {lock_id}.", file=sys.stderr)
            sys.exit(1)

        print(f"Another instance is seeding; waiting... ({int(elapsed)}s)")
        time.sleep(2)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    import django
    django.setup()
    from django.contrib.auth import get_user_model
    from content.models import Book, Chapter, Poem, Story

    User = get_user_model()
    has_seed_users = (
        User.objects.filter(username__startswith="seed_reader_").exists()
        or User.objects.filter(username__startswith="seed_writer_").exists()
    )
    root_username = os.getenv("ROOT_USERNAME", "root").strip()
    non_seed_users_qs = User.objects.exclude(username__startswith="seed_reader_").exclude(
        username__startswith="seed_writer_"
    )
    if root_username:
        non_seed_users_qs = non_seed_users_qs.exclude(username=root_username)
    has_non_seed_users = non_seed_users_qs.exists()
    has_any_content = Book.objects.exists() or Story.objects.exists() or Poem.objects.exists() or Chapter.objects.exists()

    if seed_only_on_empty_data and (has_non_seed_users or has_any_content):
        print("Skipping auto-seed: existing non-seed users/content found.")
    elif seed_only_if_empty and has_seed_users:
        print("Skipping auto-seed: existing seed users found.")
    else:
        command = [
            "python",
            "manage.py",
            "seed_mass_network",
            "--readers",
            str(env_int("SEED_READERS", 200)),
            "--writers",
            str(env_int("SEED_WRITERS", 30)),
            "--reader-start-index",
            str(env_int("SEED_READER_START_INDEX", 50001)),
            "--writer-start-index",
            str(env_int("SEED_WRITER_START_INDEX", 70001)),
            "--reader-password",
            os.getenv("SEED_READER_PASSWORD", "Reader@123"),
            "--writer-password",
            os.getenv("SEED_WRITER_PASSWORD", "Writer@123"),
            "--stories-per-writer",
            str(env_int("SEED_STORIES_PER_WRITER", 2)),
            "--poems-per-writer",
            str(env_int("SEED_POEMS_PER_WRITER", 1)),
            "--books-per-writer",
            str(env_int("SEED_BOOKS_PER_WRITER", 1)),
            "--chapters-per-book",
            str(env_int("SEED_CHAPTERS_PER_BOOK", 2)),
            "--follows-per-reader",
            str(env_int("SEED_FOLLOWS_PER_READER", 2)),
            "--likes-per-reader",
            str(env_int("SEED_LIKES_PER_READER", 3)),
            "--comments-per-reader",
            str(env_int("SEED_COMMENTS_PER_READER", 1)),
            "--progress-per-reader",
            str(env_int("SEED_PROGRESS_PER_READER", 2)),
            "--avatar-pool-size",
            str(env_int("SEED_AVATAR_POOL_SIZE", 24)),
            "--cover-pool-size",
            str(env_int("SEED_COVER_POOL_SIZE", 36)),
            "--min-body-paragraphs",
            str(env_int("SEED_MIN_BODY_PARAGRAPHS", 4)),
            "--max-body-paragraphs",
            str(env_int("SEED_MAX_BODY_PARAGRAPHS", 7)),
            "--min-body-words",
            str(env_int("SEED_MIN_BODY_WORDS", 22)),
            "--max-body-words",
            str(env_int("SEED_MAX_BODY_WORDS", 40)),
        ]

        if env_bool("SEED_SKIP_BODY_REFRESH", True):
            command.append("--skip-body-refresh")
        if env_bool("SEED_SKIP_SMOKE_CHECK", True):
            command.append("--skip-smoke-check")
        if env_bool("SEED_RESET_BEFORE_RUN", False):
            command.append("--reset-first")

        print("Running auto-seed command...")
        subprocess.run(command, check=True)
finally:
    if locked:
        cur.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
        print(f"Released seed lock {lock_id}.")
    cur.close()
    conn.close()
PY
}

if [ "${AUTO_SEED_ON_START:-1}" = "1" ]; then
    if [ "${AUTO_SEED_ASYNC:-1}" = "1" ]; then
        echo "Launching auto-seed in background..."
        run_auto_seed &
    else
        run_auto_seed
    fi
fi

if [ "${RUN_COLLECTSTATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

if [ "$#" -eq 0 ]; then
    set -- gunicorn --bind "0.0.0.0:${PORT:-8000}" --workers "${GUNICORN_WORKERS:-3}" core.wsgi:application
fi

exec "$@"
