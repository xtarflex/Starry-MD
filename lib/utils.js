const fs = require('fs-extra');
const path = require('path');

/**
 * Utility functions for Starry MD 2.0
 */
module.exports = {
    /**
     * simple delay(ms) promise
     */
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * Log actions to both console and bot.log
     */
    log: (tag, message) => {
        const time = new Date().toLocaleTimeString();
        const logEntry = `[${tag}] ${time}: ${message}`;
        console.log(logEntry);
        try {
            const logPath = path.join(process.cwd(), 'database', 'bot.log');
            fs.appendFileSync(logPath, logEntry + '\n');
        } catch (e) {
            // Silently fail if log file is locked
        }
    },

    /**
     * canProcess (Rate Limit Stub)
     * For Phase 1, we just return true for everything
     */
    /**
     * canProcess (Tiered Rate Limit)
     * Tracks cooldowns per sender AND per chat
     */
    canProcess: (id, cooldownMap, limitMs = 3000) => {
        const now = Date.now();
        const lastTime = cooldownMap.get(id) || 0;

        if (now - lastTime < limitMs) return false;

        cooldownMap.set(id, now);
        return true;
    }
};

module.exports.log("SYSTEM", "Utility Engine 2.0 Loaded (Foundation Mode).");
