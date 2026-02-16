import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const utils = {
    // --- Logging ---
    sessionName: 'default',
    setSessionName: (name) => {
        utils.sessionName = name || 'default';
    },

    log: (tag, message) => {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = utils.sessionName !== 'default' ? `[${utils.sessionName}] ` : '';
        console.log(`${prefix}[${tag}] ${timestamp}: ${message}`);
    },

    // --- Delays ---
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

    // --- Typing Simulation ---
    simulateTyping: async (sock, jid, duration = 1000) => {
        await sock.sendPresenceUpdate('composing', jid);
        await utils.delay(duration);
        await sock.sendPresenceUpdate('available', jid);
    },

    smartTyping: async (sock, jid, text) => {
        const duration = Math.min(Math.max(text.length * 30, 500), 5000); // 30ms per char, min 500ms, max 5s
        await utils.simulateTyping(sock, jid, duration);
    },

    // --- Status Updates ---
    updateStatus: async (sock, jid, text, key = null) => {
        if (key) {
            await sock.sendMessage(jid, { text: text, edit: key });
            return key;
        } else {
            const sent = await sock.sendMessage(jid, { text: text });
            return sent.key;
        }
    },

    // --- Audio Recording Simulation ---
    simulateAudio: async (sock, jid, duration = 1500) => {
        await sock.sendPresenceUpdate('recording', jid);
        await utils.delay(duration);
        await sock.sendPresenceUpdate('available', jid);
    },

    // --- JID Handling ---
    decodeJid: (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            // Internal Baileys helper usually used here
            return jid;
        }
        return jid;
    },

    // --- Read More ---
    autoReadMore: (text) => {
        if (!text) return text;
        if (text.length > 200) {
            return text + '\n\u200B'.repeat(4000);
        }
        return text;
    },

    // --- Cooldowns ---
    canProcess: (key, cooldownMap, duration = 3000) => {
        const now = Date.now();
        if (cooldownMap.has(key)) {
            const expirationTime = cooldownMap.get(key) + duration;
            if (now < expirationTime) return false;
        }
        cooldownMap.set(key, now);
        return true;
    },

    // --- Name Resolution (LID Aware) ---
    resolvePhoneNumber: async (jid, botState, sock) => {
        if (!jid) return null;
        if (jid.endsWith('@s.whatsapp.net')) return jid; // Already PN
        if (jid === '0@s.whatsapp.net') return null;

        // Verify if it's me
        const myJid = utils.decodeJid(sock.user.id);
        if (jid === myJid) return myJid;

        // 1. Check Contacts
        if (botState.contacts[jid]) return jid;

        return jid;
    },

    // --- File Utils ---
    getBuffer: async (url, options) => {
        try {
            options ? options : {};
            const res = await axios({
                method: "get",
                url,
                headers: {
                    'DNT': 1,
                    'Upgrade-Insecure-Requests': 1
                },
                ...options,
                responseType: 'arraybuffer'
            });
            return res.data;
        } catch (e) {
            console.log(`Error fetch buffer: ${e}`);
            return null;
        }
    },

    getRandom: (ext) => {
        return `${Math.floor(Math.random() * 10000)}${ext}`;
    },

    // --- Parsing Utils ---
    parseNumber: (str) => {
        if (!str) return 0;
        str = str.toString().toLowerCase().replace(/,/g, '');
        if (str.endsWith('k')) return parseFloat(str) * 1000;
        if (str.endsWith('m')) return parseFloat(str) * 1000000;
        if (str.endsWith('b')) return parseFloat(str) * 1000000000;
        return parseFloat(str) || 0;
    },

    parseTarget: (msg, args) => {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (quoted) return quoted;
        if (mentioned) return mentioned;
        if (args[0] && args[0].includes('@')) {
            return args[0].replace('@', '') + '@s.whatsapp.net';
        }
        return null;
    },

    // --- Data Utils ---
    formatTime: (ms) => {
        let seconds = Math.floor((ms / 1000) % 60);
        let minutes = Math.floor((ms / (1000 * 60)) % 60);
        let hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        return `${hours}h ${minutes}m ${seconds}s`;
    }
};

export default utils;
