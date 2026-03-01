#!/bin/sh
set -e

echo "Waiting for PostgreSQL at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."
python - <<'PY'
import os
import sys
import time

import psycopg2

host = os.getenv("DB_HOST", "postgres")
port = int(os.getenv("DB_PORT", "5432"))
user = os.getenv("DB_USER", "postgres")
password = os.getenv("DB_PASSWORD", "postgres")
dbname = os.getenv("DB_NAME", "postgres")
max_attempts = 60

for attempt in range(1, max_attempts + 1):
    try:
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

python manage.py migrate --noinput

if [ "${BOOTSTRAP_ROOT:-1}" = "1" ]; then
    python manage.py bootstrap_root
fi

if [ "${RUN_COLLECTSTATIC:-0}" = "1" ]; then
    python manage.py collectstatic --noinput
fi

exec "$@"
