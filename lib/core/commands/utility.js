import { decodeJid, log, resolvePhoneNumber, resolveName, simulateTyping, autoReadMore } from '../utils.js';
import { existsSync, writeJsonSync } from 'fs-extra';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OWNER_NAME, OWNER_ID } from '../../../config.js';
import os from 'os';
import vcardUtils from '../utils/vcard.js';
import menuModule from '../menu.js';
import helpModule from '../help.js';
import tempMail from '../../services/temp-mail.js';
import tempSms from '../../services/temp-sms.js';
import aiFeatures from '../../services/ai-features.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @type {import('../../types').Command[]}
 */
export default [
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
            const bannerPath = join(__dirname, '../../database/banner.png');

            await sock.sendMessage(from, { react: { text: "🛸", key: msg.key } });

            // Get system stats
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

            ⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s
            🧠 *RAM Usage:* ${usedRAM}GB / ${totalRAM}GB (${ramPercent}%)
            ${platformEmoji} *Platform:* ${platform.toUpperCase()}
            📱 *Contacts:* ${contactCount} synced
            ${modeEmoji} *Mode:* ${mode}

            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            👨‍💻 *OWNER INFO*

            📛 *Name:* ${OWNER_NAME || 'Starry Xander'}
            📞 *Number:* ${OWNER_ID || 'Not Set'}

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

            if (existsSync(bannerPath)) {
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
            const sender = decodeJid(msg.key.participant || from);
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
                targetJid = decodeJid(mentionedJid);
                const contact = botState.contacts[targetJid];
                saveName = contact?.name || argsStr.replace('@', '').trim() || "User";
            } else if (quoted) {
                targetJid = decodeJid(contextInfo.participant || sender);
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
                    log("WARN", "Failed to fetch group metadata for LID resolution.");
                }
            }

            const resolvedTargetJid = await resolvePhoneNumber(targetJid, botState, sock, groupMeta);

            if (saveName === "User" || saveName === argsStr || saveName === "Unknown") {
                const nameFromRes = resolveName(resolvedTargetJid, botState, groupMeta);
                const nameFromOrig = resolveName(targetJid, botState, groupMeta);
                if (nameFromRes || nameFromOrig) {
                    saveName = nameFromRes || nameFromOrig;
                }
            }

            const vcard = vcardUtils.create(saveName, resolvedTargetJid);

            await sock.sendMessage(from, {
                contacts: {
                    displayName: saveName,
                    contacts: [{ vcard }]
                }
            }, { quoted: msg });

            botState.contacts[targetJid] = { name: saveName, addedAt: Date.now(), sync: true };
            writeJsonSync("./database/contacts.json", botState.contacts);

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
            log("CONTACT", `VCard created/saved for ${saveName}`);
        }
    },
    {
        name: 'myvcard',
        aliases: ['vcard'],
        description: 'Generate your own VCard.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = decodeJid(msg.key.participant || from);
            const pushName = msg.pushName || "User";

            // Resolve LID to PN for the sender
            const resolvedSender = await resolvePhoneNumber(sender, botState, sock);

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
            const vcard = vcardUtils.getOwnerVCard(OWNER_NAME || "Starry Owner", OWNER_ID);
            await sock.sendMessage(from, {
                contacts: {
                    displayName: OWNER_NAME || "Starry Owner",
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
            const { getMenu } = menuModule;

            // Check if it's a question (dynamic help)
            const argsStr = args.join(' ');
            const isQuestion = args && (
                argsStr.includes('?') ||
                argsStr.includes('how') ||
                argsStr.includes('what') ||
                argsStr.includes('why') ||
                args.length > 2
            );

            if (isQuestion) {
                // Use AI-powered dynamic help
                return aiFeatures.handleDynamicHelp(msg, sock, botState, argsStr);
            }

            await simulateTyping(sock, from, 1000);

            if (args[0] === 'guide') {
                const getHelp = helpModule;
                return sock.sendMessage(from, { text: autoReadMore(getHelp('all')) }, { quoted: msg });
            }
            if (args[0] && !isQuestion) {
                const getHelp = helpModule;
                return sock.sendMessage(from, { text: autoReadMore(getHelp(args[0])) }, { quoted: msg });
            }

            const menuText = getMenu(botState.mode);
            const bannerPath = join(__dirname, '../../database/banner.png');

            if (existsSync(bannerPath)) {
                await sock.sendMessage(from, {
                    image: { url: bannerPath },
                    caption: autoReadMore(menuText)
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: autoReadMore(menuText) }, { quoted: msg });
            }
        }
    },
    {
        name: 'tempmail',
        aliases: ['tm', 'mail'],
        description: 'Get a temporary email address or check its inbox.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            return tempMail.handleTempMail(msg, sock, botState, args);
        }
    },
    {
        name: 'tempsms',
        aliases: ['sms'],
        description: 'Get a temporary phone number for SMS verification.',
        category: 'utility',
        execute: async (msg, sock, args, botState) => {
            return tempSms.handleTempSms(msg, sock, botState, args);
        }
    }
];
