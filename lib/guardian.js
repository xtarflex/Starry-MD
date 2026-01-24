const config = require("../config");
const utils = require("./utils");
const fs = require('fs-extra');
const path = require('path');

/*
 * 🛡️ ADVANCED GUARDIAN PROTOCOL
 * Protects groups from spam, malicious links, and unauthorized bots.
 */

// --- CONFIGURATION ---
const SPAM_THRESHOLD = 5; // Messages allowed per interval
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

module.exports = {
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
    check: async (msg, sock, isGroup, isAdmin, isBotAdmin, isCmd = false) => {
        if (!isGroup) return false; // Guardian only protects groups
        if (isAdmin) return false; // Adimns are immune
        if (msg.key.fromMe) return false; // Bot is immune

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        // 1. Anti-Link 2.0
        if (antiLinkConfig.get(from)) {
            if (await checkLink(sock, msg, from, sender, body, isBotAdmin)) return true;
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

// --- INTERNAL CHECKS ---

async function checkLink(sock, msg, from, sender, body, isBotAdmin) {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const links = body.match(linkRegex);

    if (links && links.length > 0) {
        const isSafe = links.every(link => {
            return LINK_WHITELIST.some(domain => link.includes(domain));
        });

        if (!isSafe) {
            utils.log("GUARDIAN", `Detected blocked link from ${sender} in ${from}`);

            if (isBotAdmin) {
                // Delete message
                await sock.sendMessage(from, { delete: msg.key });
                // Warn user
                await sock.sendMessage(from, { text: `🛡️ *Link Detected!* \n@${sender.split('@')[0]}, links are not allowed here.`, mentions: [sender] });
                return true;
            }
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
