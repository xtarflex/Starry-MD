const utils = require('../utils');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../../config');

/**
 * @type {import('../../types').Command[]}
 */
module.exports = [
    {
        name: 'alive',
        description: 'Check if the bot is online and see system stats.',
        category: 'general',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const uptime = process.uptime();
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            const bannerPath = path.join(__dirname, '../../database/banner.png');

            await sock.sendMessage(from, { react: { text: "🛸", key: msg.key } });

            // Get system stats
            const os = require('os');
            const totalRAM = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
            const freeRAM = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
            const usedRAM = (totalRAM - freeRAM).toFixed(2);
            const ramPercent = ((usedRAM / totalRAM) * 100).toFixed(1);

            // Platform info
            const platform = os.platform();
            const platformEmoji = platform === 'win32' ? '🪟' : platform === 'linux' ? '🐧' : platform === 'darwin' ? '🍎' : '💻';

            // Bot stats
            const contactCount = Object.keys(botState.contacts).length;
            const mode = botState.mode.toUpperCase();
            const modeEmoji = mode === '$PUBLIC' ? '🌍' : mode === '$PRIVATE' ? '🔒' : '😴';

            const aliveCaption = `
            ╔═══════════════════════════════╗
            ║   🤖 STARRY MD 2.0 - ALIVE    ║
            ╚═══════════════════════════════╝

            ✨ *Bot Status:* ONLINE
            ⚡ *Systems:* Operational

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            *SYSTEM STATS*

            ⏰ *Uptime:* \${hours}h \${minutes}m \${seconds}s
            🧠 *RAM Usage:* \${usedRAM}GB / \${totalRAM}GB (\${ramPercent}%)
            \${platformEmoji} *Platform:* \${platform.toUpperCase()}
            📱 *Contacts:* \${contactCount} synced
            \${modeEmoji} *Mode:* \${mode}

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            👨‍💻 *OWNER INFO*

            📛 *Name:* \${config.OWNER_NAME || 'Starry Xander'}
            📞 *Number:* \${config.OWNER_NUMBER || 'Not Set'}

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            🌟 *FEATURES*
            ✅ AI Chat & Image Generation
            ✅ Sticker Creation & Stealing
            ✅ Status Auto-View & Save
            ✅ Group Management
            ✅ Anti-Delete & View-Once

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            > _"Ready for orders, Commander."_

            🔗 *Commands:* Type .menu
            📚 *Help:* Type .help
            `.trim();

            if (fs.existsSync(bannerPath)) {
                await sock.sendMessage(from, {
                    image: { url: bannerPath },
                    caption: aliveCaption
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    text: aliveCaption
                }, { quoted: msg });
            }
        }
    },
    {
        name: 'save',
        aliases: ['sv'],
        description: 'Generate a VCard for a user to save them to your contacts.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const isGroup = from.endsWith('@g.us');
            const pushName = msg.pushName || "User";
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const quoted = contextInfo?.quotedMessage;
            const mentionedJid = contextInfo?.mentionedJid?.[0];
            const argsStr = args.join(' ');

            if (!mentionedJid && !quoted && !argsStr) {
                return sock.sendMessage(from, {
                    text: "⚠️ *Missing Target*\n\nReply to a message, mention a user, or type a number to save.\n\n_Use .myvcard to save yourself._"
                }, { quoted: msg });
            }

            let targetJid = sender;
            let saveName = pushName;

            if (mentionedJid) {
                targetJid = utils.decodeJid(mentionedJid);
                const contact = botState.contacts[targetJid];
                saveName = contact?.name || argsStr.replace('@', '').trim() || "User";
            } else if (quoted) {
                targetJid = utils.decodeJid(contextInfo.participant || sender);
                if (botState.contacts[targetJid]) {
                    saveName = botState.contacts[targetJid].name;
                } else if (targetJid !== sender) {
                    saveName = "Unknown";
                }
            } else if (argsStr) {
                saveName = argsStr;
            }

            let groupMeta = null;
            if (isGroup) {
                try {
                    groupMeta = botState.groupMetadata[from] || await sock.groupMetadata(from);
                    botState.groupMetadata[from] = groupMeta;
                } catch (e) {
                    utils.log("WARN", "Failed to fetch group metadata for LID resolution.");
                }
            }

            const resolvedTargetJid = await utils.resolvePhoneNumber(targetJid, botState, sock, groupMeta);

            if (saveName === "User" || saveName === argsStr || saveName === "Unknown") {
                const nameFromRes = utils.resolveName(resolvedTargetJid, botState, groupMeta);
                const nameFromOrig = utils.resolveName(targetJid, botState, groupMeta);
                if (nameFromRes || nameFromOrig) {
                    saveName = nameFromRes || nameFromOrig;
                }
            }

            const vcardUtils = require('../../services/vcard');
            const vcard = vcardUtils.create(saveName, resolvedTargetJid);

            await sock.sendMessage(from, {
                contacts: {
                    displayName: saveName,
                    contacts: [{ vcard }]
                }
            }, { quoted: msg });

            botState.contacts[targetJid] = { name: saveName, addedAt: Date.now(), sync: true };
            fs.writeJsonSync("./database/contacts.json", botState.contacts);

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            utils.log("CONTACT", `VCard created/saved for \${saveName}`);
        }
    },
    {
        name: 'myvcard',
        aliases: ['vcard'],
        description: 'Generate your own VCard.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const pushName = msg.pushName || "User";

            // Resolve LID to PN for the sender
            const resolvedSender = await utils.resolvePhoneNumber(sender, botState, sock);

            const vcardUtils = require('../../services/vcard');
            const vcard = vcardUtils.create(pushName, resolvedSender);

            await sock.sendMessage(from, {
                contacts: {
                    displayName: pushName,
                    contacts: [{ vcard }]
                }
            }, { quoted: msg });
        }
    },
    {
        name: 'botvcard',
        description: 'See the bot owner\'s VCard.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const vcard = require('../../services/vcard').getOwnerVCard(config.OWNER_NAME || "Starry Owner", config.OWNER_ID);
            await sock.sendMessage(from, {
                contacts: {
                    displayName: config.OWNER_NAME || "Starry Owner",
                    contacts: [{ vcard }]
                }
            }, { quoted: msg });
        }
    },
    {
        name: 'menu',
        aliases: ['help', 'list', 'commands'],
        description: 'Display the bot\'s command menu.',
        category: 'general',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const { getMenu } = require('../menu');
            await utils.simulateTyping(sock, from, 1000);

            if (args[0] === 'guide') {
                const getHelp = require('../help');
                return sock.sendMessage(from, { text: utils.autoReadMore(getHelp('all')) }, { quoted: msg });
            }

            const menuText = getMenu(botState.mode);
            const bannerPath = path.join(__dirname, '../../database/banner.png');

            if (fs.existsSync(bannerPath)) {
                await sock.sendMessage(from, {
                    image: { url: bannerPath },
                    caption: utils.autoReadMore(menuText)
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: utils.autoReadMore(menuText) }, { quoted: msg });
            }
        }
    },
    {
        name: 'tempmail',
        aliases: ['tm', 'mail'],
        description: 'Get a temporary email address or check its inbox.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const tempMail = require('../../services/temp-mail');
            return tempMail.handleTempMail(msg, sock, botState, args);
        }
    },
    {
        name: 'tempsms',
        aliases: ['sms'],
        description: 'Get a temporary phone number for SMS verification.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const tempSms = require('../../services/temp-sms');
            return tempSms.handleTempSms(msg, sock, botState, args);
        }
    }
];


