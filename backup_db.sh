#!/bin/bash

# Configuration
BACKUP_DIR="/home/pims/praana_scanner/backups"
DB_CONTAINER="opus-postgres"
DB_NAME="fest"
DB_USER="postgres"
MAX_BACKUPS=3
# Root password for sudo if needed, though it's better to have sudoers configured
# For this specific task, we'll use the provided password via sudo -S
SUDO_PASS="Root@123"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Generate timestamped filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "[$TIMESTAMP] Starting backup..."

# Run the backup using docker exec via sudo
echo "$SUDO_PASS" | sudo -S docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$TIMESTAMP] Backup successful: $BACKUP_FILE"
    
    # List all backups sorted by time (newest first), skip the first 3, and delete the rest
    # We use sudo for rm just in case, though might not be needed for the backup dir
    ls -t "$BACKUP_DIR"/backup_*.sql | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --
    echo "[$TIMESTAMP] Cleaned up old backups."
else
    echo "[$TIMESTAMP] Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi
