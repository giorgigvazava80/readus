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

if [ "${RUN_COLLECTSTATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

if [ "$#" -eq 0 ]; then
    set -- gunicorn \
        --bind "0.0.0.0:${PORT:-8000}" \
        --workers "${GUNICORN_WORKERS:-1}" \
        --timeout "${GUNICORN_TIMEOUT:-120}" \
        --graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-30}" \
        --max-requests "${GUNICORN_MAX_REQUESTS:-1000}" \
        --max-requests-jitter "${GUNICORN_MAX_REQUESTS_JITTER:-100}" \
        core.wsgi:application
fi

exec "$@"
