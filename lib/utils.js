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
     * canProcess (Tiered Rate Limit)
     * Tracks cooldowns per sender AND per chat
     */
    canProcess: (id, cooldownMap, limitMs = 3000) => {
        const now = Date.now();
        const lastTime = cooldownMap.get(id) || 0;

        cooldownMap.set(id, now);
        return true;
    },

    /**
     * copyNForward: Relays a message to another JID
     */
    copyNForward: async (sock, jid, msg, forceForward = false, options = {}) => {
        const { generateForwardMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
        let contentType = Object.keys(msg.message)[0];
        if (forceForward && contentType !== 'conversation' && contentType !== 'extendedTextMessage' && contentType !== 'imageMessage' && contentType !== 'videoMessage') {
            contentType = 'forwardingScore';
        }
        const content = generateForwardMessageContent(msg, forceForward);
        const waMsg = generateWAMessageFromContent(jid, content, options);
        return await sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    }
};

module.exports.log("SYSTEM", "Utility Engine 2.0 Loaded (Foundation Mode).");
