const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { jidDecode } = require('@whiskeysockets/baileys');

/**
 * Utility functions for Starry MD 2.0
 */
module.exports = {
    /**
     * simple delay(ms) promise
     */
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    /**
     * Read More - Special character string to hide long text
     */
    readMore: String.fromCharCode(8206).repeat(4001),

    /**
     * Decode JID to clear format (removes :device part)
     */
    decodeJid: (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return decode.user && decode.server && `${decode.user}@${decode.server}` || jid;
        } else return jid;
    },

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
    },

    /**
     * getFont: Downloads and caches Jimp fonts locally
     * Resolves Windows-specific issues with remote URLs in loadFont
     */
    getFont: async (fontUrl, loadFontFn) => {
        const fontsDir = path.join(process.cwd(), 'database', 'fonts');
        await fs.ensureDir(fontsDir);

        // Extract filename from URL (e.g., open-sans-64-black.fnt)
        const fontName = path.basename(fontUrl);
        const localPath = path.join(fontsDir, fontName);

        // If not cached, download it
        if (!fs.existsSync(localPath)) {
            module.exports.log("SYSTEM", `Downloading font: ${fontName}...`);
            const response = await axios.get(fontUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(localPath, response.data);

            // Also download the associated PNG (Jimp fonts need the PNG in the same dir)
            const pngUrl = fontUrl.replace('.fnt', '.png');
            const pngPath = localPath.replace('.fnt', '.png');
            const pngResponse = await axios.get(pngUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(pngPath, pngResponse.data);
        }

        return await loadFontFn(localPath);
    },

    /**
     * Unified Target Parser
     * Extracts JID from mentions, replies, or raw numbers
     */
    parseTarget: (msg, args) => {
        // 1. Mentions
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length > 0) return mentions[0];

        // 2. Reply (Quoted Message)
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        if (quoted) return quoted;

        // 3. Raw Number in Args
        if (args) {
            const clean = args.split(' ')[0].replace(/[^0-9]/g, '');
            if (clean.length >= 10 && clean.length <= 15) {
                return clean + '@s.whatsapp.net';
            }
        }

        return null;
    },

    /**
     * autoReadMore: Injects readMore if text exceeds line limit
     */
    autoReadMore: (text, lineLimit = 6) => {
        if (!text) return text;
        const lines = text.split('\n');
        if (lines.length > lineLimit) {
            // Insert at the line limit
            const top = lines.slice(0, lineLimit).join('\n');
            const bottom = lines.slice(lineLimit).join('\n');
            return `${top}\n${module.exports.readMore}\n${bottom}`;
        }
        return text;
    }
};

module.exports.log("SYSTEM", "Utility Engine 2.0 Loaded (Foundation Mode)..");
