#!/bin/sh
set -e

# Some hosts (e.g. pasting a value copied from a .env file) store connection
# strings WITH surrounding quotes: DATABASE_URL="postgresql://...". A .env file
# strips those quotes on load, but a raw host env var keeps them, and the Prisma
# CLI then rejects the leading quote with `P1013: scheme is not recognized`.
# Normalize the DB URLs (strip one pair of surrounding single/double quotes)
# before running migrations or starting the server.
strip_quotes() {
  value="$1"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

if [ -n "$DATABASE_URL" ]; then DATABASE_URL="$(strip_quotes "$DATABASE_URL")"; export DATABASE_URL; fi
if [ -n "$DIRECT_URL" ]; then DIRECT_URL="$(strip_quotes "$DIRECT_URL")"; export DIRECT_URL; fi

npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
exec node apps/api/dist/index.js
