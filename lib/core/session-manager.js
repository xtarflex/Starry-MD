import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from 'url';
import pino from "pino";
import utils from "./utils.js";
import qrcode from "qrcode-terminal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessions = new Map(); // Store active sockets: sessionId -> socket
const sessionInfo = new Map(); // Store metadata: sessionId -> { phoneNumber, status, owner }
const SESSIONS_FILE = path.join(__dirname, "../../database/sessions.json");

// Helper to save sessions to disk
function saveSessions() {
    const data = {};
    for (const [id, info] of sessionInfo.entries()) {
        data[id] = info;
    }
    fs.writeJsonSync(SESSIONS_FILE, data);
}

// Load sessions on startup (Internal)
function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readJsonSync(SESSIONS_FILE);
            for (const [id, info] of Object.entries(data)) {
                sessionInfo.set(id, info);
            }
        }
    } catch (e) {
        console.error("Failed to load sessions:", e);
    }
}

// Initialize internal state
loadSessions();

// Create a new session (or restore)
async function startSession(sessionId, options = {}) {
    if (sessions.has(sessionId)) return sessions.get(sessionId);

    const { state, saveCreds } = await useMultiFileAuthState(`sessions/${sessionId}`);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket.default({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: true, // Only for main session ideally
        auth: state,
        browser: ["StarryMD", "Chrome", "1.0.0"],
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
    });

    sessions.set(sessionId, sock);
    sessionInfo.set(sessionId, { status: 'connecting', ...sessionInfo.get(sessionId) });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // If manual session creation, maybe send QR via generic hook?
            // For now, terminal QR is fine.
            sessionInfo.set(sessionId, { ...sessionInfo.get(sessionId), status: 'qr_ready' });
        }

        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                startSession(sessionId, options);
            } else {
                console.log(`Session ${sessionId} logged out.`);
                sessions.delete(sessionId);
                sessionInfo.set(sessionId, { ...sessionInfo.get(sessionId), status: 'logged_out' });
                fs.removeSync(`sessions/${sessionId}`);
            }
        } else if (connection === "open") {
            console.log(`Session ${sessionId} connected.`);
            const user = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            sessionInfo.set(sessionId, { status: 'connected', phoneNumber: user, owner: options.owner });
            saveSessions();
        }
    });

    sock.ev.on("creds.update", saveCreds);

    return sock;
}

// Restore all saved sessions
async function restoreSessions() {
    console.log(`[SessionManager] Restoring ${sessionInfo.size} sessions...`);
    const promises = [];
    for (const [id, info] of sessionInfo.entries()) {
        if (info.status !== 'logged_out' && info.status !== 'stopped') {
            promises.push(startSession(id, { owner: info.owner }));
        }
    }
    await Promise.all(promises);
}

function getSession(sessionId) {
    return sessions.get(sessionId);
}

function stopSession(sessionId) {
    const sock = sessions.get(sessionId);
    if (sock) {
        sock.end(undefined);
        sessions.delete(sessionId);
        sessionInfo.set(sessionId, { ...sessionInfo.get(sessionId), status: 'stopped' });
        saveSessions();
        return true;
    }
    return false;
}

function deleteSession(sessionId) {
    if (sessions.has(sessionId)) {
        stopSession(sessionId);
    }
    // Remove folder and data
    try {
        fs.removeSync(`sessions/${sessionId}`);
        sessionInfo.delete(sessionId);
        saveSessions();
        console.log(`[SessionManager] Deleted session ${sessionId}`);
        return true;
    } catch (e) {
        console.error(`[SessionManager] Failed to delete session ${sessionId}:`, e);
        return false;
    }
}

function listSessions() {
    return Array.from(sessionInfo.entries()).map(([id, info]) => ({ id, ...info }));
}

export default {
    startSession,
    restoreSessions,
    getSession,
    stopSession,
    deleteSession,
    listSessions
};
