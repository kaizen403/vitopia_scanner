const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Configuration
const BACKUP_DIR = path.join(__dirname, 'backups');
const DB_CONTAINER = "opus-postgres";
const DB_NAME = "fest";
const DB_USER = "postgres";
const DB_PASSWORD = "postgres";
const MAX_BACKUPS = 3;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function performBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    console.log(`[${new Date().toLocaleString()}] Starting backup to ${filename}...`);

    // Command to run pg_dump inside docker via sudo
    const command = `echo "Root@123" | sudo -S docker exec -e PGPASSWORD=${DB_PASSWORD} ${DB_CONTAINER} pg_dump -U ${DB_USER} ${DB_NAME} > ${filepath}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${new Date().toLocaleString()}] Backup failed:`, error.message);
            if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
            return;
        }

        console.log(`[${new Date().toLocaleString()}] Backup successful.`);

        // Rotation: Keep only the latest MAX_BACKUPS
        fs.readdir(BACKUP_DIR, (err, files) => {
            if (err) {
                console.error("Could not list backup directory:", err);
                return;
            }

            const backups = files
                .filter(f => f.startsWith('backup_') && f.endsWith('.sql'))
                .map(f => ({
                    name: f,
                    time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            if (backups.length > MAX_BACKUPS) {
                const toDelete = backups.slice(MAX_BACKUPS);
                toDelete.forEach(file => {
                    fs.unlinkSync(path.join(BACKUP_DIR, file.name));
                    console.log(`[${new Date().toLocaleString()}] Deleted old backup: ${file.name}`);
                });
            }
        });
    });
}

// Run every 2 minutes
cron.schedule('*/2 * * * *', () => {
    performBackup();
});

// Run immediately on start
console.log("Backup scheduler started (Every 2 minutes)");
performBackup();
