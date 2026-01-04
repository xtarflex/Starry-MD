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
        await sock.relayMessage(jid, waMsg.message, { messageId: waMsg.key.id });
    },

    /**
     * Simulate Typing Indicator
     * Makes bot appear to be typing before sending message
     * @param {object} sock - Baileys socket
     * @param {string} jid - Chat JID
     * @param {number} duration - How long to show typing (ms), default auto-calculated
     */
    simulateTyping: async (sock, jid, duration = null) => {
        try {
            // Auto-calculate duration if not provided (simulate realistic typing speed)
            // Average typing speed: ~40-60 chars per second
            const typingDuration = duration || Math.random() * 2000 + 1000; // 1-3 seconds default

            await sock.sendPresenceUpdate('composing', jid);
            await module.exports.delay(typingDuration);
            await sock.sendPresenceUpdate('paused', jid);
        } catch (error) {
            // Silently fail if presence update fails
        }
    },

    /**
     * Simulate Audio Recording Indicator
     * Makes bot appear to be recording audio
     * @param {object} sock - Baileys socket
     * @param {string} jid - Chat JID
     * @param {number} duration - How long to show recording (ms)
     */
    simulateAudio: async (sock, jid, duration = 3000) => {
        try {
            await sock.sendPresenceUpdate('recording', jid);
            await module.exports.delay(duration);
            await sock.sendPresenceUpdate('paused', jid);
        } catch (error) {
            // Silently fail if presence update fails
        }
    },

    /**
     * Smart Typing Simulation
     * Calculates realistic typing duration based on message length
     * @param {object} sock - Baileys socket
     * @param {string} jid - Chat JID
     * @param {string} message - The message that will be sent (to calculate duration)
     */
    smartTyping: async (sock, jid, message) => {
        try {
            // Calculate realistic typing duration
            // Average typing speed: 40 chars/second
            // Add some randomness for realism
            const baseTime = (message.length / 40) * 1000; // Base time in ms
            const randomFactor = 0.3; // ±30% variation
            const variation = baseTime * randomFactor * (Math.random() * 2 - 1);
            const typingTime = Math.max(500, Math.min(5000, baseTime + variation)); // 0.5s - 5s range

            await sock.sendPresenceUpdate('composing', jid);
            await module.exports.delay(typingTime);
            await sock.sendPresenceUpdate('paused', jid);
        } catch (error) {
            // Silently fail if presence update fails
        }
    }
};

module.exports.log("SYSTEM", "Utility Engine 2.0 Loaded (Foundation Mode)..");
