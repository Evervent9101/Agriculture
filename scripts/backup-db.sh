#!/usr/bin/env bash
# Backs up the farm database to a compressed file and keeps the last 14 days.
# Run on the DEPLOYMENT server:  sudo bash scripts/backup-db.sh
# To run every night at 2am, add this line with: sudo crontab -e
#   0 2 * * * /bin/bash /opt/devops-app/backup-db.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/devops-app/backups}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/farmdb-$(date +%F-%H%M).sql.gz"

docker exec farm-postgres pg_dump -U farm farmdb | gzip > "$FILE"
find "$BACKUP_DIR" -name 'farmdb-*.sql.gz' -mtime +14 -delete

echo "Backup written to $FILE"
echo "To restore:  gunzip -c $FILE | sudo docker exec -i farm-postgres psql -U farm -d farmdb"
