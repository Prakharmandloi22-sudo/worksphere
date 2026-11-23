#!/bin/bash
# ==============================================================================
# WorkSphere Database Backup Script (Assessment 14)
# Performs pg_dump, calculates sha256 checksum, applies 7-day retention
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${DB_NAME:-worksphere_db}"
DB_USER="${DB_USER:-worksphere}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

BACKUP_FILE="${BACKUP_DIR}/worksphere_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[WorkSphere Backup] Starting PostgreSQL backup for ${DB_NAME} at $(date)..."

# Execute pg_dump with gzip compression
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --format=plain --no-owner --no-acl | gzip -9 > "${BACKUP_FILE}"

# Generate checksum for verification
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

echo "[WorkSphere Backup] Backup completed successfully: ${BACKUP_FILE}"
echo "[WorkSphere Backup] Checksum: $(cat ${CHECKSUM_FILE})"

# Apply retention policy: remove backups older than 7 days
find "${BACKUP_DIR}" -name "worksphere_*.sql.gz*" -mtime +7 -exec rm -f {} +
echo "[WorkSphere Backup] Retention policy applied (purged >7 days old backups)."
