const fs = require('fs-extra');
const config = require('../config');
const utils = require('./utils');
const getMenu = require('./menu');

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
    const isOwner = isMe || (sender && typeof sender === 'string' && config.OWNER_ID && sender.includes(config.OWNER_ID));

    // --- 1. MINIMAL MONITORING ---
    if (!isMe) {
        utils.log("INFLOW", `Msg from ${pushName} (${sender}): "${body.slice(0, 20)}..."`);
    }

    // --- 2. SURVIVAL COMMANDS ---
    const pTool = config.PREFIX_TOOL || '.';
    const pSys = config.PREFIX_SYSTEM || '$';

    const isTool = body.startsWith(pTool);
    const isSys = body.startsWith(pSys);

    if (isTool || isSys) {
        const currentPrefix = isTool ? pTool : pSys;
        const cmd = body.slice(currentPrefix.length).toLowerCase();

        // 1. TOOL PREFIX COMMANDS (.)
        if (isTool) {
            // Public Command: Ping
            if (cmd === 'ping') {
                const now = Date.now();
                if (isGroup && !isOwner) {
                    const groupData = botState.groupCounts.get(from) || { count: 0, lastReset: 0 };
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
                const menuText = getMenu(botState.mode);
                const path = require('path');
                const bannerPath = path.join(__dirname, '../database/banner.png');

                await sock.sendMessage(from, { react: { text: "📑", key: msg.key } });
                await sock.sendMessage(from, {
                    image: fs.existsSync(bannerPath) ? { url: bannerPath } : { url: 'https://i.imgur.com/TyCSG9A.jpeg' },
                    caption: menuText,
                    contextInfo: {
                        externalAdReply: {
                            title: "Starry MD 2.0: Neural Map",
                            body: "Rebirth Protocol v1.0.0",
                            thumbnailUrl: "https://i.imgur.com/TyCSG9A.jpeg",
                            sourceUrl: "https://github.com/Starry-MD",
                            mediaType: 1,
                            renderLargerThumbnail: true
                        }
                    }
                }, { quoted: msg });
                return;
            }

            // Owner-Only Diagnostics
            if (isOwner) {
                if (cmd === 'runtime' || cmd === 'uptime') {
                    const uptime = process.uptime();
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    const runtimeStr = `🚀 *STARRY UPTIME*\n│ *Hours:* ${hours}\n│ *Minutes:* ${minutes}\n│ *Seconds:* ${seconds}\n╰───────────────`;
                    await sock.sendMessage(from, { text: runtimeStr }, { quoted: msg });
                    return;
                }

                if (cmd === 'sys' || cmd === 'system') {
                    const os = require('os');
                    const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
                    const ramFree = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
                    const sysStr = `📊 *SYSTEM STATS*\n│ *OS:* ${os.platform()} ${os.arch()}\n│ *CPU:* ${os.cpus()[0].model}\n│ *RAM:* ${(ramTotal - ramFree).toFixed(2)}/${ramTotal} GB\n╰───────────────`;
                    await sock.sendMessage(from, { text: sysStr }, { quoted: msg });
                    return;
                }

                if (cmd === 'db' || cmd === 'database') {
                    const path = require('path');
                    const sessionPath = path.join(__dirname, '../database/session');
                    const sessionSize = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath).length : 0;
                    const dbStr = `🗄️ *DATABASE HEALTH*\n│ *Session Files:* ${sessionSize}\n│ *Saved Contacts:* ${Object.keys(botState.contacts).length}\n│ *Sync Status:* ACTIVE\n╰───────────────`;
                    await sock.sendMessage(from, { text: dbStr }, { quoted: msg });
                    return;
                }
            }

            // Fallback for unknown tool command
            await sock.sendMessage(from, { text: `❓ *Unknown Command:* "${cmd}"\n💡 Type *.menu* to see all features.` }, { quoted: msg });
            return;
        }

        // 2. SYSTEM PREFIX COMMANDS ($)
        if (isSys && isOwner) {
            if (cmd === 'public') {
                botState.mode = '$public';
                await sock.sendMessage(from, { text: "🟢 *MODE UPDATED:* Public Pulse Active." }, { quoted: msg });
                return;
            }
            if (cmd === 'private') {
                botState.mode = '$private';
                await sock.sendMessage(from, { text: "👻 *MODE UPDATED:* Stealth Mode Active." }, { quoted: msg });
                return;
            }
            if (cmd === 'sleep') {
                botState.mode = '$sleep';
                await sock.sendMessage(from, { text: "💤 *MODE UPDATED:* Sleep Mode Active." }, { quoted: msg });
                return;
            }
        }
    }
};
