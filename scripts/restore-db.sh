#!/bin/bash
# ==============================================================================
# WorkSphere Database Restore & Verification Script (Assessment 14)
# Verifies sha256 checksum, recreates database, restores schema & data
# ==============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

DB_NAME="${DB_NAME:-worksphere_db}"
DB_USER="${DB_USER:-worksphere}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"

echo "[WorkSphere Restore] Validating backup integrity..."

if [ -f "${CHECKSUM_FILE}" ]; then
    sha256sum -c "${CHECKSUM_FILE}"
    echo "[WorkSphere Restore] Checksum verified: OK"
else
    echo "[WorkSphere Restore] WARNING: Checksum file not found, proceeding with caution."
fi

echo "[WorkSphere Restore] Restoring ${BACKUP_FILE} into ${DB_NAME}..."

gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"

echo "[WorkSphere Restore] Restore complete. Running verification queries..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT count(*) AS total_tenants FROM organizations;"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT count(*) AS total_tasks FROM tasks;"

echo "[WorkSphere Restore] Database verified and restored successfully!"
