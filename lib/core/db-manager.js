import fs from 'fs-extra';
import path from 'path';
import utils from './utils.js';

class DatabaseManager {
    constructor() {
        this.writeQueues = new Map(); // path -> Promise chain
        this.backupDir = path.join(process.cwd(), 'database', 'backups');
        fs.ensureDirSync(this.backupDir);
    }

    /**
     * Load a JSON database safely
     * @param {string} filePath - Absolute or relative path to JSON file
     * @param {object} defaultData - Default data if file doesn't exist
     * @returns {Promise<object>} Parsed data
     */
    async load(filePath, defaultData = {}, options = {}) {
        const fullPath = path.resolve(filePath);

        try {
            if (await fs.pathExists(fullPath)) {
                try {
                    return await fs.readJSON(fullPath, options);
                } catch (parseError) {
                    utils.log("DB", `⚠️ CORRUPTION DETECTED in ${path.basename(filePath)}! Backing up and returning defaults.`);

                    // Backup the corrupted file
                    const corruptPath = `${fullPath}.corrupt.${Date.now()}`;
                    await fs.copy(fullPath, corruptPath);
                    utils.log("DB", `🔒 Corrupted file saved to: ${path.basename(corruptPath)}`);

                    return defaultData;
                }
            } else {
                // Initialize default
                await this.save(fullPath, defaultData);
                return defaultData;
            }
        } catch (err) {
            utils.log("DB", `❌ Fatal Load Error for ${path.basename(filePath)}: ${err.message}`);
            return defaultData; // Fail safe
        }
    }

    /**
     * Save data safely (Atomic + Queued)
     * @param {string} filePath - Path to save
     * @param {object} data - Data to save
     */
    async save(filePath, data, options = {}) {
        const fullPath = path.resolve(filePath);

        // Initialize queue for this file if not exists
        if (!this.writeQueues.has(fullPath)) {
            this.writeQueues.set(fullPath, Promise.resolve());
        }

        // Enqueue the write operation
        const writeOp = this.writeQueues.get(fullPath).then(async () => {
            try {
                // Atomic Write: Write to temp, then rename
                const tempPath = `${fullPath}.tmp`;
                await fs.writeJSON(tempPath, data, { spaces: 2, ...options });
                await fs.move(tempPath, fullPath, { overwrite: true });
            } catch (err) {
                utils.log("DB", `❌ Save Failed for ${path.basename(filePath)}: ${err.message}`);
            }
        });

        // Update the queue
        this.writeQueues.set(fullPath, writeOp);

        return writeOp;
    }

    /**
     * Create a backup of the file
     * @param {string} filePath 
     */
    async backup(filePath) {
        const fullPath = path.resolve(filePath);
        if (!await fs.pathExists(fullPath)) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.basename(filePath, '.json');
        const backupPath = path.join(this.backupDir, `${filename}_${timestamp}.json`);

        try {
            await fs.copy(fullPath, backupPath);

            // Clean up old backups (Keep last 5)
            await this.cleanupBackups(filename);

            return backupPath;
        } catch (err) {
            utils.log("DB", `⚠️ Backup Failed for ${path.basename(filePath)}: ${err.message}`);
        }
    }

    async cleanupBackups(baseFilename) {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = files.filter(f => f.startsWith(baseFilename) && f.endsWith('.json'));

            if (backups.length > 5) {
                // Sort by name (which includes timestamp)
                backups.sort();

                // Delete oldest
                const toDelete = backups.slice(0, backups.length - 5);
                for (const file of toDelete) {
                    await fs.remove(path.join(this.backupDir, file));
                }
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// Export Singleton
export default new DatabaseManager();
