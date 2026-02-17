import { freemem, totalmem, cpus, platform } from 'os';
import fs from 'fs-extra';
const { existsSync, readFileSync, writeJsonSync } = fs;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { createRequire } from 'module';
import { inspect } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


/**
 * @type {import('../../types').Command[]}
 */
export default [
    {
        name: 'runtime',
        aliases: ['uptime'],
        description: 'Show bot runtime and system uptime.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args) => {
            const up = process.uptime();
            const h = Math.floor(up / 3600);
            const m = Math.floor((up % 3600) / 60);
            const s = Math.floor(up % 60);
            return sock.sendMessage(msg.key.remoteJid, { text: `🚀 *Bot Runtime:* ${h}h ${m}m ${s}s` }, { quoted: msg });
        }
    },
    {
        name: 'sys',
        aliases: ['system'],
        description: 'Show detailed system hardware info.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock) => {
            const free = (freemem() / 1024 / 1024 / 1024).toFixed(2);
            const total = (totalmem() / 1024 / 1024 / 1024).toFixed(2);
            const cpu = cpus()[0].model;
            return sock.sendMessage(msg.key.remoteJid, { text: `💻 *SYSTEM INFO*\n\n🧠 RAM: ${free}GB / ${total}GB\n💿 CPU: ${cpu}\n⚙️ Platform: ${platform()}` }, { quoted: msg });
        }
    },
    {
        name: 'db',
        aliases: ['database'],
        description: 'Show database statistics.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const stats = {
                contacts: Object.keys(botState.contacts).length,
                groups: Object.keys(botState.groupMetadata || {}).length,
                banned: botState.bannedChats.length
            };
            return sock.sendMessage(msg.key.remoteJid, { text: `📂 *DATABASE STATS*\n\n👥 Contacts: ${stats.contacts}\n🏘️ Groups: ${stats.groups}\n🚫 Banned: ${stats.banned}` }, { quoted: msg });
        }
    },
    {
        name: 'logs',
        description: 'Fetch the latest bot logs.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args) => {
            const logPath = join(__dirname, '../../../database/logs.txt');
            if (!existsSync(logPath)) return sock.sendMessage(msg.key.remoteJid, { text: "No logs found." });
            const logs = readFileSync(logPath, 'utf8').split('\n').slice(-50).join('\n');
            return sock.sendMessage(msg.key.remoteJid, { text: `📋 *LATEST LOGS*\n\n\`\`\`\n${logs}\n\`\`\`` }, { quoted: msg });
        }
    },
    {
        name: 'eval',
        aliases: ['ev', 'execute'],
        description: 'Execute JavaScript code directly.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const argsStr = args.join(' ');
            if (!argsStr) return sock.sendMessage(from, { text: "❌ Code required!" }, { quoted: msg });

            // eslint-disable-next-line no-unused-vars
            const require = createRequire(import.meta.url);

            try {
                let evaled = await (async () => {
                    return eval(argsStr);
                })();

                if (typeof evaled !== 'string') evaled = inspect(evaled);
                return sock.sendMessage(from, { text: `✅ *EVAL OUTPUT*\n\n\`\`\`javascript\n${evaled}\n\`\`\`` }, { quoted: msg });
            } catch (err) {
                return sock.sendMessage(from, { text: `❌ *EVAL ERROR*\n\n\`\`\`javascript\n${err.message}\n\`\`\`` }, { quoted: msg });
            }
        }
    },
    {
        name: 'pullreq',
        aliases: ['updatebot'],
        description: 'Pull latest changes from GitHub.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args) => {
            const from = msg.key.remoteJid;
            await sock.sendMessage(from, { text: "📥 Fetching updates..." });
            exec('git pull', (err, stdout) => {
                if (err) return sock.sendMessage(from, { text: `❌ Error: ${err.message}` });
                return sock.sendMessage(from, { text: `✅ *Updated:*\n\n${stdout}` });
            });
        }
    },
    {
        name: 'broadcast',
        aliases: ['bc'],
        description: 'Send a message to all groups.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const text = args.join(' ');
            if (!text) return sock.sendMessage(from, { text: "❌ Message required!" });
            const groups = Object.keys(botState.groupMetadata || {});
            await sock.sendMessage(from, { text: `📡 Broadcasting to ${groups.length} groups...` });
            for (const gid of groups) {
                try {
                    await sock.sendMessage(gid, { text: `📢 *BROADCAST*\n\n${text}` });
                } catch (e) { }
            }
        }
    },
    {
        name: 'ban',
        description: 'Ban a user from using the bot.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            let target = args[0]?.includes('@') ? args[0] : (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant);
            if (!target) return sock.sendMessage(from, { text: "❌ Target user needed." });

            if (!botState.bannedUsers) botState.bannedUsers = [];
            if (!botState.bannedUsers.includes(target)) {
                botState.bannedUsers.push(target);
                writeJsonSync("./database/banned_users.json", botState.bannedUsers);
            }
            return sock.sendMessage(from, { text: "✅ User banned." });
        }
    },
    {
        name: 'unban',
        description: 'Unban a user.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            let target = args[0]?.includes('@') ? args[0] : (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.participant);
            if (!target) return sock.sendMessage(from, { text: "❌ Target user needed." });

            if (botState.bannedUsers) {
                botState.bannedUsers = botState.bannedUsers.filter(u => u !== target);
                writeJsonSync("./database/banned_users.json", botState.bannedUsers);
            }
            return sock.sendMessage(from, { text: "✅ User unbanned." });
        }
    },
    {
        name: 'block',
        description: 'Block and blacklist a user.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const userToBlock = contextInfo?.mentionedJid?.[0] || contextInfo?.participant || from;

            await sock.updateBlockStatus(userToBlock, 'block');
            if (!botState.bannedChats.includes(userToBlock)) {
                botState.bannedChats.push(userToBlock);
                writeJsonSync("./database/banned_chats.json", botState.bannedChats);
            }
            return sock.sendMessage(from, { text: "🚫 User blocked and blacklisted." });
        }
    },
    {
        name: 'unblock',
        description: 'Unblock a user.',
        category: 'owner',
        ownerOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const userToUnblock = contextInfo?.mentionedJid?.[0] || contextInfo?.participant || from;

            await sock.updateBlockStatus(userToUnblock, 'unblock');
            botState.bannedChats = botState.bannedChats.filter(id => id !== userToUnblock);
            writeJsonSync("./database/banned_chats.json", botState.bannedChats);
            return sock.sendMessage(from, { text: "✅ User unblocked." });
        }
    }
];
