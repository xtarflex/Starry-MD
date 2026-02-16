const utils = require('../utils');
const fs = require('fs-extra');
const config = require('../../../config');

/**
 * @type {import('../../types').Command[]}
 */
module.exports = [
    {
        name: 'vvmode',
        description: 'Set where unlocked View-Once media is sent.',
        category: 'settings',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const arg = args[0]?.toLowerCase() || "";

            if (arg === 'chat' || arg === 'general') {
                botState.settings.viewOnceMode = 'chat';
            } else if (arg === 'dm' || arg === 'user') {
                botState.settings.viewOnceMode = 'dm';
            } else if (arg === 'save' || arg === 'owner') {
                botState.settings.viewOnceMode = 'save';
            } else if (arg === 'private') {
                botState.settings.viewOnceMode = 'private';
            } else {
                return sock.sendMessage(from, {
                    text: "🔧 *VV MODE CONFIG*\n\nUsage: .vvmode <option>\n\nOptions:\n┃ *chat* - Send to group/current chat\n┃ *dm* - Send to user's private DM\n┃ *save* - Send to Owner's DM\n┃ *private* - Owner only can use .vv"
                }, { quoted: msg });
            }

            fs.writeJsonSync("./database/bot_settings.json", botState.settings);
            await sock.sendMessage(from, { text: `✅ VV Mode updated to: *${botState.settings.viewOnceMode.toUpperCase()}*` }, { quoted: msg });
        }
    },
    {
        name: 'autobio',
        description: 'Toggle automatic bio updates with system stats.',
        category: 'settings',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const arg = args[0]?.toLowerCase();

            if (arg === 'on') {
                botState.settings.autoBio = true;
            } else if (arg === 'off') {
                botState.settings.autoBio = false;
            } else {
                return sock.sendMessage(from, { text: "❌ Usage: .autobio <on/off>" }, { quoted: msg });
            }

            fs.writeJsonSync("./database/bot_settings.json", botState.settings);
            await sock.sendMessage(from, { text: `✅ Auto-Bio is now *${botState.settings.autoBio ? 'ON' : 'OFF'}*.` }, { quoted: msg });
        }
    },
    {
        name: 'vv',
        aliases: ['viewonce', 'unlock'],
        description: 'Unlock View-Once media.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const pushName = msg.pushName || "User";
            const isGroup = from.endsWith('@g.us');
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const quoted = contextInfo?.quotedMessage;
            const isOwner = utils.isOwner(sender, config);

            if (!quoted) return sock.sendMessage(from, { text: "❌ Please quote a *View-Once* message to unlock it." }, { quoted: msg });

            const voContent = quoted.viewOnceMessage?.message ||
                quoted.viewOnceMessageV2?.message ||
                quoted.viewOnceMessageV2Extension?.message;

            if (!voContent && !(quoted.imageMessage || quoted.videoMessage)) {
                return sock.sendMessage(from, { text: "❌ That is not a View-Once message." }, { quoted: msg });
            }

            const activeContent = voContent || quoted;

            if (!isOwner && botState.settings.viewOnceMode === 'private') {
                return sock.sendMessage(from, { text: "🔐 *VV Unlock is in PRIVATE mode.*\n\nRequest owner to change via `.vvmode general` to allow public access." }, { quoted: msg });
            }

            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            try {
                await sock.sendMessage(from, { react: { text: "🔐", key: msg.key } });
                const buffer = await downloadMediaMessage(
                    { message: activeContent },
                    'buffer',
                    {},
                    { reuploadRequest: sock.updateMediaMessage }
                );

                if (!buffer) throw new Error("Empty media buffer");

                let target;
                let effectiveMode = botState.settings.viewOnceMode;

                if (botState.settings.viewOnceMode === 'save') {
                    target = isOwner ? botState.ownerID : sender;
                    if (!isOwner) effectiveMode = 'dm (auto)';
                } else if (botState.settings.viewOnceMode === 'dm') {
                    target = sender;
                } else if (botState.settings.viewOnceMode === 'private') {
                    target = botState.ownerID;
                } else {
                    target = from;
                }

                if (isGroup && target === sender) {
                    if (!botState.vvRequests) botState.vvRequests = {};
                    if (!botState.vvRequests[from]) botState.vvRequests[from] = [];
                    const now = Date.now();
                    botState.vvRequests[from].push(now);
                    botState.vvRequests[from] = botState.vvRequests[from].filter(t => now - t < 300000);

                    if (botState.vvRequests[from].length > 3) {
                        return sock.sendMessage(from, {
                            text: `⚠️ *Too many VV requests in this group!*`
                        }, { quoted: msg });
                    }
                }

                const caption = `🌠 *STARRY VV UNLOCKER* 🔐\n\n_Mode: ${effectiveMode.toUpperCase()}_`;

                if (activeContent.imageMessage) {
                    await sock.sendMessage(target, { image: buffer, caption }, { quoted: msg });
                } else if (activeContent.videoMessage) {
                    await sock.sendMessage(target, { video: buffer, caption }, { quoted: msg });
                }

                if (target === botState.ownerID && !isOwner) {
                    await sock.sendMessage(from, { text: "✅ Media unlocked." }, { quoted: msg });
                } else if (target === sender && isGroup) {
                    await sock.sendMessage(from, { text: "✅ Media unlocked and sent to *your DM*." }, { quoted: msg });
                }
            } catch (err) {
                await sock.sendMessage(from, { text: `❌ Save Failed: ${err.message}` }, { quoted: msg });
            }
        }
    },
    {
        name: 'setbio',
        description: 'Update the bot\'s profile bio.',
        category: 'settings',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const newBio = args.join(' ');
            if (!newBio) return sock.sendMessage(from, { text: "❌ Usage: .setbio <text>" }, { quoted: msg });

            botState.settings.customBio = newBio;
            fs.writeJsonSync("./database/bot_settings.json", botState.settings);

            try {
                await sock.updateProfileStatus(newBio);
                await sock.sendMessage(from, { text: "✅ Bio updated and applied." }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(from, { text: "✅ Bio saved but failed to apply immediately." }, { quoted: msg });
            }
        }
    },
    {
        name: 'mode',
        description: 'Switch the bot\'s operating mode.',
        category: 'settings',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const targetMode = args[0]?.toLowerCase();
            const password = args[1];

            if (!targetMode) {
                return sock.sendMessage(from, {
                    text: `🎮 *MODE SWITCHER*\n\nUsage: .mode <public|private|sleep|goon> [password]\n\nCurrent: \${botState.mode}`
                }, { quoted: msg });
            }

            if (targetMode === 'public') {
                botState.mode = '$public';
                return sock.sendMessage(from, { text: "🟢 *MODE UPDATED:* Public." }, { quoted: msg });
            }
            if (targetMode === 'private') {
                botState.mode = '$private';
                return sock.sendMessage(from, { text: "👻 *MODE UPDATED:* Private." }, { quoted: msg });
            }
            if (targetMode === 'sleep') {
                botState.mode = '$sleep';
                return sock.sendMessage(from, { text: "💤 *MODE UPDATED:* Sleep." }, { quoted: msg });
            }
            if (targetMode === 'goon') {
                const currentPass = botState.settings.goonPassword || require('../../config').GOON_PASSWORD;
                if (password === currentPass) {
                    botState.mode = '$goon';
                    await sock.sendMessage(from, { text: "😈 *ACCESS GRANTED:* Goon Mode." }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: "❌ *DENIED:* Wrong Password." }, { quoted: msg });
                }
                return;
            }
            return sock.sendMessage(from, { text: "❌ Unknown mode." });
        }
    },
    {
        name: 'viewstatus',
        aliases: ['vs'],
        description: 'Manually view/like a user\'s status.',
        category: 'settings',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const status = require('../../utils/status');
            let targetJid;

            if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                targetJid = msg.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                targetJid = args[0].includes('@') ? args[0] : `\${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            }

            if (!targetJid) return sock.sendMessage(from, { text: "❌ Target user needed." });
            const count = await status.processSpecificUser(sock, targetJid);
            return sock.sendMessage(from, { text: `✅ Viewed \${count} statuses.` }, { quoted: msg });
        }
    },
    {
        name: 'statvip',
        aliases: ['statusvip'],
        description: 'Manage Status VIP list.',
        category: 'settings',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const status = require('../../utils/status');
            const [action, ...target] = args;

            if (action === 'list') {
                const vips = status.getVipList();
                return sock.sendMessage(from, { text: `🌟 *VIP LIST:*\n\n\${vips.join('\n')}` });
            }

            let targetJid = args[1]?.includes('@') ? args[1] : (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant);
            if (!targetJid && args[1]) targetJid = `\${args[1].replace(/[^0-9]/g, '')}@s.whatsapp.net`;

            if (!targetJid) return sock.sendMessage(from, { text: "❌ Target user needed." });

            if (action === 'add') {
                status.addVip(targetJid);
                return sock.sendMessage(from, { text: "✅ Added to VIP list." });
            } else if (action === 'del') {
                status.removeVip(targetJid);
                return sock.sendMessage(from, { text: "✅ Removed from VIP list." });
            }
        }
    }
];

