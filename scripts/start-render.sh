#!/bin/sh
set -eu

export APP_PORT="${PORT:-10000}"
export APP_ORIGIN="${APP_ORIGIN:-${RENDER_EXTERNAL_URL:-}}"
case "$APP_ORIGIN" in
  https://*) ;;
  *) echo 'Configure a origem HTTPS publica antes de iniciar.' >&2; exit 1 ;;
esac

exec java -jar /app/app.jar
