const fs = require('fs-extra');
const utils = require('./utils');

/**
 * Message Handler 2.0 (Neural Link)
 */
module.exports = async (m, sock, botState) => {
    const msg = m.messages[0];
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const isMe = msg.key.fromMe;
    const pushName = msg.pushName || "User";

    // Extract Body
    const body = (msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "").trim();

    const sender = isMe ? (sock.user.id.split(":")[0] + "@s.whatsapp.net") : (isGroup ? msg.key.participant : from);
    const isOwner = isMe || (sender && typeof sender === 'string' && process.env.OWNER_ID && sender.includes(process.env.OWNER_ID));

    // --- 1. MINIMAL MONITORING ---
    if (!isMe) {
        utils.log("INFLOW", `Msg from ${pushName} (${sender}): "${body.slice(0, 20)}..."`);
    }

    // --- 2. SURVIVAL COMMANDS ---
    const isCommand = body.startsWith('.');
    if (isCommand) {
        const cmd = body.slice(1).toLowerCase();

        // Public Command: Ping
        if (cmd === 'ping') {
            const now = Date.now();

            // 1. Group Volume Check (Bulk Spam Guard)
            if (isGroup && !isOwner) {
                const groupData = botState.groupCounts.get(from) || { count: 0, lastReset: 0 };

                // Reset bucket every 3 seconds
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

            // 2. Individual Rate Limit (Per-User Guard)
            if (!isOwner && !utils.canProcess(sender, botState.cooldowns)) {
                await sock.sendMessage(from, { react: { text: "❄️", key: msg.key } });
                return;
            }

            utils.log("COMMAND", `Responding to public ping from ${pushName}`);
            await sock.sendMessage(from, { text: "Pong! 🚀 Starry MD 2.0 is Alive." }, { quoted: msg });
            return;
        }

        // Public Command: Menu
        if (cmd === 'menu' || cmd === 'help') {
            const menu = `🌌 *STARRY MD 2.0: NEURAL MAP* 🛰️

*--- SYSTEM MODES ---*
🟢 \`$public\` - Diplomatic Mode (Default)
👻 \`$private\` - Stealth Mode (Owner Only)
💤 \`$sleep\` - Away Mode (Auto-Responder)

*--- 🛡️ THE SHIELD ---*
❄️ *Rate Limit* - [ACTIVE]
🤝 *Handshake* - [PLANNED]
🆔 *ID Sync* - [PASSIVE]

*--- 🚀 WEAPONRY ---*
📍 \`.ping\` - Check Star-Link
📖 \`.menu\` - Open Star-Map
🤖 \`.ai\` - Gemini Intelligence [OFFLINE]
🖼️ \`.s\` - Sticker Forge [OFFLINE]
🕵️ \`.hunt\` - Anti-Delete [PLANNED]

*Current Mode:* ${botState.mode}
*Foundation:* Stable.
_Starry MD 2.0 Rebirth Protocol_`;

            await sock.sendMessage(from, { react: { text: "📑", key: msg.key } });
            await sock.sendMessage(from, { text: menu }, { quoted: msg });
            return;

            // Owner-Only Commands
            if (isOwner) {
                // Future owner commands go here
            }
        }
    };
