import config from "../../config.js";
import utils from "./utils.js";
import fs from 'fs-extra';
import path from 'path';

/*
 * 🛡️ ADVANCED GUARDIAN PROTOCOL
 * Protects groups from spam, malicious links, and unauthorized bots.
 */

// --- CONFIGURATION ---
const SPAM_THRESHOLD = 5; // Messages allowed 
const SPAM_INTERVAL = 3000; // Interval in ms (3 seconds)
const LINK_WHITELIST = [
    'youtube.com', 'youtu.be',
    'instagram.com',
    'spotify.com',
    'tiktok.com',
    'twitter.com', 'x.com',
    'facebook.com',
    'google.com',
    'pinterest.com',
    'reddit.com'
];

// --- STATE MEMORY ---
// Map<GroupId, Map<UserId, { count, lastMsgTime }>>
const spamMap = new Map();

// Map<GroupId, boolean>
const antiLinkConfig = new Map(); // In memory for now, ideally DB backed
// Map<GroupId, boolean>
const spamConfig = new Map(); // Strict Spam Mode (Detects normal chat too)

async function checkLink(sock, msg, from, sender, body, isBotAdmin, settings) {
    if (!settings || !settings.antilink) return false;

    const type = settings.antilinkType || 'whatsapp';
    const mode = settings.antilinkMode || 'kick';

    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const links = body.match(linkRegex);

    if (links && links.length > 0) {
        let trigger = false;

        for (const link of links) {
            if (type === 'whatsapp') {
                if (link.includes('chat.whatsapp.com')) trigger = true;
            } else if (type === 'social') {
                const socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'linkedin.com', 'pinterest.com'];
                if (socialDomains.some(domain => link.includes(domain))) trigger = true;
            } else if (type === 'all') {
                // Trigger for any link NOT in whitelist
                const isWhitelisted = LINK_WHITELIST.some(domain => link.includes(domain));
                if (!isWhitelisted) trigger = true;
            }
            if (trigger) break;
        }

        if (trigger) {
            utils.log("GUARDIAN", `Anti-Link Triggered: Type=${type}, Mode=${mode}, Sender=${sender}`);

            // 1. DELETE
            if (isBotAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
            }

            // 2. ENFORCE
            if (mode === 'kick') {
                if (isBotAdmin) {
                    await sock.sendMessage(from, { text: `🛡️ *ANTI-LINK SYSTEM*\n\nUser @${sender.split('@')[0]} has been removed for violating link policies.`, mentions: [sender] });
                    await sock.groupParticipantsUpdate(from, [sender], 'remove');
                } else {
                    await sock.sendMessage(from, { text: `🛡️ *ANTI-LINK WARNING*\n\n@${sender.split('@')[0]}, links are not allowed. (Bot needs Admin to kick)`, mentions: [sender] });
                }
            } else if (mode === 'warn') {
                // Dynamic import to avoid circular dependency issues, though ES modules handle them better
                const adminCommands = await import('./admin-commands.js');
                // Use the shared warning system
                try {
                    // adminCommands.default.handleGroupCommand... depending on how it's exported
                    // But wait, handleGroupCommand expects msg, sock, botState...
                    // We might need to construct a minimal botState or refactor warn logic to be shared better.
                    // For now, let's just use the direct warn logic if possible or just send a text warning if too complex
                    await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, links are not allowed!`, mentions: [sender] });
                    // Ideally we call the warning system, but we need botState which we might not have here fully populated?
                    // actually check() receives settings... maybe we can't fully use adminCommands here easily without state.
                    // Let's stick to a simple warning message for now unless we pass botState to check()
                } catch (e) {
                    utils.log("ERROR", `Anti-Link Warning Failed: ${e.message}`);
                    await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, links are not allowed!`, mentions: [sender] });
                }
            } else if (mode === 'delete') {
                if (!isBotAdmin) {
                    await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, links are not allowed! (Bot needs Admin to delete)`, mentions: [sender] });
                }
            }
            return true;
        }
    }
    return false;
}

async function checkSpam(sock, msg, from, sender, isBotAdmin, isCmd) {
    // RULE: Only warn for COMMANDS unless (BotAdmin AND StrictMode)
    const strictMode = spamConfig.get(from);

    // If it's NOT a command, we skip UNLESS we are in strict mode and bot is admin
    if (!isCmd) {
        if (!strictMode || !isBotAdmin) return false;
    }

    const now = Date.now();

    if (!spamMap.has(from)) spamMap.set(from, new Map());
    const groupSpam = spamMap.get(from);

    if (!groupSpam.has(sender)) groupSpam.set(sender, { count: 0, lastMsgTime: now });
    const userStats = groupSpam.get(sender);

    // Reset if interval passed
    if (now - userStats.lastMsgTime > SPAM_INTERVAL) {
        userStats.count = 0;
        userStats.lastMsgTime = now;
    }

    userStats.count++;
    userStats.lastMsgTime = now;

    if (userStats.count > SPAM_THRESHOLD) {
        // Trigger Spam Protection
        if (userStats.count === SPAM_THRESHOLD + 1) { // Trigger once per burst
            utils.log("GUARDIAN", `Spam detected from ${sender} in ${from}`);
            await sock.sendMessage(from, { text: `🛡️ *Spam Detected!* \n@${sender.split('@')[0]}, please slow down.`, mentions: [sender] }, { quoted: msg });
        }
        return true; // Stop processing further commands for this spam message
    }

    return false;
}

export default {
    /**
     * Initialize or load Guardian settings
     */
    init: async () => {
        // Placeholder for DB loading
    },

    /**
     * Check message for threats
     * @param {object} msg - The message object
     * @param {object} sock - Socket connection
     * @param {boolean} isGroup - Is it a group?
     * @param {boolean} isAdmin - Is sender admin?
     * @param {boolean} isBotAdmin - Is bot admin?
     * @param {boolean} isCmd - Is this a command?
     * @returns {Promise<boolean>} - True if threat detected & handled (stop processing), False if safe
     */
    check: async (msg, sock, isGroup, isAdmin, isBotAdmin, settings, isCmd = false) => {
        if (!isGroup) return false; // Guardian only protects groups
        if (isAdmin) return false; // Admins are immune
        if (msg.key.fromMe) return false; // Bot is immune

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        // 1. Anti-Link 2.0 (Passed via settings from botState)
        if (settings && settings.antilink) {
            if (await checkLink(sock, msg, from, sender, body, isBotAdmin, settings)) return true;
        }

        // 2. Spam Detection
        if (await checkSpam(sock, msg, from, sender, isBotAdmin, isCmd)) return true;

        return false;
    },

    /**
     * Toggle Anti-Link for a group
     */
    toggleAntiLink: (groupId, status) => {
        antiLinkConfig.set(groupId, status);
        return status;
    },

    /**
     * Toggle Spam Detector for a group
     */
    toggleSpam: (groupId, status) => {
        spamConfig.set(groupId, status);
        return status;
    }
};
