const utils = require('../utils');
const fs = require('fs-extra');

module.exports = {
    name: 'ping',
    aliases: ['p', 'speed'],
    category: 'general',
    description: 'Check bot latency and server status.',
    execute: async (msg, sock, args, botState) => {
        const from = msg.key.remoteJid;
        const pushName = msg.pushName || "User";
        const isGroup = from.endsWith('@g.us');
        const sender = utils.decodeJid(msg.key.participant || from);
        const isMe = msg.key.fromMe;
        const config = require('../../../config');
        const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
        const isOwner = isMe || (sender && ownerIds.some(id => sender.includes(id)));

        // Rate Limit Check (Optional specific logic from handler)
        if (isGroup && !isOwner) {
            const groupData = botState.groupCounts.get(from) || { count: 0, lastReset: 0 };
            const now = Date.now();
            if (now - groupData.lastReset > 3000) {
                groupData.count = 0;
                groupData.lastReset = now;
            }
            if (groupData.count >= 5) {
                await sock.sendMessage(from, { react: { text: "❄️", key: msg.key } });
                return;
            }
            groupData.count++;
            botState.groupCounts.set(from, groupData);
        }

        utils.log("COMMAND", `Responding to speed test from ${pushName}`);

        const startTime = Date.now();
        const loadingMsg = await sock.sendMessage(from, { text: "🏓 Pinging..." }, { quoted: msg });
        const responseTime = Date.now() - startTime;

        // Latency Check
        const pingStart = Date.now();
        await sock.sendMessage(from, { react: { text: "🚀", key: msg.key } });
        const latency = Date.now() - pingStart;

        let speedRating = "Poor", speedEmoji = "🔴";
        if (latency < 100) { speedRating = "Excellent"; speedEmoji = "🟢"; }
        else if (latency < 300) { speedRating = "Good"; speedEmoji = "🟡"; }
        else if (latency < 500) { speedRating = "Fair"; speedEmoji = "🟠"; }

        const pongText = `🏓 *Pong!*

⚡ *Starry MD 2.0 is Alive*

╭━━━ 📊 *METRICS* ━━━╮
┃
┃ ⏱️ *Response:* ${responseTime}ms
┃ 📡 *Latency:* ${latency}ms
┃ ${speedEmoji} *Speed:* ${speedRating}
┃
╰━━━━━━━━━━━━━━━━━━╯

> _Systems operational._`;

        await sock.sendMessage(from, { text: pongText, edit: loadingMsg.key });
    }
};
