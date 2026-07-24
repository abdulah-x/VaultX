#!/bin/sh
# Container entrypoint for the API.
#
# Two jobs: bring the schema up to date, then start the server. Previously the
# image ran uvicorn directly and migrations were a manual step, so a deploy onto
# a fresh volume came up with no tables at all -- and because /health only ran
# SELECT 1, the container still reported healthy while every query failed.
set -e

cd /app

# Alembic's env.py resolves the app package relative to this path, the same way
# the API process does.
export PYTHONPATH="/app/app:${PYTHONPATH}"

echo "→ Applying database migrations..."
# One retry loop rather than failing outright: compose already gates on
# postgres being healthy, but "accepting connections" and "ready for DDL" are
# not always the same instant, and a crash-looping container here is harder to
# diagnose than a few seconds of waiting.
attempts=0
until alembic upgrade head; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 10 ]; then
    echo "✗ Migrations failed after ${attempts} attempts. Refusing to start." >&2
    exit 1
  fi
  echo "  migration attempt ${attempts} failed, retrying in 3s..."
  sleep 3
done
echo "✓ Migrations applied."

# RELOAD is opt-in and for local development only. uvicorn's reloader spawns a
# file watcher and restarts on any write under the working directory -- and
# compose bind-mounts ./backend to /app, so in production that means an
# unrelated file write drops in-flight requests.
if [ "${RELOAD:-false}" = "true" ]; then
  echo "→ Starting uvicorn with autoreload (development)."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
fi

echo "→ Starting uvicorn with ${WEB_CONCURRENCY:-2} worker(s)."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${WEB_CONCURRENCY:-2}" \
  --proxy-headers \
  --forwarded-allow-ips '*'
