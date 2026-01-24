const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');

const DB_PATH = path.join(__dirname, '../database/sms_sessions.json');

// --- HELPER: Session Management ---
const loadSessions = async () => {
    try {
        if (!fs.existsSync(DB_PATH)) await fs.writeJson(DB_PATH, {});
        return await fs.readJson(DB_PATH);
    } catch (error) {
        return {};
    }
};

const saveSessions = async (data) => {
    await fs.writeJson(DB_PATH, data, { spaces: 2 });
};

// --- HELPER: Time Parser ---
const parseTime = (timeStr) => {
    // Expected: "10 minutes ago", "1 hour ago", "2 hours ago"
    if (!timeStr) return 0;

    const now = Date.now();
    const regex = /(\d+)\s+(minute|hour|day|second)s?\s+ago/i;
    const match = timeStr.match(regex);

    if (match) {
        let val = parseInt(match[1]);
        let unit = match[2].toLowerCase();

        let ms = 0;
        if (unit.startsWith('second')) ms = val * 1000;
        if (unit.startsWith('minute')) ms = val * 60 * 1000;
        if (unit.startsWith('hour')) ms = val * 3600 * 1000;
        if (unit.startsWith('day')) ms = val * 86400 * 1000;

        return now - ms;
    }

    // Fallback: if it says "Just now" or similar
    if (timeStr.toLowerCase().includes('just')) return now;

    return 0; // Unknown format, treat as very old
};

// Extract Numbers from Homepage
const extractNumbers = (html) => {
    const $ = cheerio.load(html);
    const list = [];

    $('a[href*="receive-sms-"]').each((i, el) => {
        let link = $(el).attr('href');
        let rawText = $(el).text().trim();

        if (link && !link.startsWith('http')) {
            if (link.startsWith('/')) link = `http://www.receivesmsonline.net${link}`;
            else link = `http://www.receivesmsonline.net/${link}`;
        }

        const cleanText = rawText.replace(/[^\d+]/g, '');

        if (cleanText.length > 5 && link) {
            list.push({ number: cleanText, link });
        }
    });

    return [...new Map(list.map(item => [item.number, item])).values()];
};

// Extract Messages with Timestamp Parsing
const extractMessages = (html) => {
    const $ = cheerio.load(html);
    const messages = [];

    // Table rows: <tr><td>From</td><td>Time</td><td>Message</td></tr>
    $('table tr').each((i, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 3) {
            const sender = $(tds[0]).text().trim();
            const timeStr = $(tds[1]).text().trim();
            const content = $(tds[2]).text().trim();

            if (sender.toLowerCase().includes('sender') || sender.toLowerCase().includes('from')) return;

            messages.push({
                sender,
                content,
                timeStr,
                timestamp: parseTime(timeStr),
                id: utils.generateRandomString(4)
            });
        }
    });

    return messages;
};

const handleTempSms = async (msg, sock, botState, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from; // Identify user correctly in groups too
    const userKey = sender;

    // Command parsing
    // .tempsms <number> [all]
    let command = args[0] ? args[0].toLowerCase() : '';
    let targetNumber = args[0];
    let isReset = args[1] && (args[1].toLowerCase() === 'all' || args[1].toLowerCase() === 'reset');

    // CASE 1: List Numbers
    if (!command || command === 'list') {
        try {
            await sock.sendMessage(from, { react: { text: "📶", key: msg.key } });

            const res = await axios.get('http://www.receivesmsonline.net/', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0' }
            });
            const numbers = extractNumbers(res.data);

            if (numbers.length === 0) {
                return sock.sendMessage(from, { text: "❌ No numbers available." }, { quoted: msg });
            }

            let text = `📱 *TEMP NUMBERS* (Free)\n\n`;
            numbers.slice(0, 15).forEach((n, i) => {
                text += `\n${i + 1}. \`${n.number}\``;
            });
            text += `\n\n_Type_ \`.tempsms <number>\` _to view inbox._`;

            return sock.sendMessage(from, { text }, { quoted: msg });
        } catch (e) {
            return sock.sendMessage(from, { text: "❌ Service unavailable." }, { quoted: msg });
        }
    }

    // CASE 2: Get Messages
    try {
        await sock.sendMessage(from, { react: { text: "🔄", key: msg.key } });

        // 1. Resolve Link
        const res = await axios.get('http://www.receivesmsonline.net/', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0' }
        });
        const numbers = extractNumbers(res.data);
        const cleanTarget = targetNumber.replace(/\D/g, '');
        const found = numbers.find(n => n.number.replace(/\D/g, '').includes(cleanTarget));

        if (!found) {
            return sock.sendMessage(from, { text: `❌ Number not found.` }, { quoted: msg });
        }

        // 2. Fetch Messages
        const msgRes = await axios.get(found.link, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0' }
        });
        const allMessages = extractMessages(msgRes.data);

        if (allMessages.length === 0) {
            return sock.sendMessage(from, { text: `📭 *Inbox Empty* for ${found.number}` }, { quoted: msg });
        }

        // 3. Load Session State
        const db = await loadSessions();
        if (!db[userKey]) db[userKey] = {};

        const lastCheck = db[userKey][found.number] || 0;
        const now = Date.now();

        // 4. Filtering Logic
        let displayMessages = [];
        let statusText = "";

        if (isReset || lastCheck === 0) {
            // "All" mode or First Time
            // Show recent 7
            displayMessages = allMessages.slice(0, 7);
            statusText = isReset ? `(Showing All)` : `(First Check)`;
        } else {
            // "Smart" mode
            // Filter messages NEWER than lastCheck
            // Note: Timestamps are approximate (Date.now() - X mins). 
            // Better to use a buffer (e.g. -1 min) to avoid missing partial overlaps? 
            // Or strictly > lastCheck.
            // Since scraping gives '10 mins ago', if we checked '5 mins ago', '10 mins ago' is OLD.
            // Correct: messageTimestamp > lastCheck

            displayMessages = allMessages.filter(m => m.timestamp > lastCheck);

            if (displayMessages.length === 0) {
                // No new messages
                const timeAgo = utils.formatTime(now - lastCheck);
                const text = `📭 *No New Messages*\n\nNumber: \`${found.number}\`\nLast checked: ${timeAgo} ago.\n\n_Type_ \`.tempsms ${targetNumber} all\` _to see history._`;

                // Update timestamp anyway to "now" so we don't spam "no new" if they check again immediately?
                // Actually, if they check again immediately, it's still "No New", so lastCheck stays relevant.
                // But if they verify their code, they want to see it.
                // Let's update timestamp ONLY if we successfully showed something?
                // No, standard behavior: if I check now, 'last check' becomes now.
                db[userKey][found.number] = now;
                await saveSessions(db);

                return sock.sendMessage(from, { text }, { quoted: msg });
            }

            statusText = `(${displayMessages.length} New)`;
        }

        // 5. Update Timestamp
        db[userKey][found.number] = now;
        await saveSessions(db);

        // 6. Construct Response
        let reply = `📨 *INBOX: ${found.number}* ${statusText}\n\n`;

        displayMessages.forEach(m => {
            // Add NEW tag if it's strictly new (for visual flair even in 'all' view?)
            const isFresh = m.timestamp > (lastCheck || 0);
            const tag = isFresh ? "🆕 " : "";

            reply += `${tag}👤 *From:* ${m.sender}\n`;
            reply += `📝 *Msg:* ${m.content}\n`;
            reply += `⏰ ${m.timeStr}\n`;
            reply += `───────────────────\n`;
        });

        if (!isReset && lastCheck !== 0) {
            reply += `\n_Viewing new messages only._\n_Use_ \`.tempsms ${targetNumber} all\` _for full history._`;
        }

        await sock.sendMessage(from, { text: reply }, { quoted: msg });

    } catch (e) {
        utils.log("ERROR", `Temp SMS Failed: ${e.message}`);
        await sock.sendMessage(from, { text: "❌ Service unavailable (try again later)." }, { quoted: msg });
    }
};

module.exports = { handleTempSms };
