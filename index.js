require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs-extra");
const path = require("path");
const utils = require("./lib/utils");
const handler = require("./lib/handler");
const status = require("./lib/status");
const qrcode = require("qrcode-terminal");
const figlet = require("figlet");
const config = require("./config");


// --- 1. BOOTSTRAP BOT STATE ---
const botState = {
    mode: "$public",
    cooldowns: new Map(),
    processedMessages: new Set(),
    handshakeWaiting: new Set(),
    contacts: fs.readJsonSync("./database/contacts.json", { throws: false }) || {},
    ownerID: (config.OWNER_ID || process.env.OWNER_ID) + "@s.whatsapp.net",
    ghostBuffer: new Map(),
    sleepCooldowns: new Map(),
    antiLinkGroups: new Set(),
    groupCounts: new Map(), // Tracks bulk spam per group
    warns: new Map(), // Tracks user warnings per group
    reactions: fs.readJsonSync("./database/reactions.json", { throws: false }) || {},
    memory: {}, // AI Chat context memory
    settings: fs.readJsonSync("./database/bot_settings.json", { throws: false }) || { autoBio: true, customBio: null, viewOnceMode: "chat" }
};
botState.settings.viewOnceMode = botState.settings.viewOnceMode || "chat";

// --- 2. BOOT ART & UTILS ---
function printBootArt() {
    console.clear();
    console.log(figlet.textSync('Starry MD', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
        width: 80,
        whitespaceBreak: true
    }));
    utils.log("SYSTEM", "Starry MD v2.0 :: System Online");
    utils.log("SYSTEM", `[Mode] ${botState.mode.toUpperCase()} :: [Owner] ${config.OWNER_ID}`);
    console.log("----------------------------------------------------------------");
}

async function updateBio(sock) {
    if (!botState.settings.autoBio) return;

    try {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        let bio = botState.settings.customBio || `Starry MD | 🟢 Online | Mode: ${botState.mode.replace('$', '')} | Uptime: ${hours}h ${minutes}m`;
        await sock.updateProfileStatus(bio);
        utils.log("BIO", "WhatsApp 'About' updated successfully.");
    } catch (e) {
        utils.log("ERROR", `Failed to update bio: ${e.message}`);
    }
}

/**
 * Fireproof Contact Sync: Load contacts from stored database
 * Note: Baileys doesn't have fetchAllContacts - we rely on passive sync from events
 */
async function syncExistingContacts(sock) {
    try {
        utils.log("SYNC", "Loading contacts from database...");

        // Load existing contacts from database (already populated from contacts.upsert events)
        const contactFile = './database/contacts.json';
        if (fs.existsSync(contactFile)) {
            const savedContacts = fs.readJsonSync(contactFile, { throws: false }) || {};
            const contactCount = Object.keys(savedContacts).length;

            // Merge into botState if not already loaded
            for (const [id, data] of Object.entries(savedContacts)) {
                if (!botState.contacts[id]) {
                    botState.contacts[id] = data;
                }
            }

            if (contactCount > 0) {
                utils.log("SYNC", `Loaded ${contactCount} contacts from database.`);
            } else {
                utils.log("SYNC", "No saved contacts. Will learn passively from events.");
            }
        } else {
            utils.log("SYNC", "Contact database not found. Starting fresh.");
        }
    } catch (err) {
        utils.log("WARN", `Contact load failed: ${err.message}. Starting fresh.`);
    }
}

async function startStarry() {
    printBootArt();
    utils.log("SYSTEM", "Initializing Starry MD Core...");

    const { state, saveCreds } = await useMultiFileAuthState("database/session");
    const { version, isLatest } = await fetchLatestBaileysVersion();
    utils.log("CONN", `Using WA v${version.join(".")}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: state,
        browser: ["Starry MD 2.0", "Chrome", "1.0.0"],
        syncFullHistory: false
    });

    // --- 2. CONNECTION EVENTS ---
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            utils.log("CONN", "New QR Code received. Scanning window open:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            utils.log("CONN", `Connection closed. Reason: ${lastDisconnect.error}. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(() => startStarry(), 5000); // 5s backoff to prevent rapid loops
            }
        } else if (connection === "open") {
            utils.log("CONN", "✅ Starry MD 2.0 Connected Successfully!");

            // FIREPROOF CONTACT SYNC: Load all existing contacts first
            await syncExistingContacts(sock);

            // Start Bio Update Loop (Every hour)
            updateBio(sock);
            setInterval(() => updateBio(sock), 3600000);

            // Start Status Scheduler
            status.initScheduler(sock);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- 3. CORE MESSAGE HANDLER ---
    sock.ev.on("messages.upsert", async (m) => {
        if (m.type !== "notify") return;
        utils.log("RECV", `Processing ${m.messages.length} incoming packet(s)...`);

        for (const msg of m.messages) {
            if (!msg.message) continue;

            // --- GHOST BUFFERING (For Anti-Delete) ---
            const from = msg.key.remoteJid;
            if (!msg.key.fromMe && from !== 'status@broadcast') {
                const bufferKey = `${from}_${msg.key.id}`;
                botState.ghostBuffer.set(bufferKey, {
                    msg,
                    timestamp: Date.now()
                });

                // Periodic Cleanup of old buffer items (10 mins)
                setTimeout(() => {
                    botState.ghostBuffer.delete(bufferKey);
                }, config.GHOST_BUFFER_MS || 600000);
            }

            try {
                // Pass the individual message object instead of the whole upsert
                await handler(msg, sock, botState);
            } catch (e) {
                utils.log("ERROR", `Error in handler.js: ${e.message}`);
            }
        }
    });

    // --- GHOST ALERT (Anti-Delete Handler) ---
    sock.ev.on("messages.delete", async (item) => {
        utils.log("DEBUG", `Delete event received for ${item.keys?.length || 0} keys`);
        if (!item.keys || item.keys.length === 0) return;

        for (const key of item.keys) {
            const from = key.remoteJid;
            const bufferKey = `${from}_${key.id}`;
            const cached = botState.ghostBuffer.get(bufferKey);

            if (cached) {
                const isHunted = botState.settings.huntedChats?.includes(from);
                utils.log("DEBUG", `Found cached msg for ${key.id}. Hunted: ${isHunted}`);
                if (isHunted) {
                    utils.log("EVENT", `HUNT: Deleted message detected in ${from}`);
                    const pushName = cached.msg.pushName || "User";
                    const sender = cached.msg.key.participant || from;

                    const alertMsg = `🎯 *STARRY HUNT: DELETED MSG DETECTED*\n\n` +
                        `👤 *From:* ${pushName}\n` +
                        `📍 *Chat:* ${from}\n` +
                        `⏰ *Original Time:* ${new Date(cached.timestamp).toLocaleTimeString()}`;

                    await sock.sendMessage(botState.ownerID, { text: alertMsg });
                    // Use utils.copyNForward correctly
                    await utils.copyNForward(sock, botState.ownerID, cached.msg, false);
                }
                botState.ghostBuffer.delete(bufferKey);
            }
        }
    });

    // --- 4. CONTACT SYNC (PASSIVE) ---
    sock.ev.on("contacts.upsert", (newContacts) => {
        let updatedCount = 0;
        for (const contact of newContacts) {
            const id = contact.id;
            const newName = contact.pushName || contact.name;
            if (id && newName && (!botState.contacts[id] || botState.contacts[id].name === "Unknown")) {
                botState.contacts[id] = { name: newName, addedAt: Date.now(), sync: true };
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            fs.writeJsonSync("./database/contacts.json", botState.contacts);
            utils.log("SYNC", `Passively learned ${updatedCount} new contacts.`);
        }
    });
}

// Start the engine
startStarry().catch(err => {
    utils.log("CRITICAL", `Start Error: ${err.message}`);
    console.error(err);
});

// --- GLOBAL EXCEPTION HANDLING (The Safety Net) ---
process.on('uncaughtException', (err) => {
    utils.log("CRITICAL", `Uncaught Exception: ${err.message}`);
    console.error(err);
    // Give time for log to write
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    utils.log("CRITICAL", `Unhandled Rejection: ${reason}`);
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
