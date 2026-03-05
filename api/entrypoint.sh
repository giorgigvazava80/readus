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

if [ "${AUTO_SEED_ON_START:-1}" = "1" ]; then
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

    User = get_user_model()
    has_seed_users = (
        User.objects.filter(username__startswith="seed_reader_").exists()
        or User.objects.filter(username__startswith="seed_writer_").exists()
    )

    if seed_only_if_empty and has_seed_users:
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

        print("Running auto-seed command...")
        subprocess.run(command, check=True)
finally:
    if locked:
        cur.execute("SELECT pg_advisory_unlock(%s)", (lock_id,))
        print(f"Released seed lock {lock_id}.")
    cur.close()
    conn.close()
PY
fi

if [ "${RUN_COLLECTSTATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

exec "$@"
