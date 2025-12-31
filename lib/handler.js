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

    // --- 3. THE HANDSHAKE PROTOCOL (Anti-Ban/Stranger Danger) ---
    if (!isMe && !isGroup && !isTool && !isSys && botState.mode !== '$sleep') {
        const isStranger = !botState.contacts[sender];

        // Stage 1: Initial DM from Stranger
        if (isStranger && !botState.handshakeWaiting.has(sender)) {
            utils.log("GATE", `Unknown Presence: ${pushName} (${sender}). Initiating Handshake.`);
            await utils.delay(2000); // Anti-speed
            await sock.sendPresenceUpdate('composing', from);
            await utils.delay(1000);
            await sock.sendMessage(from, { text: `Hi ${pushName}, what's up? 👋` });
            botState.handshakeWaiting.add(sender);
            return;
        }

        // Stage 2: Second message from Stranger (The Hook)
        if (botState.handshakeWaiting.has(sender)) {
            utils.log("GATE", `Stranger ${pushName} responded. Completing Handshake.`);
            botState.handshakeWaiting.delete(sender);

            // Triple Safety: Add to temp contacts to stop loop
            botState.contacts[sender] = { name: pushName, addedAt: Date.now(), sync: false };
            fs.writeJsonSync("./database/contacts.json", botState.contacts);

            await utils.delay(3000);
            const vcard = require('./vcard').getOwnerVCard(config.OWNER_NAME || "Starry Owner", config.OWNER_ID);

            await sock.sendPresenceUpdate('composing', from);
            await utils.delay(1500);
            await sock.sendMessage(from, {
                contacts: {
                    displayName: config.OWNER_NAME || "Starry Owner",
                    contacts: [{ vcard }]
                }
            });
            await sock.sendMessage(from, { text: "Could you please save my contact? 🌠 This ensures you get my status updates!" });
            return;
        }
    }

    if (isTool || isSys) {
        const currentPrefix = isTool ? pTool : pSys;
        const cmd = body.slice(currentPrefix.length).trim().split(/\s+/)[0].toLowerCase();
        const args = body.slice(currentPrefix.length + cmd.length).trim();

        // 1. TOOL PREFIX COMMANDS (.)
        if (isTool) {
            // Public Command: Ping
            if (cmd === 'ping') {
                // ... (ping logic remains same)
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

            // Public Command: Alive (God Tier)
            if (cmd === 'alive') {
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const bannerPath = require('path').join(__dirname, '../database/banner.png');

                await sock.sendMessage(from, { react: { text: "🛸", key: msg.key } });
                await sock.sendMessage(from, {
                    image: fs.existsSync(bannerPath) ? { url: bannerPath } : { url: 'https://i.imgur.com/TyCSG9A.jpeg' },
                    caption: `*STARRY MD v2.0 STATUS*\n\n🌌 *Systems:* Operational\n🔋 *Battery:* 98% (Simulated)\n📡 *Mode:* ${botState.mode.toUpperCase()}\n⌛ *Uptime:* ${hours}h ${minutes}m\n\n_"Ready for orders, Commander."_`,
                    contextInfo: {
                        externalAdReply: {
                            title: "Starry MD: Neural Link",
                            body: "Heartbeat: ACTIVE",
                            thumbnailUrl: "https://i.imgur.com/TyCSG9A.jpeg",
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
                return;
            }

            // Public Command: AI (Fake-Out Loading)
            if (cmd === 'ai') {
                const prompt = body.slice(pTool.length + 2).trim();
                if (!prompt) return sock.sendMessage(from, { text: "❌ Please provide a prompt. Example: `.ai Why is the sky blue?`" }, { quoted: msg });

                utils.log("AI", `Request from ${pushName}: "${prompt.slice(0, 30)}..."`);
                const { key } = await sock.sendMessage(from, { text: "☄️ Connecting to Starlink..." }, { quoted: msg });

                await utils.delay(1000);
                await sock.sendMessage(from, { text: "🧠 Thinking...", edit: key });

                const ai = require('./ai');
                const response = await ai.generateContent(prompt);

                await sock.sendMessage(from, { text: response, edit: key });
                utils.log("AI", `Response sent to ${pushName}.`);
                return;
            }

            // Command: .myvcard (Public Friendly)
            if (cmd === 'myvcard' || cmd === 'vcard') {
                if (!isOwner && botState.mode === '$private') return;

                const vcardUtils = require('./vcard');
                const vcard = vcardUtils.create(pushName, sender);

                await utils.delay(1000);
                await sock.sendPresenceUpdate('composing', from);
                await sock.sendMessage(from, {
                    contacts: {
                        displayName: pushName,
                        contacts: [{ vcard }]
                    }
                }, { quoted: msg });
                return;
            }

            // Command: .sv / .save (Owner Only + DM Only)
            if ((cmd === 'sv' || cmd === 'save') && isOwner) {
                if (isGroup) {
                    await sock.sendMessage(from, { text: "❌ Saving is restricted to DMs only for privacy." }, { quoted: msg });
                    return;
                }

                const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const targetJid = msg.message.extendedTextMessage?.contextInfo?.participant || sender;
                const saveName = args || (quoted ? (msg.message.extendedTextMessage.contextInfo.pushName || "Saved User") : pushName);

                const vcardUtils = require('./vcard');
                const vcard = vcardUtils.create(saveName, targetJid);

                await sock.sendMessage(from, {
                    contacts: {
                        displayName: saveName,
                        contacts: [{ vcard }]
                    }
                }, { quoted: msg });

                // Persistence
                botState.contacts[targetJid] = { name: saveName, addedAt: Date.now(), sync: true };
                fs.writeJsonSync("./database/contacts.json", botState.contacts);
                return;
            }

            // Command: .botvcard
            if (cmd === 'botvcard' && isOwner) {
                const vcard = require('./vcard').getOwnerVCard(config.OWNER_NAME || "Starry Owner", config.OWNER_ID);
                await sock.sendMessage(from, {
                    contacts: {
                        displayName: config.OWNER_NAME || "Starry Owner",
                        contacts: [{ vcard }]
                    }
                }, { quoted: msg });
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

                if (cmd === 'setbio') {
                    const newBio = body.slice(pTool.length + 6).trim();
                    if (!newBio) return sock.sendMessage(from, { text: "❌ Usage: .setbio <your text>" }, { quoted: msg });

                    botState.settings.customBio = newBio;
                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, { text: "✅ Custom Bio set and saved." }, { quoted: msg });
                    return;
                }

                if (cmd === 'autobio') {
                    const arg = body.slice(pTool.length + 8).trim().toLowerCase();
                    if (arg === 'on') {
                        botState.settings.autoBio = true;
                    } else if (arg === 'off') {
                        botState.settings.autoBio = false;
                    } else {
                        return sock.sendMessage(from, { text: "❌ Usage: .autobio <on/off>" }, { quoted: msg });
                    }

                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, { text: `✅ Auto-Bio is now *${botState.settings.autoBio ? 'ON' : 'OFF'}*.` }, { quoted: msg });
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
