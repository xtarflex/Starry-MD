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
const economyGame = require("./lib/economy-game");
const sessionManager = require("./lib/session-manager");



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
    groupMetadata: {}, // Cache for group roles and settings
    settings: fs.readJsonSync("./database/bot_settings.json", { throws: false }) || { autoBio: true, customBio: null, viewOnceMode: "chat" },
    groupSettings: fs.readJsonSync("./database/group_settings.json", { throws: false }) || {},
    bannedChats: fs.readJsonSync("./database/banned_chats.json", { throws: false }) || []
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

async function startStarry() {
    printBootArt();
    utils.log("SYSTEM", "Initializing Starry MD Core...");

    // Restore Sub-Bots
    await sessionManager.restoreSessions();

    const args = process.argv.slice(2);

    // Improved Argument Parser
    let usePairingCode = false;
    let selectedSession = null; // Default to null for standard auth_baileys
    const knownFlags = ['--mobile', '-m', '--mn', '--session', '-s'];

    // Scan args
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--mn' || arg === '--mobile' || arg === '-m') {
            usePairingCode = true;
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
            utils.log("WARN", `Unknown argument '${arg}' ignored. To name a session, use '--session=${arg.replace(/^-+/, '')}' or just '${arg.replace(/^-+/, '')}'`);
        }
    }

    // Determine session from naked args if not set via flags
    if (!selectedSession) {
        const potentialSession = args.find(a => !a.startsWith('-') && !['--mobile', '-m', '--mn'].includes(a));
        if (potentialSession) selectedSession = potentialSession;
    }

    // Set Log File Name based on Session
    utils.setSessionName(selectedSession);

    const authPath = selectedSession ? `auth_baileys_${selectedSession}` : "auth_baileys";
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    utils.log("CONN", `Using WA v${version.join(".")}, isLatest: ${isLatest}`);
    utils.log("CONN", `Session: ${selectedSession || "Default"} | Auth Path: ./${authPath}`);

    // Readline Question Helper
    const readline = require("readline");
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

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: !usePairingCode, // Disable QR if using pairing code
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Standard browser for better compatibility
        syncFullHistory: false
    });

    // Pairing Code Logic
    if (usePairingCode && !sock.authState.creds.me) {
        // Wait a tick to ensure socket init
        setTimeout(async () => {
            let phoneNumber = await question('Please enter your phone number (International Format, e.g., 23480123...): ');
            phoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Sanitize

            if (!phoneNumber) {
                utils.log("ERROR", "Invalid phone number entered. Exiting.");
                process.exit(1);
            }

            const code = await sock.requestPairingCode(phoneNumber);
            utils.log("PAIRING", `Your Pairing Code: ${code}`);
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

            // FIREPROOF CONTACT SYNC: Load all existing contacts in background
            syncExistingContacts(sock);

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
    setInterval(async () => {
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
