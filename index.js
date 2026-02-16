import 'dotenv/config';
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    proto
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from 'url';
import utils from "./lib/core/utils.js";
import handler from "./lib/core/handler.js";
import status from "./lib/utils/status.js";
import qrcode from "qrcode-terminal";

import figlet from "figlet";
import config from "./config.js";
import economyGame from "./lib/systems/economy-game.js";
import sessionManager from "./lib/core/session-manager.js";
import dbManager from "./lib/core/db-manager.js";
import { useDatabaseAuth } from "./lib/core/auth-adapter.js";
import pino from "pino";
import NodeCache from "node-cache";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { spawn } from 'child_process';
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- WEB SERVER INIT ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// API Endpoints
app.get("/api/status", (req, res) => {
    res.json({
        status: "online", // Simple status for now
        mode: botState.mode,
        uptime: process.uptime(),
        owner: config.OWNER_ID
    });
});

// Socket.IO Connection
let globalSock; // Shared socket instance

io.on("connection", (socket) => {
    // Send initial handshake data
    socket.emit("init", {
        message: "Starry MD Terminal Connected",
        timestamp: Date.now()
    });

    socket.on("pairing-request", async (number) => {
        utils.log("WEB", `Pairing request received for: ${number}`);
        if (!globalSock) {
            return socket.emit('error', 'Bot not initialized yet');
        }

        try {
            // Remove non-numeric chars
            const cleanNumber = number.replace(/[^0-9]/g, '');
            const code = await globalSock.requestPairingCode(cleanNumber);
            socket.emit('pairing-code', code);
            utils.log("WEB", `Pairing Code Sent to Web: ${code}`);
        } catch (err) {
            utils.log("ERROR", `Web Pairing Failed: ${err.message}`);
            socket.emit('error', 'Pairing Failed: ' + err.message);
        }
    });

    socket.on("command-restart", () => {
        utils.log("WEB", "Restart command received from Dashboard.");
        socket.emit("log", { tag: "SYSTEM", message: "Restarting Bot Process...", timestamp: Date.now() });

        const restartBot = async () => {
            utils.log("SYSTEM", "Closing Server for Restart...");

            // 1. Close Socket.IO
            if (io) await new Promise(resolve => io.close(() => resolve()));

            // 2. Close HTTP Server
            if (server) await new Promise(resolve => server.close((err) => {
                if (err) utils.log("WARN", "Server close error: " + err.message);
                resolve();
            }));

            utils.log("SYSTEM", "Server Closed. Spawning new process...");

            // 3. Spawn
            const subprocess = spawn(process.argv[0], process.argv.slice(1), {
                detached: true,
                stdio: 'ignore',
                cwd: process.cwd(),
                env: { ...process.env, RESTART_DELAY: '2000' } // Increased delay to 2s
            });

            subprocess.unref();
            process.exit(0);
        };

        restartBot();
    });

    socket.on("command-test-audio", async () => {
        utils.log("WEB", "Audio Test command received.");
        if (globalSock) {
            // Send presence update to the owner (if known) or just log it
            // Since we don't have a specific JID to targeting for "test", we'll just log
            utils.log("AUDIO", "Simulating Audio Recording on dummy JID...");
        } else {
            socket.emit("log", { tag: "ERROR", message: "Bot not connected to WA", timestamp: Date.now() });
        }
    });

    socket.on("command-ping", () => {
        socket.emit("log", { tag: "INFO", message: `Pong! Server Uptime: ${process.uptime().toFixed(2)}s`, timestamp: Date.now() });
    });
});

// Start Server with optional delay
const startServer = () => {
    server.listen(PORT, () => {
        utils.log("SYSTEM", `Web Interface running on port ${PORT}`);
    }).on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            utils.log("WARN", `Port ${PORT} in use, retrying in 1s...`);
            setTimeout(() => {
                server.close();
                server.listen(PORT);
            }, 1000);
        } else {
            utils.log("ERROR", `Server Error: ${e.message}`);
        }
    });
};

if (process.env.RESTART_DELAY) {
    setTimeout(startServer, parseInt(process.env.RESTART_DELAY));
} else {
    startServer();
}

// --- LOG OVERRIDE FOR STREAMING ---
const originalLog = utils.log;
utils.log = (tag, message) => {
    // Call original log to keep console/file logging working
    originalLog(tag, message);

    // Stream to Web Interface
    io.emit("log", {
        tag,
        message,
        timestamp: Date.now()
    });
};

// --- 1. BOOTSTRAP BOT STATE ---
const botState = {
    mode: "$public",
    cooldowns: new Map(),
    processedMessages: new Set(),
    handshakeWaiting: new Set(),
    contacts: {},
    ownerID: (config.OWNER_ID || process.env.OWNER_ID) + "@s.whatsapp.net",
    ghostBuffer: new Map(),
    sleepCooldowns: new Map(),
    antiLinkGroups: new Set(),
    groupCounts: new Map(),
    warns: new Map(),
    reactions: {},
    memory: {},
    groupMetadata: {},
    settings: { autoBio: true, customBio: null, viewOnceMode: "chat" },
    groupSettings: {},
    bannedChats: []
};

// --- Hydrate State (Async) ---
async function hydrateBotState() {
    utils.log("DB", "Hydrating Bot State from Database...");

    botState.contacts = await dbManager.load("./database/contacts.json", {});
    botState.reactions = await dbManager.load("./database/reactions.json", {});
    botState.settings = await dbManager.load("./database/bot_settings.json", { autoBio: true, customBio: null, viewOnceMode: "chat" });
    botState.groupSettings = await dbManager.load("./database/group_settings.json", {});
    botState.bannedChats = await dbManager.load("./database/banned_chats.json", []);

    // Ensure defaults
    botState.settings.viewOnceMode = botState.settings.viewOnceMode || "chat";
    utils.log("DB", "State Hydration Complete.");
}

// --- 2. BOOT ART & UTILS ---
function printBootArt() {
    // console.clear(); // Removed to prevent flashing

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
        if (e.message.includes('Connection Closed') || e.message.includes('Connection Terminated')) {
            // Squelch network (will retry next hour)
        } else {
            utils.log("ERROR", `Failed to update bio: ${e.message}`);
        }
    }
}

/* 
 * Contact Sync: Load from database + rely on passive sync
 * Note: We'll also use pushName detection in handler for immediate recognition
 */
async function syncExistingContacts(sock) {
    try {
        utils.log("SYNC", "Loading contacts from database...");

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

// --- Global Interval Tracking ---
let bioInterval;
let gameInterval;
let hasCleanedSession = false; // Prevent infinite loop on restart

async function startStarry() {
    // Clear previous intervals to prevent memory leaks/zombie loops
    if (bioInterval) clearInterval(bioInterval);
    if (gameInterval) clearInterval(gameInterval);

    printBootArt();
    utils.log("SYSTEM", "Initializing Starry MD Core...");

    // Hydrate DB
    await hydrateBotState();

    // Restore Sub-Bots
    await sessionManager.restoreSessions();

    const args = process.argv.slice(2);

    // Improved Argument Parser
    let usePairingCode = true; // Default to Mobile Mode
    let selectedSession = null; // Default to null for standard auth_baileys
    let cleanSession = false; // Flag for cleaning session
    const knownFlags = ['--mobile', '-m', '--mn', '--session', '-s', '--qr', '--clean', '-c'];

    // Scan args
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--mn' || arg === '--mobile' || arg === '-m') {
            usePairingCode = true;
        } else if (arg === '--qr') {
            usePairingCode = false;
        } else if (arg === '--clean' || arg === '-c') {
            cleanSession = true;
        } else if (arg === '--session' || arg === '-s') {
            if (args[i + 1] && !args[i + 1].startsWith('-')) {
                selectedSession = args[i + 1];
                i++;
            }
        } else if (arg.startsWith('--session=')) {
            selectedSession = arg.split('=')[1];
        } else if (arg.startsWith('-s=')) {
            selectedSession = arg.split('=')[1];
        } else if (arg.startsWith('-')) {
            utils.log("WARN", `Unknown argument '${arg}' ignored.`);
        }
    }

    // Determine session from naked args if not set via flags
    if (!selectedSession) {
        const potentialSession = args.find(a => !a.startsWith('-') && !['--mobile', '-m', '--mn', '--qr', '--clean', '-c'].includes(a));
        if (potentialSession) selectedSession = potentialSession;
    }

    // --- RESTART/RESET HANDLING (File Flag) ---
    let fastStartNumber = null;


    // Set Log File Name based on Session
    // Determine session ID and paths
    const sessionId = selectedSession || "main";
    const authPath = selectedSession ? `auth_baileys_${selectedSession}` : "auth_baileys";
    const sessionFile = `database/session_${sessionId}.json`;

    // --- CLEAN SESSION LOGIC ---
    if (cleanSession) {
        if (!hasCleanedSession) {
            let deleted = false;

            // 1. Clean Folder (Legacy)
            const fullAuthPath = path.join(process.cwd(), authPath);
            if (fs.existsSync(fullAuthPath)) {
                utils.log("SYSTEM", `Argument --clean detected. Deleting session folder: ${authPath}`);
                try {
                    fs.removeSync(fullAuthPath);
                    deleted = true;
                } catch (err) {
                    utils.log("ERROR", `Failed to delete session folder: ${err.message}`);
                }
            }

            // 2. Clean Database Session File (New)
            const fullSessionFile = path.join(process.cwd(), sessionFile);
            if (fs.existsSync(fullSessionFile)) {
                utils.log("SYSTEM", `Argument --clean detected. Deleting session file: ${sessionFile}`);
                try {
                    fs.removeSync(fullSessionFile);
                    deleted = true;
                } catch (err) {
                    utils.log("ERROR", `Failed to delete session file: ${err.message}`);
                }
            }

            if (!deleted) {
                utils.log("SYSTEM", `Argument --clean detected, but no session found to delete.`);
            } else {
                utils.log("SYSTEM", `Session cleanup complete.`);
            }
            hasCleanedSession = true; // Mark as done
        }
    }

    // --- AUTHENTICATION ---
    const { state, saveCreds } = await useDatabaseAuth(sessionId);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    utils.log("CONN", `Using WA v${version.join(".")}, isLatest: ${isLatest}`);
    utils.log("CONN", `Session: Database (${sessionId})`);

    // Readline Question Helper
    const question = (text) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise((resolve) => {
            rl.question(text, (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    };

    // --- CACHE INIT ---
    const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

    let sock;
    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }), // Suppress noisy JSON logs
        browser: Browsers.ubuntu('Chrome'), // Use standard Baileys helper
        syncFullHistory: false,
        // Cached Group Metadata Helper to prevent 429 Bans
        cachedGroupMetadata: async (jid) => {
            const cached = groupCache.get(jid);
            if (cached) return cached;
            if (!sock) return undefined; // Safety check
            try {
                const metadata = await sock.groupMetadata(jid);
                groupCache.set(jid, metadata);
                return metadata;
            } catch (e) {
                return undefined;
            }
        },
        // Implement getMessage for Polls & Resends
        getMessage: async (key) => {
            const { remoteJid, id } = key;
            if (!remoteJid || !id) return undefined;

            const bufferKey = `${remoteJid}_${id}`;
            if (botState.ghostBuffer && botState.ghostBuffer.has(bufferKey)) {
                return botState.ghostBuffer.get(bufferKey).msg.message;
            }

            // Fallback: Return empty message to prevent crashes
            return undefined;
        }
    });

    globalSock = sock; // Expose to Web Interface

    // Pairing Code Logic
    if (usePairingCode && !sock.authState.creds.me) {
        // Wait a tick to ensure socket init
        setTimeout(async () => {
            let phoneNumber = fastStartNumber; // Use cached number if available

            if (!phoneNumber) {
                phoneNumber = await question('Please enter your phone number (International Format, e.g., 23480123...): ');
            }

            phoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Sanitize

            if (!phoneNumber) {
                utils.log("ERROR", "Invalid phone number entered. Exiting.");
                process.exit(1);
            }

            try {
                const code = await sock.requestPairingCode(phoneNumber);
                utils.log("PAIRING", `Your Pairing Code: ${code}`);
                io.emit("pairing-code", code); // Emit to frontend
            } catch (err) {
                utils.log("ERROR", `Failed to retrieve pairing code: ${err.message || err}`);
                if (String(err).includes('bad_param')) {
                    utils.log("ERROR", "The phone number format might be invalid or too short.");
                } else if (String(err).includes('rate-overlimit')) {
                    utils.log("ERROR", "You are trying too often. Please wait a while before retrying.");
                }
                process.exit(1);
            }
        }, 3000);
    }

    // Add decodeJid helper directly to sock for ease of use
    sock.decodeJid = (jid) => utils.decodeJid(jid);

    // --- 2. CONNECTION EVENTS ---
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !usePairingCode) {
            utils.log("CONN", "New QR Code received. Scanning window open:");
            qrcode.generate(qr, { small: true });
            io.emit("qr", qr); // Emit to frontend
        }

        if (connection === "close") {
            const reason = lastDisconnect.error?.output?.statusCode;
            const errorMsg = lastDisconnect.error?.message || String(lastDisconnect.error);

            utils.log("CONN", `Connection closed. Reason: ${reason || "Unknown"} | Error: ${errorMsg}`);

            // --- CONNECTION ERROR HANDLING STRATEGY ---
            switch (reason) {
                case DisconnectReason.loggedOut:
                    utils.log("CONN", "❌ Device Logged Out. Please delete session and scan again.");
                    process.exit(1); // Stop to prevent loop
                    break;

                case DisconnectReason.connectionReplaced:
                    utils.log("CONN", "⚠️ Connection Replaced. Another session was opened.");
                    utils.log("CONN", "🛑 Stopping bot to prevent conflict/ban.");
                    process.exit(0); // Stop to avoid fighting
                    break;

                case DisconnectReason.restartRequired:
                    utils.log("CONN", "🔄 Restart Required. Reconnecting immediately...");
                    startStarry(); // No delay needed
                    break;

                case DisconnectReason.timedOut:
                    utils.log("CONN", "⏳ Connection Timed Out. Reconnecting in 5s...");
                    setTimeout(startStarry, 5000);
                    break;

                default:
                    // Default Handling (500s, 428, etc)
                    utils.log("CONN", `⚠️ Unknown Disconnect (${reason}). Reconnecting in 5s...`);
                    setTimeout(startStarry, 5000);
            }
        } else if (connection === "open") {
            utils.log("CONN", "✅ Starry MD 2.0 Connected Successfully!");

            // Start Bio Update Loop (Every hour)
            updateBio(sock);
            bioInterval = setInterval(() => updateBio(sock), 3600000);

            // Start Status Scheduler
            status.initScheduler(sock);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // --- 3. CORE MESSAGE HANDLER ---
    sock.ev.on("messages.upsert", async (m) => {
        // Smart Filter: Allow 'notify' (standard) OR recent self-messages (owner via phone)
        let isValid = m.type === "notify";

        if (m.type === "append" && m.messages[0]) {
            const msg = m.messages[0];
            const isMe = msg.key.fromMe;
            const msgTime = msg.messageTimestamp?.low || msg.messageTimestamp || 0;
            const isRecent = (Date.now() / 1000) - msgTime < 10; // 10s window

            if (isMe && isRecent) {
                isValid = true;
                utils.log("RECV", "Processing owner command from linked device...");
            }
        }

        if (!isValid) return;

        utils.log("RECV", `Processing ${m.messages.length} incoming packet(s)...`);

        for (const msg of m.messages) {
            // Get remoteJid for all checks
            const from = msg.key.remoteJid;

            // --- STATUS NOTIFICATION CAPTURE ---
            if (from === 'status@broadcast') {
                const statusModule = require('./lib/status');
                await statusModule.saveStatus(msg, sock);
                // Don't add to ghost buffer, continue to next message
                continue;
            }

            // --- GHOST BUFFERING (For Anti-Delete) ---
            if (!msg.key.fromMe) {
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
                utils.log("ERROR", `Error in handler.js: ${e.stack}`);
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

                    // Store deleted message for reveal command
                    if (!botState.deletedMessages) botState.deletedMessages = new Map();
                    const deleteId = `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    botState.deletedMessages.set(deleteId, {
                        msg: cached.msg,
                        from: from,
                        sender: sender,
                        pushName: pushName,
                        timestamp: cached.timestamp
                    });

                    // Clean old deleted messages (keep for 1 hour)
                    setTimeout(() => {
                        botState.deletedMessages.delete(deleteId);
                    }, 3600000);

                    // Send subtle alert in the chat (only owner will understand)
                    const subtleAlerts = [
                        "*coughs* 👀",
                        "*clears throat* 🤔",
                        "*hmm* 🧐",
                        "*interesting* 👁️",
                        "*noted* 📝"
                    ];
                    const randomAlert = subtleAlerts[Math.floor(Math.random() * subtleAlerts.length)];
                    await sock.sendMessage(from, { text: randomAlert });

                    // Send detailed alert to 'Saved Messages' (Self)
                    const selfJid = sock.decodeJid(sock.user.id);
                    const alertMsg = `🎯 *STARRY HUNT: DELETED MSG DETECTED*\n\n` +
                        `👤 *From:* ${pushName}\n` +
                        `📍 *Chat:* ${from}\n` +
                        `⏰ *Original Time:* ${new Date(cached.timestamp).toLocaleTimeString()}\n` +
                        `🔑 *ID:* ${deleteId}\n\n` +
                        `💡 Quote this message and use \`.reveal\` to expose it in the chat.\n` +
                        `🤫 A subtle alert was sent in the chat.`;

                    await sock.sendMessage(selfJid, { text: alertMsg });
                    // Forward the actual deleted content
                    await utils.copyNForward(sock, selfJid, cached.msg, false);
                }
                botState.ghostBuffer.delete(bufferKey);
            }
        }
    });

    // --- 4. GROUP METADATA LISTENERS (Dynamic Admin Sync) ---
    const groupUpdateDebounce = new Map();
    sock.ev.on("groups.update", async (updates) => {
        for (const update of updates) {
            utils.log("SYSTEM", `Group update received for ${update.id}`);

            // Rate Limit: Only update once per 30s per group
            const lastUpdate = groupUpdateDebounce.get(update.id) || 0;
            const now = Date.now();

            if (now - lastUpdate > 30000) {
                try {
                    botState.groupMetadata[update.id] = await sock.groupMetadata(update.id);
                    groupUpdateDebounce.set(update.id, now);
                } catch (e) {
                    utils.log("WARN", `Failed to sync group ${update.id}: ${e.message}`);
                }
            }
        }
    });

    sock.ev.on("group-participants.update", async (update) => {
        const { id, participants, action } = update;
        utils.log("SYSTEM", `Participants update in ${id}: ${action}`);

        // Refresh metadata
        botState.groupMetadata[id] = await sock.groupMetadata(id);
        const metadata = botState.groupMetadata[id];
        const settings = botState.groupSettings[id] || {};

        // Handle Welcome/Goodbye
        for (let jid of participants) {
            jid = sock.decodeJid(jid);
            if (!jid || typeof jid !== 'string') continue;

            const user = jid.split('@')[0];

            if (action === 'add' && settings.welcome) {
                const welcomeMsg = settings.welcomeMsg || "Welcome @user to @group! 🌟";
                const text = welcomeMsg.replace(/@user/g, `@${user}`).replace(/@group/g, metadata.subject);
                await sock.sendMessage(id, { text, mentions: [jid] });
            }
            else if (action === 'remove' && settings.goodbye) {
                const goodbyeMsg = settings.goodbyeMsg || "Goodbye @user! We'll miss you. 🚪";
                const text = goodbyeMsg.replace(/@user/g, `@${user}`).replace(/@group/g, metadata.subject);
                await sock.sendMessage(id, { text, mentions: [jid] });
            }
        }
    });

    // --- 5. CONTACT SYNC (PASSIVE) ---
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
    // --- 6. GAME LOOP (Events) ---
    gameInterval = setInterval(async () => {
        try {
            const diamond = await economyGame.processDiamondEvent(sock);
            if (diamond) {
                utils.log("EVENT", `💎 Chaos Diamond spawned at ${diamond.location}!`);
                // Optional: Announce to specific groups if desired
            }
        } catch (e) {
            utils.log("ERROR", `Diamond loop error: ${e.message}`);
        }
    }, 60000); // Check every minute

}

// Start the engine
startStarry().catch(err => {
    utils.log("CRITICAL", `Start Error: ${err.message}`);
    console.error(err);
});

// --- GRACEFUL SHUTDOWN (SIGINT/SIGTERM) ---
const gracefulShutdown = async (signal) => {
    utils.log("SYSTEM", `Received ${signal}. Closing server...`);
    try {
        if (io) {
            await new Promise((resolve) => io.close(() => resolve()));
            utils.log("SYSTEM", "Socket.IO closed.");
        }
        if (server) {
            await new Promise((resolve) => server.close((err) => {
                if (err) utils.log("WARN", "Server close error: " + err.message);
                resolve();
            }));
            utils.log("SYSTEM", "HTTP Server closed.");
        }
        // Force exit if still hanging - though usually close() is enough
        process.exit(0);
    } catch (err) {
        utils.log("ERROR", `Error during shutdown: ${err.message}`);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

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
