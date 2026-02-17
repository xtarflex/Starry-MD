import { get, post } from 'axios';
import { existsSync, writeJson, readJson } from 'fs-extra';
import { join } from 'path';
import { generateRandomString, log } from '../core/utils';

const API_BASE = 'https://api.mail.tm';
const DB_PATH = join(__dirname, '../database/temp_mails.json');

// Helper to load/save DB
const loadDb = async () => {
    try {
        if (!existsSync(DB_PATH)) await writeJson(DB_PATH, {});
        return await readJson(DB_PATH);
    } catch (error) {
        return {};
    }
};

const saveDb = async (data) => {
    await writeJson(DB_PATH, data, { spaces: 2 });
};

/**
 * Handle Temporary Email Command (Smart Context Version)
 */
const handleTempMail = async (msg, sock, botState, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid; // Group support: track by User JID
    const command = args && args[0] ? args[0].toLowerCase() : '';

    try {
        const db = await loadDb();

        // Initialize user state if not exists
        if (!db[sender]) {
            db[sender] = { lastActive: null, emails: {}, msgCache: [] };
        }
        const userState = db[sender];

        // --- COMMAND: NEW (Generate) ---
        if (command === 'new' || command === 'create' || (!userState.lastActive && !command)) {
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

            // 1. Get Domain
            const domainsRes = await get(`${API_BASE}/domains`);
            const domains = domainsRes.data['hydra:member'];
            if (!domains || domains.length === 0) throw new Error("No domains available");

            const domain = domains[0].domain;
            const username = `starry_${generateRandomString(6).toLowerCase()}`;
            const password = generateRandomString(12);
            const address = `${username}@${domain}`;

            // 2. Create Account
            await post(`${API_BASE}/accounts`, { address, password });

            // 3. Get Token
            const tokenRes = await post(`${API_BASE}/token`, { address, password });
            const token = tokenRes.data.token;

            // 4. Save to User State
            userState.emails[address] = { token, password, createdAt: Date.now() };
            userState.lastActive = address;
            userState.msgCache = []; // Clear cache on new email
            await saveDb(db);

            // 5. Send Copy-Friendly Response
            await sock.sendMessage(from, {
                text: `� *New Identity Created!*`
            }, { quoted: msg });

            // Send address separately for easy copying
            await sock.sendMessage(from, { text: address });

            const infoText = `🔑 *Password:* ${password}\n\n` +
                `_Your inbox is now active. Type_ \`.tempmail\` _anytime to check it._`;

            await sock.sendMessage(from, { text: infoText });
            return;
        }

        // --- COMMAND: LIST (Show History) ---
        if (command === 'list' || command === 'history') {
            const emails = Object.keys(userState.emails);
            if (emails.length === 0) {
                return sock.sendMessage(from, { text: "📜 No history found. Type `.tempmail new` to create one." }, { quoted: msg });
            }

            let listText = `📂 *Your Temp Mail Accounts*\n\n`;
            emails.forEach((email, i) => {
                const isCurrent = email === userState.lastActive ? " *[ACTIVE]*" : "";
                listText += `${i + 1}. \`${email}\`${isCurrent}\n`;
            });
            listText += `\n_To switch, type:_ \`.tempmail <email>\``;

            return sock.sendMessage(from, { text: listText }, { quoted: msg });
        }

        // --- COMMAND: SWITCH (Change Active Email) ---
        // Check if arg is an email we own
        if (command.includes('@') && userState.emails[command]) {
            userState.lastActive = command;
            userState.msgCache = []; // Clear cache when switching
            await saveDb(db);
            return sock.sendMessage(from, { text: `✅ Switched to \`${command}\`. Type \`.tempmail\` to check inbox.` }, { quoted: msg });
        }

        // --- COMMAND: READ MESSAGE (Number or ID) ---
        // If arg is a number (1-5), use cache. If ID, use ID.
        if (args.length > 0 && !isNaN(args[0])) {
            const index = parseInt(args[0]) - 1;

            // Check Cache
            if (index >= 0 && index < userState.msgCache.length) {
                const cachedMsg = userState.msgCache[index];
                return readMessage(sock, from, msg, userState, cachedMsg.id);
            }
        }

        // If arg is a raw ID (sanity check length)
        if (args.length > 0 && args[0].length > 15) {
            return readMessage(sock, from, msg, userState, args[0]);
        }

        // --- COMMAND: CHECK INBOX (Default) ---
        // If we fall through to here, we check the inbox of `lastActive`
        if (!userState.lastActive) {
            return sock.sendMessage(from, { text: "🤷‍♂️ No active email. Type `.tempmail new` to create one." }, { quoted: msg });
        }

        await checkInbox(sock, from, msg, userState, db);

    } catch (error) {
        log("ERROR", `TempMail Failed: ${error.message}`);
        await sock.sendMessage(from, { text: `❌ Error: ${error.message}` }, { quoted: msg });
    }
};

/**
 * Helper: Check Inbox & Update Cache
 */
async function checkInbox(sock, from, msg, userState, db) {
    const email = userState.lastActive;
    const creds = userState.emails[email];

    if (!creds) return sock.sendMessage(from, { text: "❌ Credentials lost. Please generate a new email." });

    await sock.sendMessage(from, { react: { text: "🔄", key: msg.key } });

    const config = {
        headers: {
            'Authorization': `Bearer ${creds.token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    const res = await get(`${API_BASE}/messages?page=1`, config);
    const messages = res.data['hydra:member'];

    if (!messages || messages.length === 0) {
        return sock.sendMessage(from, { text: `📭 *Inbox Empty* (\`${email}\`)\n\nWaiting for new mails...` }, { quoted: msg });
    }

    // Update Cache (Store key details for "read by number")
    userState.msgCache = messages.slice(0, 5).map(m => ({
        id: m.id,
        subject: m.subject,
        from: m.from.address
    }));
    await saveDb(db); // Save cache to persistence

    let reply = `📬 *INBOX* (\`${email}\`)\n\n`;
    userState.msgCache.forEach((m, i) => {
        reply += `*${i + 1}.* ${m.subject}\n`;
        reply += `   └ 👤 ${m.from}\n\n`;
    });

    reply += `_Type_ \`.tempmail <number>\` _to read._`;
    await sock.sendMessage(from, { text: reply }, { quoted: msg });
}

/**
 * Helper: Read Specific Message
 */
async function readMessage(sock, from, msg, userState, msgId) {
    const email = userState.lastActive;
    const creds = userState.emails[email];

    await sock.sendMessage(from, { react: { text: "📖", key: msg.key } });

    const config = {
        headers: {
            'Authorization': `Bearer ${creds.token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    try {
        const res = await get(`${API_BASE}/messages/${msgId}`, config);
        const data = res.data;

        const body = data.text || data.intro || "(No text content)";

        const view = `📨 *READING MAIL*\n` +
            `👤 *From:* ${data.from.name || ''} <${data.from.address}>\n` +
            `📝 *Subject:* ${data.subject}\n` +
            `──────────────\n\n` +
            `${body}\n\n` +
            `──────────────`;

        await sock.sendMessage(from, { text: view }, { quoted: msg });

    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Failed to download message." }, { quoted: msg });
    }
}

export default { handleTempMail };
