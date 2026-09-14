#!/usr/bin/env bash
# Nightly database backup to S3. Uploaded studies already live in the application S3 bucket.
#
# Protect uploaded objects with bucket versioning and an appropriate backup policy.
# This script backs up PostgreSQL separately; it no longer archives a local uploads folder.
#
#   sudo crontab -e
#   30 2 * * *  /opt/medai/backup.sh >> /var/log/medai-backup.log 2>&1
set -euo pipefail

BUCKET="${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
PROJECT="${COMPOSE_PROJECT:-medai-prod}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

DB_CONTAINER="$(docker compose -p "$PROJECT" ps -q postgres)"

if [ -z "$DB_CONTAINER" ]; then
  echo "[$STAMP] FAILED: stack is not running" >&2
  exit 1
fi

# --clean --if-exists so the dump restores onto a non-empty database without manual intervention;
# a backup you cannot restore under pressure is not a backup.
docker exec "$DB_CONTAINER" pg_dump \
  --username "${DB_USERNAME:-medai}" \
  --dbname "${DB_NAME:-medai}" \
  --format=custom --clean --if-exists \
  > "$WORK/db-$STAMP.dump"


# SSE-KMS, not plain SSE-S3: these are patient records, and a customer-managed key is what lets
# you revoke access to the backups independently of the bucket.
aws s3 cp "$WORK/db-$STAMP.dump"        "s3://$BUCKET/db/"      --sse aws:kms --storage-class STANDARD_IA

echo "[$STAMP] ok — db $(du -h "$WORK/db-$STAMP.dump" | cut -f1)"

# Retention is a bucket lifecycle rule, not a loop here — S3 expiring objects is more reliable
# than a shell script that only runs if the box is up.
