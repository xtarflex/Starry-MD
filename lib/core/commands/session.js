const utils = require('../utils');
const sessionManager = require('../session-manager');
const config = require('../../../config');

/**
 * @type {import('../../types').Command[]}
 */
module.exports = [
    {
        name: 'host',
        aliases: ['clone', 'deploy'],
        description: 'Deploy a StarryMD clone session using a pairing code.',
        category: 'session',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const pushName = msg.pushName || "User";
            const isGroup = from.endsWith('@g.us');

            if (isGroup) return sock.sendMessage(from, { text: "❌ Please use this command in DM to keep your pairing code private." }, { quoted: msg });

            let targetPhone = args[0] ? args[0].replace(/[^0-9]/g, "") : null;

            if (!targetPhone) {
                return sock.sendMessage(from, { text: "⚠️ *Missing Phone Number*\n\nPlease specify the number you want to host.\nUsage: `.host <number>`\nExample: `.host 2348012345678`" });
            }

            if (targetPhone.startsWith('0')) {
                return sock.sendMessage(from, { text: "⚠️ *Format Error*\n\nPlease use the **International Format** (e.g., 23481...) without the leading '0' or '+'.\n\nExample: `.host 2348012345678`" });
            }

            if (targetPhone.length < 10) {
                return sock.sendMessage(from, { text: "❌ Invalid phone number. Usage: `.host <number>` (e.g. .host 2349012345678)" });
            }

            const sessionId = `user_${targetPhone}`;
            const existing = sessionManager.getSession(sessionId);

            if (existing) {
                return sock.sendMessage(from, { text: "⚠️ You already have an active bot session running!" });
            }

            await sock.sendMessage(from, { text: `🚀 *Deploying Starry Clone...*\n\nTarget: +${targetPhone}\n\nPlease wait for the Pairing Code.` });

            const newSock = await sessionManager.startSession(sessionId, {
                usePairingCode: true,
                phoneNumber: targetPhone,
                owner: sender,
                onPairingCode: async (code) => {
                    await sock.sendMessage(from, { text: `🔑 *YOUR PAIRING CODE IS:*` });
                    await utils.delay(500);
                    await sock.sendMessage(from, { text: code });
                    await utils.delay(500);
                    await sock.sendMessage(from, { text: `_Enter this in WhatsApp > Linked Devices > Link with phone number_` });

                    if (config.OWNER_ID) {
                        const ownerIds = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                        const alertMsg = `🚀 *NEW CLONE DEPLOYED*\n\n👤 *User:* ${pushName} (+${targetPhone})\n🆔 *Session:* ${sessionId}\n⏰ *Time:* ${new Date().toLocaleTimeString()}`;
                        for (const ownerId of ownerIds) {
                            await sock.sendMessage(ownerId, { text: alertMsg });
                        }
                    }
                }
            });

            if (!newSock) {
                return sock.sendMessage(from, { text: "❌ Failed to start session. Check console/logs." });
            }
        }
    },
    {
        name: 'listclones',
        description: 'List all currently running sub-bot sessions.',
        category: 'session',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const clones = sessionManager.listSessions();
            if (clones.length === 0) return sock.sendMessage(from, { text: "No active clones running." });

            let text = `🤖 *ACTIVE CLONES* (${clones.length})\n\n`;
            clones.forEach((c) => {
                const uptime = ((Date.now() - c.startTime) / 60000).toFixed(1);
                text += `🆔 *${c.id}*\n👤 Owner: ${c.owner ? c.owner.split('@')[0] : 'Unknown'}\n⏰ Uptime: ${uptime} mins\n\n`;
            });
            text += `_Use .stopbot <id> to freeze or .logout <id> to delete._`;
            return sock.sendMessage(from, { text });
        }
    },
    {
        name: 'stopbot',
        aliases: ['shutdown'],
        description: 'Stop a running sub-bot session (Data is preserved).',
        category: 'session',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const pushName = msg.pushName || "User";

            const config = require('../../../config');
            const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
            const isOwner = ownerIds.some(id => sender.includes(id));

            const sessionId = `user_${sender.split('@')[0]}`;
            const targetId = (isOwner && args[0]) ? args[0] : sessionId;

            const existing = sessionManager.getSession(targetId);
            if (!existing && targetId === sessionId) {
                return sock.sendMessage(from, { text: "❌ You don't have a running bot session." });
            } else if (!existing) {
                return sock.sendMessage(from, { text: `❌ Session ${targetId} not found.` });
            }

            await sessionManager.stopSession(targetId);

            if (config.OWNER_ID && !isOwner) {
                const owners = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                for (const ownerId of owners) {
                    await sock.sendMessage(ownerId, { text: `🛑 *CLONE STOPPED*\n\nUser: ${pushName}\nID: ${targetId}` });
                }
            }
            return sock.sendMessage(from, { text: `🛑 Session ${targetId} stopped (Data preserved).` });
        }
    },
    {
        name: 'logout',
        aliases: ['delbot'],
        description: 'Log out and delete session data for a sub-bot.',
        category: 'session',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const pushName = msg.pushName || "User";

            const config = require('../../../config');
            const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
            const isOwner = ownerIds.some(id => sender.includes(id));

            const sessionId = `user_${sender.split('@')[0]}`;
            const targetId = (isOwner && args[0]) ? args[0] : sessionId;

            if (!isOwner && targetId !== sessionId) return;

            const deleted = await sessionManager.deleteSession(targetId);

            if (deleted) {
                await sock.sendMessage(from, { text: `🗑️ *Session Deleted*\n\n${targetId} has been logged out and data removed.` });
                if (config.OWNER_ID && !isOwner) {
                    const owners = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                    for (const ownerId of owners) {
                        await sock.sendMessage(ownerId, { text: `🗑️ *CLONE DELETED*\n\nUser: ${pushName}\nID: ${targetId}` });
                    }
                }
            } else {
                return sock.sendMessage(from, { text: `❌ Could not find/delete session data for ${targetId}.` });
            }
        }
    }
];
