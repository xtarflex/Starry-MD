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
const qrcode = require("qrcode-terminal");

// --- 1. BOOTSTRAP BOT STATE ---
const botState = {
    mode: "$public",
    cooldowns: new Map(),
    processedMessages: new Set(),
    handshakeWaiting: new Set(),
    contacts: fs.readJsonSync("./database/contacts.json", { throws: false }) || {},
    ownerID: process.env.OWNER_ID + "@s.whatsapp.net",
    ghostBuffer: new Map(),
    sleepCooldowns: new Map(),
    antiLinkGroups: new Set(),
    groupCounts: new Map() // Tracks bulk spam per group
};

async function startStarry() {
    utils.log("SYSTEM", "Starting Starry MD Core 2.0...");

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
    sock.ev.on("connection.update", (update) => {
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
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- 3. CORE MESSAGE HANDLER ---
    sock.ev.on("messages.upsert", async (m) => {
        if (m.type !== "notify") return;

        for (const msg of m.messages) {
            if (!msg.message) continue;
            try {
                await handler(m, sock, botState);
            } catch (e) {
                utils.log("ERROR", `Error in handler.js: ${e.message}`);
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
startStarry().catch(err => utils.log("CRITICAL", err.message));
