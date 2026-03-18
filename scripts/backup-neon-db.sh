#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +"%Y%m%d-%H%M%S")"
OUT_FILE="${1:-backups/neon-backup-${STAMP}.dump}"
DB_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}}"

if [[ -z "${DB_URL}" ]]; then
  echo "Missing database URL. Set DIRECT_DATABASE_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL."
  exit 1
fi

if [[ "${DB_URL}" == *"-pooler."* ]]; then
  echo "Refusing to run pg_dump against a pooled Neon URL."
  echo "Use a direct connection string in DIRECT_DATABASE_URL or DATABASE_URL_UNPOOLED."
  exit 1
fi

mkdir -p "$(dirname "${OUT_FILE}")"

echo "Creating backup at ${OUT_FILE}"
pg_dump "${DB_URL}" --format=custom --file="${OUT_FILE}"
echo "Backup completed: ${OUT_FILE}"
