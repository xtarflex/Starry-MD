const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs-extra");
const path = require("path");
const pino = require("pino");
const utils = require("./utils");
const qrcode = require("qrcode-terminal");

const sessions = new Map(); // Store active sockets: sessionId -> socket
const sessionInfo = new Map(); // Store metadata: sessionId -> { phoneNumber, status, owner }
const SESSIONS_FILE = path.join(__dirname, "../database/sessions.json");

// Helper to save sessions to disk
function saveSessions() {
    const data = {};
    for (const [id, info] of sessionInfo.entries()) {
        data[id] = info;
    }
    fs.writeJsonSync(SESSIONS_FILE, data, { spaces: 2 });
}

// Helper to load sessions from disk
function loadSessions() {
    if (fs.existsSync(SESSIONS_FILE)) {
        try {
            const data = fs.readJsonSync(SESSIONS_FILE);
            for (const [id, info] of Object.entries(data)) {
                sessionInfo.set(id, info);
            }
            utils.log("SESSION", `Loaded ${sessionInfo.size} sessions from database.`);
        } catch (err) {
            utils.log("ERROR", "Failed to load sessions.json");
        }
    }
}

// Load sessions on startup
loadSessions();

// Helper to ensure auth directory exists
const getAuthPath = (sessionId) => `auth_baileys_${sessionId}`;

async function startSession(sessionId, options = {}) {
    if (sessions.has(sessionId)) {
        utils.log("SESSION", `Session ${sessionId} already active.`);
        return sessions.get(sessionId);
    }

    utils.log("SESSION", `Starting session: ${sessionId}`);

    try {
        const authPath = getAuthPath(sessionId);
        fs.ensureDirSync(authPath); // Ensure folder exists
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false, // We'll handle pairing codes manually for sub-bots usually
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            syncFullHistory: false
        });

        // Store session reference
        sessions.set(sessionId, sock);
        sessionInfo.set(sessionId, {
            startTime: Date.now(),
            owner: options.owner,
            pairingMode: options.usePairingCode || false,
            phoneNumber: options.phoneNumber
        });
        saveSessions(); // Save to disk

        // Connection Update Handler
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === "close") {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) ?
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;

                utils.log("SESSION", `Session ${sessionId} closed. Reconnect: ${shouldReconnect}`);

                if (shouldReconnect && sessions.has(sessionId)) {
                    // Only reconnect if the session hasn't been stopped/deleted manually
                    setTimeout(() => startSession(sessionId, options), 5000);
                } else {
                    stopSession(sessionId);
                    utils.log("SESSION", `Session ${sessionId} logged out or stopped permanently.`);
                }
            } else if (connection === "open") {
                utils.log("SESSION", `Session ${sessionId} is now ONLINE.`);
            }

            // Handle QR for sub-sessions if needed (e.g. via web dashboard later)
            // For now, if we are in pairing mode, we expect the caller to request code
            if (qr && !options.usePairingCode && options.onQR) {
                options.onQR(qr);
            }
        });

        sock.ev.on("creds.update", saveCreds);

        // Simple Message Handler for Sub-Bots (can be expanded)
        sock.ev.on("messages.upsert", async (m) => {
            if (options.onMessage) {
                options.onMessage(m, sock);
            }
        });

        // if pairing code is requested immediately
        if (options.usePairingCode && !sock.authState.creds.me && options.phoneNumber) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(options.phoneNumber);
                    if (options.onPairingCode) {
                        options.onPairingCode(code);
                    }
                } catch (err) {
                    utils.log("ERROR", `Failed to request pairing code for ${sessionId}: ${err.message}`);
                }
            }, 3000);
        }

        return sock;
    } catch (err) {
        utils.log("ERROR", `Failed to start session ${sessionId}: ${err.message}`);
        return null;
    }
}

async function stopSession(sessionId) {
    const sock = sessions.get(sessionId);
    if (sock) {
        try {
            sock.end(undefined);
            sessions.delete(sessionId);
            sessionInfo.delete(sessionId);
            saveSessions(); // Update disk
            utils.log("SESSION", `Session ${sessionId} stopped.`);
        } catch (err) {
            console.error(err);
        }
    }
}

async function restoreSessions() {
    utils.log("SESSION", "Restoring sessions...");
    for (const [sessionId, info] of sessionInfo.entries()) {
        if (!sessions.has(sessionId)) {
            utils.log("SESSION", `Restoring: ${sessionId}`);
            // We need to pass the original options like owner and phoneNumber.
            // Fortunately we stored them in sessionInfo.
            await startSession(sessionId, {
                owner: info.owner,
                phoneNumber: info.phoneNumber,
                usePairingCode: info.pairingMode
            });
        }
    }
}

async function deleteSession(sessionId) {
    await stopSession(sessionId);
    const authPath = getAuthPath(sessionId);
    if (fs.existsSync(authPath)) {
        try {
            fs.removeSync(authPath);
            utils.log("SESSION", `Deleted data for session ${sessionId}`);
            return true;
        } catch (err) {
            utils.log("ERROR", `Failed to delete session data ${sessionId}: ${err.message}`);
            return false;
        }
    }
    return false;
}

module.exports = {
    startSession,
    stopSession,
    deleteSession,
    restoreSessions,
    getSession: (id) => sessions.get(id),
    listSessions: () => {
        const list = [];
        for (const [id, info] of sessionInfo.entries()) {
            list.push({ id, ...info });
        }
        return list;
    }
};
