import { existsSync, remove, writeFileSync } from 'fs-extra';
import { log, simulateTyping, sessionName as _sessionName } from './utils';
import { resolve } from 'path';

/*
 * System Commands (Restart, Kill, Reset)
 */

// Safe helper to remove auth data (Folder or Database)
async function removeAuth(selectedSession) {
    const sessionId = selectedSession || "main";
    const authPath = selectedSession ? `auth_baileys_${selectedSession}` : "auth_baileys";
    const sessionFile = `database/session_${sessionId}.json`;

    let deleted = false;

    // 1. Remove Folder
    const fullPath = resolve(authPath);
    if (existsSync(fullPath)) {
        try {
            await remove(fullPath);
            deleted = true;
        } catch (e) {
            log("ERROR", `Failed to remove auth folder: ${e.message}`);
        }
    }

    // 2. Remove Session File
    const fullSessionFile = resolve(sessionFile);
    if (existsSync(fullSessionFile)) {
        try {
            await remove(fullSessionFile);
            deleted = true;
        } catch (e) {
            log("ERROR", `Failed to remove session file: ${e.message}`);
        }
    }

    return deleted;
}

// 1. RESTART (.restart)
const handleRestart = async (msg, sock) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    await simulateTyping(sock, from, 1000);
    await sock.sendMessage(from, { text: "🔄 *RESTARTING...*\n\n_Be right back!_" }, { quoted: msg });

    log("SYSTEM", "Restart command received. Exiting process...");

    // Trigger Nodemon by updating a watched file
    try {
        writeFileSync('update.txt', `Restart Update: ${new Date().toISOString()}`);
    } catch (e) {
        // Ignore if fails
    }

    // Give message time to send
    setTimeout(() => {
        process.exit(1); // Exit 1 triggers start.bat loop AND nodemon (due to file change above)
    }, 1000);
};

// 2. KILL & CLEAN (.killclean)
const handleKill = async (msg, sock) => {
    const from = sock.decodeJid(msg.key.remoteJid);

    await sock.sendMessage(from, { text: "💀 *SYSTEM SHUTDOWN*\n\nDeleting session and terminating..." }, { quoted: msg });

    log("SYSTEM", "Kill command received. Cleaning session...");

    // We can't easily retrieve the 'selectedSession' from here unless we pass it down or read args again.
    // However, index.js uses the same logic. Let's re-parse simply or assume default for now.
    // BETTER: The bot probably knows its session name if we stored it in utils. 
    // Checking utils.js... assuming we added setSessionName in index.js.

    // Retrieve session name from utils
    let sessionName = null;
    if (_sessionName && _sessionName.startsWith('bot_')) {
        sessionName = _sessionName.replace('bot_', '');
    }

    setTimeout(async () => {
        const success = await removeAuth(sessionName);
        if (success) {
            console.log("Session deleted. Bye.");
            process.exit(0); // Exit 0 means done (supervisor might not restart if configured effectively)
        } else {
            console.error("Failed to delete session.");
            process.exit(1);
        }
    }, 1000);
};

// 3. RESET MOBILE (.resetmobile [number])
const handleResetMobile = async (msg, sock, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const hasArgs = args && args.length > 0;

    // Clean up number if provided (remove + and spaces)
    let targetNumber = null;
    if (hasArgs) {
        // Assume args comes in as array of strings from handler
        const raw = args.join('');
        targetNumber = raw.replace(/[^0-9]/g, '');
    }

    let reply = "📲 *RESETTING TO MOBILE MODE*\n\nSystem will restart and ask for a new phone number.";
    if (targetNumber) {
        reply = `📲 *FAST RESET*\n\nRestarting to request code for: *${targetNumber}*`;
    }

    await simulateTyping(sock, from, 1500);
    await sock.sendMessage(from, { text: reply }, { quoted: msg });

    log("SYSTEM", `Reset Mobile command received. Target: ${targetNumber || "Manual Input"}`);

    // Retrieve session name from utils
    let sessionName = null;
    if (_sessionName && _sessionName.startsWith('bot_')) {
        sessionName = _sessionName.replace('bot_', '');
    }

    setTimeout(async () => {
        // 1. Delete Session
        await removeAuth(sessionName);

        // 2. Create Flag Files
        writeFileSync('./.mobile_mode_request', 'true');

        if (targetNumber) {
            writeFileSync('./.mobile_number_cache', targetNumber);
        }

        // Trigger Nodemon
        try {
            writeFileSync('update.txt', `Mobile Reset Update: ${new Date().toISOString()}`);
        } catch (e) { }

        // 3. Exit (trigger restart)
        process.exit(1);
    }, 1000);
};

export default {
    handleRestart,
    handleKill,
    handleResetMobile
};
