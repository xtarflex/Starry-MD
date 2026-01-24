const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { jidDecode } = require('@whiskeysockets/baileys');

/* 
 * Utility functions for Starry MD 2.0
 */
module.exports = {
    /* 
     * simple delay(ms) promise
     */
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    /* 
     * Read More - Special character string to hide long text
     */
    readMore: String.fromCharCode(8206).repeat(4001),

    /* 
     * Decode JID to clear format (removes :device part)
     */
    decodeJid: (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return decode.user && decode.server && `${decode.user}@${decode.server}` || jid;
        } else return jid;
    },

    /* 
     * Session Name for Logging
     */
    sessionName: "bot",

    setSessionName: (name) => {
        module.exports.sessionName = name ? `bot_${name}` : "bot";
    },

    /* 
     * Log actions to both console and bot.log
     * Includes Auto-Rotation if > 5MB
     */
    log: (tag, message) => {
        const time = new Date().toLocaleTimeString();
        const logEntry = `[${tag}] ${time}: ${message}`;
        console.log(logEntry);
        try {
            const logName = `${module.exports.sessionName}.log`;
            const logPath = path.join(process.cwd(), 'database', logName);

            // Log Rotation Check (5MB)
            if (fs.existsSync(logPath)) {
                const stats = fs.statSync(logPath);
                if (stats.size > 5 * 1024 * 1024) { // 5MB
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const backupPath = path.join(process.cwd(), 'database', `${module.exports.sessionName}_${timestamp}.log`);
                    fs.renameSync(logPath, backupPath);
                    console.log(`[SYSTEM] Log rotated: ${backupPath}`);
                }
            }

            fs.appendFileSync(logPath, logEntry + '\n');
        } catch (e) {
            // Silently fail if log file is locked or other error
        }
    },

    /* 
     * canProcess (Tiered Rate Limit)
     * Tracks cooldowns per sender AND per chat
     */
    canProcess: (id, cooldownMap, limitMs = 3000) => {
        const now = Date.now();
        const lastTime = cooldownMap.get(id) || 0;

        cooldownMap.set(id, now);
        return true;
    },

    /* 
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

    /* 
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

    /* 
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

    /* 
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

    /* 
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

    /* 
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
        if (args && args.length > 0) {
            // Args is already an array of strings
            const clean = args[0].replace(/[^0-9]/g, '');
            if (clean.length >= 10 && clean.length <= 15) {
                return clean + '@s.whatsapp.net';
            }
        }

        return null;
    },

    /* 
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
    },

    /*
     * Parse Number with Suffixes (1k, 1m, 1b)
     * Returns Integer or NaN
     */
    parseNumber: (input) => {
        if (input === 0 || input === '0') return 0;
        if (!input) return NaN;
        const str = String(input).replace(/,/g, '').toLowerCase().trim();

        let multiplier = 1;
        if (str.endsWith('k')) multiplier = 1000;
        else if (str.endsWith('m')) multiplier = 1000000;
        else if (str.endsWith('b')) multiplier = 1000000000;
        else if (str.endsWith('t')) multiplier = 1000000000000;

        const numStr = str.replace(/[kmbt]/g, '');
        const num = parseFloat(numStr);

        if (isNaN(num)) return NaN;
        return Math.floor(num * multiplier);
    },

    /*
     * Generate Random String
     */
    generateRandomString: (length) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /* 
     * Format Time Duration 
     */
    formatTime: (ms) => {
        let seconds = Math.floor((ms / 1000) % 60);
        let minutes = Math.floor((ms / (1000 * 60)) % 60);
        let hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        let days = Math.floor(ms / (1000 * 60 * 60 * 24));
        return (days ? `${days}d ` : '') + (hours ? `${hours}h ` : '') + (minutes ? `${minutes}m ` : '') + (seconds ? `${seconds}s` : '');
    },

    /*
     * Progressive Status Update
     * Sends a new message or edits an existing one
     * @returns {Object} The message key (for future edits)
     */
    updateStatus: async (sock, jid, text, key = null) => {
        if (key) {
            await sock.sendMessage(jid, { text: text, edit: key });
            return key;
        } else {
            const sent = await sock.sendMessage(jid, { text: text });
            return sent.key;
        }
    },

    /*
     * Send Album (Multi-Image)
     * Sends images rapidly to create a collage effect
     * @param {object} sock - Baileys socket
     * @param {string} jid - Chat JID
     * @param {Array} medias - Array of { url } or { buffer } or { image: ... }
     * @param {object} options - Optional { caption, quoted }
     */
    sendAlbum: async (sock, jid, medias, options = {}) => {
        if (!medias || !Array.isArray(medias) || medias.length === 0) return;

        const { caption, quoted, delay = 500 } = options;

        for (let i = 0; i < medias.length; i++) {
            const media = medias[i];
            const msgOptions = {
                image: media.buffer || { url: media.url },
                caption: (i === 0 && caption) ? caption : "" // Caption only on first image
            };

            await sock.sendMessage(jid, msgOptions, { quoted: quoted });
            await module.exports.delay(delay); // Short delay for ordering
        }
    },
    /*
     * Network Timeout Wrapper
     * Wraps a promise with a timeout
     */
    withNetworkTimeout: (promise, ms = 60000, errorMsg = 'Network Request Timed Out') => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
        ]);
    },

    /*
     * Get Network Stats (Smart Diagnostics)
     * Performs a REAL ping to Google to estimate latency
     * Returns: { latency, rating, emoji, text }
     */
    getNetworkStats: async () => {
        const start = Date.now();
        try {
            await axios.head('https://www.google.com', { timeout: 5000 });
            const latency = Date.now() - start;

            let speedRating, speedEmoji;
            if (latency < 100) {
                speedRating = "Excellent"; speedEmoji = "🟢";
            } else if (latency < 300) {
                speedRating = "Good"; speedEmoji = "🟡";
            } else if (latency < 1000) {
                speedRating = "Fair"; speedEmoji = "🟠";
            } else {
                speedRating = "Poor"; speedEmoji = "🔴";
            }

            return {
                latency,
                rating: speedRating,
                emoji: speedEmoji,
                text: `${speedEmoji} Status: ${speedRating} (${latency}ms)`
            };
        } catch (err) {
            return {
                latency: -1,
                rating: "Offline",
                emoji: "❌",
                text: "❌ Status: Offline"
            };
        }
    },

    /*
     * Get Network Alert String
     * Returns formatted string if network is poor/offline, else empty
     */
    getNetworkAlert: async () => {
        const stats = await module.exports.getNetworkStats();
        if (stats.latency > 500 || stats.latency === -1) {
            const speed = stats.latency === -1 ? 'OFFLINE' : `${stats.latency}ms`;
            return `\n\n⚠️ *Low Network:* [${speed}]`;
        }
        return '';
    }
};

module.exports.log("SYSTEM", "Utility Engine 2.0 Loaded (Foundation Mode)..");
