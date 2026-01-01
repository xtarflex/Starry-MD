const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const utils = require('./utils');
const getMenu = require('./menu');
const status = require('./status');

/**
 * Message Handler 2.0 (Neural Link)
 */
module.exports = async (msg, sock, botState) => {
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

    // Bot's JID for mention detection
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isMentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botJid) ||
        body.toLowerCase().includes('@' + sock.user.id.split(':')[0]) ||
        body.toLowerCase().includes('@starry');

    // --- 1. MINIMAL MONITORING ---
    if (!isMe) {
        utils.log("INFLOW", `Msg from ${pushName} (${sender}): "${body.slice(0, 20)}..."`);
    }

    // DEBUG: Log view-once messages for structure analysis (including from owner)
    if (msg.message.viewOnceMessage || msg.message.viewOnceMessageV2 || msg.message.viewOnceMessageV2Extension) {
        utils.log("DEBUG", `View-Once detected from ${isMe ? 'OWNER' : pushName}`);
        utils.log("DEBUG", `Message keys: ${Object.keys(msg.message).join(', ')}`);
        if (msg.message.viewOnceMessage) {
            utils.log("DEBUG", `viewOnceMessage keys: ${Object.keys(msg.message.viewOnceMessage).join(', ')}`);
        }
        if (msg.message.viewOnceMessageV2) {
            utils.log("DEBUG", `viewOnceMessageV2 keys: ${Object.keys(msg.message.viewOnceMessageV2).join(', ')}`);
        }
    }

    // --- 2. SURVIVAL COMMANDS ---
    const pTool = config.PREFIX_TOOL || '.';
    const pSys = config.PREFIX_SYSTEM || '$';

    const isTool = body.startsWith(pTool);
    const isSys = body.startsWith(pSys);

    // --- 3. THE HANDSHAKE PROTOCOL (Anti-Ban/Stranger Danger) ---
    // Ignore status updates, newsletters, group messages, and existing bot commands
    const isNewsletter = from.endsWith('@newsletter');
    const isStatus = from === 'status@broadcast';

    // --- 3. STATUS AUTO-SAVE ---
    if (isStatus && !isMe) {
        // Track status posters
        if (!botState.statusPosters) botState.statusPosters = {};
        const posterJid = msg.key.participant;

        // Only track if we have a valid participant ID
        if (posterJid) {
            const posterName = botState.contacts[posterJid]?.name || pushName;

            if (!botState.statusPosters[posterJid]) {
                botState.statusPosters[posterJid] = { name: posterName, count: 0, lastPosted: null };
            }

            botState.statusPosters[posterJid].count++;
            botState.statusPosters[posterJid].lastPosted = new Date().toISOString();
            botState.statusPosters[posterJid].name = posterName; // Update name

            // Notify owner in Saved Messages about new status poster
            const isFirstPost = botState.statusPosters[posterJid].count === 1;
            const settings = status.getSettings();
            // Default to true if undefined
            const notifyEnabled = settings.statusNotify !== false;

            if (isFirstPost && config.OWNER_ID && notifyEnabled) { // Check notify setting
                try {
                    await sock.sendMessage(config.OWNER_ID + '@s.whatsapp.net', {
                        text: `🆕 *NEW STATUS POSTER*\n\n👤 ${posterName}\n📱 ${posterJid.split('@')[0]}\n\n_Just posted their first status!_\n_Reply .vs to view immediately_`
                    });
                } catch (e) {
                    utils.log("WARN", `Failed to notify owner of new poster: ${e.message}`);
                }
            }
        }

        await status.saveStatus(msg, sock);
        return;
    }

    // --- 4. AUTO-REACTION PROTOCOL (Keyword Detection) ---
    if (!isMe && !isNewsletter && botState.mode !== '$sleep' && body) {
        // Respect $private mode: shh reaction for non-owner, then skip
        if (botState.mode === '$private' && !isOwner) {
            await sock.sendMessage(from, { react: { text: "🤫", key: msg.key } });
            // Auto-remove shh after 3 seconds
            setTimeout(async () => {
                try {
                    await sock.sendMessage(from, { react: { text: "", key: msg.key } });
                } catch (e) { }
            }, 3000);
            return;
        }

        const words = body.toLowerCase().split(/\s+/);
        const fullText = body.toLowerCase();

        // New format: emoji -> [keywords array]
        for (const [emoji, keywords] of Object.entries(botState.reactions)) {
            let matched = false;
            for (const keyword of keywords) {
                // Use word boundary regex for single words, includes for phrases
                const isPhrase = keyword.includes(' ');
                let isMatch = false;

                if (isPhrase) {
                    // For phrases like "good morning", use includes
                    isMatch = fullText.includes(keyword.toLowerCase());
                } else {
                    // For single words, use word boundary regex to avoid partial matches
                    const wordRegex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
                    isMatch = wordRegex.test(fullText);
                }

                if (isMatch) {
                    const chatCooldownKey = `react_${from}`;
                    if (utils.canProcess(chatCooldownKey, botState.cooldowns)) {
                        await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
                        utils.log("REACT", `Triggered "${emoji}" for keyword "${keyword}" in ${from}`);
                        matched = true;
                        break; // One reaction per message max
                    }
                }
            }
            if (matched) break; // Stop checking other emojis
        }
    }

    if (!isMe && !isGroup && !isTool && !isSys && botState.mode !== '$sleep' && !isStatus && !isNewsletter) {
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

    if (isTool || isSys || isMentioned) {
        const currentPrefix = isSys ? pSys : pTool; // Default to pTool for mentions
        const isCmd = isTool || isSys;

        const cmd = isCmd ? body.slice(currentPrefix.length).trim().split(/\s+/)[0].toLowerCase() : "";
        const args = isCmd ? body.slice(currentPrefix.length + cmd.length).trim() : body.trim();

        // --- 4. THE GUARDIAN PROTOCOL (Security & Mode Enforcement) ---
        if (isCmd && !isOwner) {
            // 1. Sleep Mode Enforcement
            if (botState.mode === '$sleep') return;

            // 2. Private Mode Enforcement - Shh reaction
            if (botState.mode === '$private' && !isOwner) {
                await sock.sendMessage(from, { react: { text: "🤫", key: msg.key } });
                setTimeout(async () => {
                    try { await sock.sendMessage(from, { react: { text: "", key: msg.key } }); } catch (e) { }
                }, 3000);
                return;
            }

            // 3. Global Rate Limiting (The Shield)
            if (!utils.canProcess(sender, botState.cooldowns)) {
                await sock.sendMessage(from, { react: { text: "❄️", key: msg.key } });
                // Auto-remove ice reaction after 3 seconds
                setTimeout(async () => {
                    try {
                        await sock.sendMessage(from, { react: { text: "", key: msg.key } });
                    } catch (e) { }
                }, 3000);
                return;
            }
        }

        // --- 5. COMING SOON INTERCEPTOR ---
        const comingSoonCommands = []; // All tools are now being unleashed or have placeholders
        if (comingSoonCommands.includes(cmd)) {
            await sock.sendMessage(from, { text: `⏳ *${cmd.toUpperCase()}* protocol is currently in development.` }, { quoted: msg });
            return;
        }

        // --- 5. NEURAL AI & VISION (Global & Command Tiers) ---
        const aiPersonas = ['ai', 'rude', 'tech', 'uwu', 'genz', 'mom', 'pirate'];
        const shouldTriggerAI = aiPersonas.includes(cmd) || isMentioned;

        if (shouldTriggerAI) {
            // Privacy Check for mentions
            if (isMentioned && !isCmd) {
                if (botState.mode === '$private' && !isOwner) return;
                if (botState.mode === '$sleep') return;
            }

            const persona = isCmd && aiPersonas.includes(cmd) && cmd !== 'ai' ? cmd : 'default';
            const promptArr = isMentioned && !isCmd ? body.replace(/@\d+|@starry/gi, '').trim() : args;
            const prompt = Array.isArray(promptArr) ? promptArr.join(' ') : promptArr;

            if (!prompt && !isMentioned) return sock.sendMessage(from, { text: `❌ Please provide a prompt. Example: \`${currentPrefix}${cmd} Why is the sky blue?\`` }, { quoted: msg });
            if (!prompt && isMentioned) return; // Silent if just a tag with no text

            utils.log("AI", `[${persona.toUpperCase()}] Request from ${pushName}: "${prompt.slice(0, 30)}..."`);
            const { key } = await sock.sendMessage(from, { text: "☄️ Connecting to Starlink..." }, { quoted: msg });

            await utils.delay(1000);
            await sock.sendMessage(from, { text: "🧠 Thinking...", edit: key });

            // Context Memory Management
            if (!botState.memory[from]) botState.memory[from] = [];
            const history = botState.memory[from];

            const ai = require('./ai');
            const response = await ai.generateContent(prompt, persona, history);

            await sock.sendMessage(from, { text: response, edit: key });

            // Update History (Rolling 5 interactions)
            history.push({ role: 'user', parts: [{ text: prompt }] });
            history.push({ role: 'model', parts: [{ text: response }] });
            if (history.length > 10) history.splice(0, 2); // Keep last 5 pairs

            utils.log("AI", `Response sent to ${pushName}.`);
            return;
        }

        // Public Command: AI Image (Imagine)
        if (cmd === 'imagine' || cmd === 'draw') {
            const promptArr = args || "";
            const prompt = Array.isArray(promptArr) ? promptArr.join(' ') : promptArr;

            if (!prompt) return sock.sendMessage(from, { text: `❌ Please provide a prompt. Example: \`${currentPrefix}${cmd} a futuristic city in neon blue\`` }, { quoted: msg });

            utils.log("AI", `[IMAGE] Request from ${pushName}: "${prompt.slice(0, 30)}..."`);
            await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });

            const { key } = await sock.sendMessage(from, { text: "🌌 *Generating Cosmic Vision...*" }, { quoted: msg });

            const seed = Math.floor(Math.random() * 10000);
            const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;

            await sock.sendMessage(from, {
                image: { url: imageUrl },
                caption: `🌠 *STARRY IMAGINE*\n\n*Prompt:* _${prompt}_\n*Model:* _Pollinations Flux_`,
            }, { quoted: msg });

            // Finalize loading message
            await sock.sendMessage(from, { text: "✅ Vision Manifested.", edit: key });
            utils.log("AI", `Image sent to ${pushName}.`);
            return;
        }

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

            // Public Command: Sticker (Media Forge)
            if (cmd === 'sticker' || cmd === 's') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                const quoted = contextInfo?.quotedMessage;
                const messageToDownload = quoted || msg.message;

                const isImage = messageToDownload.imageMessage;
                const isVideo = messageToDownload.videoMessage;

                if (!isImage && !isVideo) {
                    return sock.sendMessage(from, { text: "❌ Please quote or send an *Image* or *Video* to create a sticker!" }, { quoted: msg });
                }

                await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });
                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                const { exec } = require('child_process');
                const fs = require('fs-extra');
                const path = require('path');

                try {
                    const buffer = await downloadMediaMessage(
                        { message: messageToDownload },
                        'buffer',
                        {},
                        { reuploadRequest: sock.updateMediaMessage }
                    );

                    // Create temp files
                    const tempDir = path.join(__dirname, '../temp');
                    await fs.ensureDir(tempDir);
                    const inputFile = path.join(tempDir, `input_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`);
                    const outputFile = path.join(tempDir, `sticker_${Date.now()}.webp`);

                    // Save buffer to temp file
                    await fs.writeFile(inputFile, buffer);

                    // Metadata Thief: Strip original metadata and add bot's metadata
                    const botMetadata = `-metadata author="Starry MD 2.0" -metadata title="Starry Sticker" -metadata comment="Created by Starry MD"`;

                    // Convert to WebP using ffmpeg with metadata replacement
                    const ffmpegCmd = isVideo
                        ? `ffmpeg -i "${inputFile}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15" -lossless 0 -compression_level 3 -q:v 50 -loop 0 -preset default -an -vsync 0 ${botMetadata} -map_metadata -1 "${outputFile}"`
                        : `ffmpeg -i "${inputFile}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease" -lossless 0 -compression_level 3 -q:v 50 ${botMetadata} -map_metadata -1 "${outputFile}"`;

                    await new Promise((resolve, reject) => {
                        exec(ffmpegCmd, (error, stdout, stderr) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });

                    // Read converted file and send
                    const stickerBuffer = await fs.readFile(outputFile);
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
                    utils.log("MEDIA", `Sticker created for ${pushName}`);

                    // Cleanup temp files
                    await fs.unlink(inputFile).catch(() => { });
                    await fs.unlink(outputFile).catch(() => { });
                } catch (err) {
                    utils.log("ERROR", `Sticker Creation Failed: ${err.message}`);
                    await sock.sendMessage(from, { text: "❌ Failed to forge sticker. Ensure the media is valid." }, { quoted: msg });
                }
                return;
            }

            // Public Command: Hunt (Ghost Protocol)
            if (cmd === 'hunt') {
                if (isGroup && !isOwner) {
                    return sock.sendMessage(from, { text: "❌ ONLY the Owner can initiate a Hunt in groups." });
                }

                if (!botState.settings.huntedChats) botState.settings.huntedChats = [];
                const isHunted = botState.settings.huntedChats.includes(from);

                if (isHunted) {
                    botState.settings.huntedChats = botState.settings.huntedChats.filter(id => id !== from);
                    await sock.sendMessage(from, { text: "👻 *GHOST PROTOCOL:* Hunt disabled. This chat is no longer being traced." }, { quoted: msg });
                } else {
                    botState.settings.huntedChats.push(from);
                    await sock.sendMessage(from, { text: "🎯 *GHOST PROTOCOL:* Hunt enabled. All deleted messages will be traced and logged." }, { quoted: msg });
                }

                fs.writeJsonSync("./database/bot_settings.json", botState.settings);
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

                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                const quoted = contextInfo?.quotedMessage;
                const isStatus = contextInfo?.remoteJid === 'status@broadcast';

                // --- 1. STATUS SAVER LOGIC ---
                if (isStatus && quoted) {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const routing = args.toLowerCase().trim() === 'me' ? 'me' : 'dm';
                    const target = routing === 'me' ? botState.ownerID : from;

                    try {
                        const buffer = await downloadMediaMessage(
                            { message: quoted },
                            'buffer',
                            {},
                            { reuploadRequest: sock.updateMediaMessage }
                        );

                        if (!buffer) throw new Error("Empty media buffer");

                        const caption = `🌠 *STARRY STATUS SAVER* ${routing === 'me' ? '💾' : '📸'}`;

                        if (quoted.imageMessage) {
                            await sock.sendMessage(target, { image: buffer, caption }, { quoted: msg });
                        } else if (quoted.videoMessage) {
                            await sock.sendMessage(target, { video: buffer, caption }, { quoted: msg });
                        } else if (quoted.conversation || quoted.extendedTextMessage) {
                            const text = quoted.conversation || quoted.extendedTextMessage.text;
                            await sock.sendMessage(target, { text: `🌠 *STARRY STATUS SAVER* 📝\n\n${text}` }, { quoted: msg });
                        }

                        if (target !== from) {
                            await sock.sendMessage(from, { text: "✅ Status stolen and sent to *Saved Messages*." }, { quoted: msg });
                        }
                        return;
                    } catch (err) {
                        const isExpired = err.message.includes("derive") || err.message.includes("expired") || err.message.includes("410");
                        utils.log(isExpired ? "WARN" : "ERROR", `Status Save Result: ${err.message}`);

                        const errorMsg = isExpired
                            ? "❌ *Status Expired:* I couldn't grab this media as it's no longer available on WhatsApp servers."
                            : "❌ *System Error:* Failed to process this status. It might be malformed.";

                        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
                        return;
                    }
                }

                // --- 2. VCARD SAVING LOGIC ---
                const targetJid = contextInfo?.participant || sender;
                const saveName = args || (quoted ? (contextInfo.pushName || "Saved User") : pushName);

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

            // Command: .vv / .viewonce (Media Unlocker)
            if (cmd === 'vv' || cmd === 'viewonce') {
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                const quoted = contextInfo?.quotedMessage;

                if (!quoted) return sock.sendMessage(from, { text: "❌ Please quote a *View-Once* message to unlock it." }, { quoted: msg });

                // Detect View-Once (Standard or V2)
                const voContent = quoted.viewOnceMessage?.message || quoted.viewOnceMessageV2?.message;
                if (!voContent) return sock.sendMessage(from, { text: "❌ That is not a View-Once message." }, { quoted: msg });

                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                try {
                    await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } });
                    const buffer = await downloadMediaMessage(
                        { message: voContent },
                        'buffer',
                        {},
                        { reuploadRequest: sock.updateMediaMessage }
                    );

                    if (!buffer) throw new Error("Empty media buffer");

                    const target = botState.settings.viewOnceMode === 'save' ? botState.ownerID : from;
                    const caption = `🌠 *STARRY VV UNLOCKER* 🔓\n\n_Mode: ${botState.settings.viewOnceMode.toUpperCase()}_`;

                    if (voContent.imageMessage) {
                        await sock.sendMessage(target, { image: buffer, caption }, { quoted: msg });
                    } else if (voContent.videoMessage) {
                        await sock.sendMessage(target, { video: buffer, caption }, { quoted: msg });
                    }

                    if (target !== from) {
                        await sock.sendMessage(from, { text: "✅ Media unlocked and sent to *Saved Messages*." }, { quoted: msg });
                    }
                } catch (err) {
                    const isExpired = err.message.includes("derive") || err.message.includes("expired") || err.message.includes("410");
                    utils.log(isExpired ? "WARN" : "ERROR", `VV Unlock Result: ${err.message}`);

                    const errorMsg = isExpired
                        ? "❌ *Media Expired:* This View-Once file is no longer on the server."
                        : "❌ *System Error:* Failed to unlock. It might not be a standard media format.";

                    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
                }
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

            // Command: Menu / Help
            if (cmd === 'menu' || cmd === 'help' || cmd === 'start') {
                if (cmd === 'help') {
                    // Show detailed help guide
                    const getHelp = require('./help');
                    await sock.sendMessage(from, { text: getHelp() }, { quoted: msg });
                } else {
                    // Show command menu
                    const menuText = getMenu(pushName, botState);
                    await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                }
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

                if (cmd === 'vvmode') {
                    const arg = args.toLowerCase().trim();
                    if (arg === 'chat') {
                        botState.settings.viewOnceMode = 'chat';
                    } else if (arg === 'save') {
                        botState.settings.viewOnceMode = 'save';
                    } else {
                        return sock.sendMessage(from, { text: `📊 *VV MODE CONTROL*\n│ *Current:* ${botState.settings.viewOnceMode.toUpperCase()}\n│ *Usage:* .vvmode <chat/save>\n╰───────────────` }, { quoted: msg });
                    }

                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, { text: `✅ View-Once response mode set to *${botState.settings.viewOnceMode.toUpperCase()}*.` }, { quoted: msg });
                    return;
                }



                // --- MANUAL STATUS VIEW (.viewstatus / .vs) ---
                if (cmd === 'viewstatus' || cmd === 'vs') {
                    let targetJid;

                    // 1. Check if replying to a message (e.g., Log Alert)
                    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                        const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                        const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";

                        // Try to extract JID from log text formatted like "📱 1234567890"
                        const phoneMatch = quotedText.match(/📱\s*(\d+)/);
                        if (phoneMatch) {
                            targetJid = `${phoneMatch[1]}@s.whatsapp.net`;
                        } else {
                            // Fallback: Use the sender of the quoted message (if it's not the bot itself)
                            const quotedParticipant = msg.message.extendedTextMessage.contextInfo.participant;
                            if (quotedParticipant && quotedParticipant !== botState.botJid) {
                                targetJid = quotedParticipant;
                            }
                        }
                    }
                    // 2. Check for mentions or args
                    else if (args) {
                        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (mentionedJid) {
                            targetJid = mentionedJid;
                        } else {
                            // Handle raw number arg
                            const number = args.replace(/[^0-9]/g, '');
                            if (number.length >= 10) targetJid = `${number}@s.whatsapp.net`;
                        }
                    }

                    if (!targetJid) {
                        return sock.sendMessage(from, { text: "❌ Usage:\n1. Reply .vs to a Status Alert\n2. Tag a user: .vs @User" }, { quoted: msg });
                    }

                    await sock.sendMessage(from, { react: { text: "👀", key: msg.key } });
                    const count = await status.processSpecificUser(sock, targetJid);

                    if (count > 0) {
                        await sock.sendMessage(from, { text: `✅ Manually viewed/liked ${count} statuses from target.` }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: "⚠️ No pending statuses found for this user in database." }, { quoted: msg });
                    }
                    return;
                }

                // --- STATUS VIP MANAGER (.statvip) ---
                if (cmd === 'statvip' || cmd === 'statusvip') {
                    const [action, ...target] = args.split(/\s+/);

                    if (action === 'list') {
                        const vipList = status.getVipList();
                        if (vipList.length === 0) return sock.sendMessage(from, { text: "📜 *VIP STATUS LIST*\n\n_No VIPs configured._" }, { quoted: msg });

                        let text = `📜 *VIP STATUS LIST* (${vipList.length})\n\n`;
                        for (const jid of vipList) {
                            const contactName = botState.contacts[jid]?.name || "Unknown";
                            text += `🌟 ${contactName} (+${jid.split('@')[0]})\n`;
                        }
                        await sock.sendMessage(from, { text }, { quoted: msg });
                        return;
                    }

                    // Extract JID for add/del
                    let targetJid;
                    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (mentionedJid) {
                        targetJid = mentionedJid;
                    } else if (target.length > 0) {
                        const number = target.join('').replace(/[^0-9]/g, '');
                        if (number.length >= 10) targetJid = `${number}@s.whatsapp.net`;
                    }

                    if (!targetJid || (action !== 'add' && action !== 'del')) {
                        return sock.sendMessage(from, { text: "❌ Usage:\n.statvip add @User\n.statvip del @User\n.statvip list" }, { quoted: msg });
                    }

                    const success = status.updateVipList(action, targetJid);
                    if (success) {
                        const icon = action === 'add' ? '🌟' : '🗑️';
                        await sock.sendMessage(from, { text: `✅ ${icon} User ${action === 'add' ? 'added to' : 'removed from'} VIP List.` }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: `⚠️ User was ${action === 'add' ? 'already in' : 'not in'} the list.` }, { quoted: msg });
                    }
                    return;
                }

                if (cmd === 'statnotify') {
                    const arg = args.toLowerCase().trim();
                    let enabled;
                    if (arg === 'on') enabled = true;
                    else if (arg === 'off') enabled = false;
                    else return sock.sendMessage(from, { text: "❌ Usage: .statnotify <on/off>" }, { quoted: msg });

                    status.setNotify(enabled);
                    await sock.sendMessage(from, { text: `✅ Status Notifications are now *${enabled ? 'ON' : 'OFF'}*.` }, { quoted: msg });
                    return;
                }

                // --- STATUS INFO ---
                if (cmd === 'statinfo' || cmd === 'statusinfo') {
                    const settings = status.getSettings();
                    const pendingCount = status.getPendingCount();
                    const posterCount = Object.keys(botState.statusPosters || {}).length;

                    // Calculate next run time
                    const now = new Date();
                    const currentHour = now.getHours();
                    const nextHour = settings.schedule.find(h => h > currentHour) || settings.schedule[0];
                    const nextRun = nextHour > currentHour ? `Today ${nextHour}:00` : `Tomorrow ${nextHour}:00`;

                    let infoStr = `📊 *STATUS SCHEDULER INFO*\n\n`;
                    infoStr += `⏰ *Schedule:* [${settings.schedule.join(', ')}]\n`;
                    infoStr += `⏱️ *Buffer:* ${settings.bufferMin}ms - ${settings.bufferMax}ms\n\n`;
                    infoStr += `📬 *Pending:* ${pendingCount} statuses\n`;
                    infoStr += `👥 *Tracked Posters:* ${posterCount}\n\n`;
                    infoStr += `🔜 *Next Run:* ${nextRun}\n\n`;
                    infoStr += `╰━━━━━━━━━━━━━━`;

                    await sock.sendMessage(from, { text: infoStr }, { quoted: msg });
                    return;
                }

                if (cmd === 'setsched') {
                    const hours = args.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23);
                    if (hours.length === 0) return sock.sendMessage(from, { text: "❌ Usage: .setsched 9,12,14,15,18,21" }, { quoted: msg });

                    status.updateSettings({ statusSchedule: hours });
                    await sock.sendMessage(from, { text: `✅ Status Schedule updated: [${hours.join(', ')}]` }, { quoted: msg });
                    return;
                }

                if (cmd === 'setbuffer') {
                    const parts = args.split(/\s+/).map(p => parseInt(p.trim())).filter(p => !isNaN(p));
                    if (parts.length < 2) return sock.sendMessage(from, { text: "❌ Usage: .setbuffer <min_ms> <max_ms>\nExample: .setbuffer 5000 15000" }, { quoted: msg });

                    status.updateSettings({ statusBufferMin: parts[0], statusBufferMax: parts[1] });
                    await sock.sendMessage(from, { text: `✅ Status Buffer updated: ${parts[0]}ms - ${parts[1]}ms` }, { quoted: msg });
                    return;
                }

                if (cmd === 'alpha' || cmd === 'statbatch') {
                    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
                    const { key: loadingKey } = await sock.sendMessage(from, { text: "🌀 *ALPHA PROTOCOL*\n\n⏳ Scanning status database..." }, { quoted: msg });
                    const count = await status.processStatuses(sock);
                    await sock.sendMessage(from, { text: `✅ *ALPHA PROTOCOL COMPLETE*\n\n📊 Processed: ${count} statuses\n🕐 Time: ${new Date().toLocaleTimeString()}`, edit: loadingKey });
                    return;
                }

                if (cmd === 'statusinfo') {
                    const statusSettings = status.getSettings();
                    const pendingCount = status.getPendingCount();
                    const lastRun = botState.lastStatusRun ? new Date(botState.lastStatusRun).toLocaleString() : 'Never';

                    const infoStr = `📊 *STATUS BOT INTEL*\n\n` +
                        `⏰ *Schedule:* ${statusSettings.schedule.map(h => h + ':00').join(', ')}\n` +
                        `⏱️ *Buffer:* ${statusSettings.bufferMin}ms - ${statusSettings.bufferMax}ms\n` +
                        `📦 *Pending:* ${pendingCount} statuses\n` +
                        `🕐 *Last Run:* ${lastRun}\n` +
                        `\n╰───────────────`;

                    await sock.sendMessage(from, { text: infoStr }, { quoted: msg });
                    return;
                }

                // --- VIEW FEATURE REQUESTS ---
                if (cmd === 'pullreq') {
                    const requestLog = path.join(__dirname, '../database/requests.json');
                    const requests = fs.readJsonSync(requestLog, { throws: false }) || [];

                    if (requests.length === 0) {
                        return sock.sendMessage(from, { text: "📝 *FEATURE REQUESTS*\n\n_No requests logged yet._" }, { quoted: msg });
                    }

                    let requestStr = `📝 *FEATURE REQUESTS* (🆔 ${requests.length})\n\n`;
                    const recent = requests.slice(-10).reverse(); // Last 10, newest first

                    recent.forEach((req, index) => {
                        const date = new Date(req.timestamp).toLocaleString();
                        requestStr += `${requests.length - index}. *${req.name}*\n`;
                        requestStr += `   💬 ${req.request}\n`;
                        requestStr += `   🕐 ${date}\n\n`;
                    });

                    if (requests.length > 10) {
                        requestStr += `_...and ${requests.length - 10} more requests_\n`;
                    }

                    requestStr += "\n╰━━━━━━━━━━━━━━";
                    await sock.sendMessage(from, { text: requestStr }, { quoted: msg });
                    return;
                }

                // --- VIEW RECENT LOGS ---
                if (cmd === 'logs') {
                    const logFile = path.join(__dirname, '../database/bot.log');
                    const logContent = await fs.readFile(logFile, 'utf-8');
                    const lines = logContent.split('\n').filter(l => l.trim());
                    const recentLines = lines.slice(-50); // Last 50 lines

                    let logStr = `📜 *RECENT LOGS* (Last 50)\n\n`;
                    logStr += recentLines.join('\n');
                    logStr += "\n\n╰━━━━━━━━━━━━━━";

                    // Send as document if too long
                    if (logStr.length > 4000) {
                        await sock.sendMessage(from, {
                            document: Buffer.from(recentLines.join('\n')),
                            fileName: 'recent_logs.txt',
                            mimetype: 'text/plain',
                            caption: '📜 Recent logs (last 50 lines)'
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: logStr }, { quoted: msg });
                    }
                    return;
                }

                // --- CLEAR LOGS ---
                if (cmd === 'clearlog') {
                    const logFile = path.join(__dirname, '../database/bot.log');
                    await fs.writeFile(logFile, '');
                    await sock.sendMessage(from, { text: "🗑️ *LOG CLEARED*\n\nAll bot logs have been wiped." }, { quoted: msg });
                    utils.log("SYSTEM", "Bot log cleared by owner.");
                    return;
                }

                // --- STATUS STATISTICS ---
                if (cmd === 'statstats') {
                    if (!botState.statusPosters || Object.keys(botState.statusPosters).length === 0) {
                        return sock.sendMessage(from, { text: "📊 *STATUS STATISTICS*\n\n_No status data collected yet._" }, { quoted: msg });
                    }

                    // Sort by post count
                    const sorted = Object.entries(botState.statusPosters)
                        .sort((a, b) => b[1].count - a[1].count)
                        .slice(0, 20); // Top 20

                    let statsStr = `📊 *STATUS STATISTICS*\n\n👥 Total Posters: ${Object.keys(botState.statusPosters).length}\n\n`;

                    sorted.forEach(([jid, data], index) => {
                        const lastPosted = data.lastPosted ? new Date(data.lastPosted).toLocaleDateString() : 'Unknown';
                        statsStr += `${index + 1}. *${data.name}*\n`;
                        statsStr += `   📸 ${data.count} posts\n`;
                        statsStr += `   🕐 Last: ${lastPosted}\n\n`;
                    });

                    if (Object.keys(botState.statusPosters).length > 20) {
                        statsStr += `_...and ${Object.keys(botState.statusPosters).length - 20} more posters_\n`;
                    }

                    statsStr += "\n╰━━━━━━━━━━━━━━";
                    await sock.sendMessage(from, { text: statsStr }, { quoted: msg });
                    return;
                }

                // --- REACTION MANAGEMENT ---
                if (cmd === 'addreact') {
                    // Extract emoji from end of string using regex
                    const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\uFE0F]+$/u;
                    const emojiMatch = args.match(emojiRegex);

                    if (!emojiMatch) {
                        return sock.sendMessage(from, { text: "❌ Usage: .addreact <keyword> <emoji>\nExample: .addreact happy new year 🎉" }, { quoted: msg });
                    }

                    const emoji = emojiMatch[0];
                    const keyword = args.slice(0, -emoji.length).trim().toLowerCase();

                    if (!keyword) {
                        return sock.sendMessage(from, { text: "❌ Usage: .addreact <keyword> <emoji>\nExample: .addreact happy new year 🎉" }, { quoted: msg });
                    }

                    botState.reactions[keyword] = emoji;
                    fs.writeJsonSync("./database/reactions.json", botState.reactions);
                    await sock.sendMessage(from, { text: `✅ Reaction added: *${keyword}* ➾ ${emoji}` }, { quoted: msg });
                    return;
                }

                if (cmd === 'delreact') {
                    const keyword = args.toLowerCase().trim();
                    if (!keyword) return sock.sendMessage(from, { text: "❌ Usage: .delreact <keyword>" }, { quoted: msg });

                    if (botState.reactions[keyword]) {
                        const emoji = botState.reactions[keyword];
                        delete botState.reactions[keyword];
                        fs.writeJsonSync("./database/reactions.json", botState.reactions);
                        await sock.sendMessage(from, { text: `✅ Reaction removed: *${keyword}* (was ${emoji})` }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: `❌ Keyword "${keyword}" not found in database.` }, { quoted: msg });
                    }
                    return;
                }

                if (cmd === 'listreact') {
                    const entries = Object.entries(botState.reactions);
                    if (entries.length === 0) return sock.sendMessage(from, { text: "📂 *REACTION DATABASE*\n\n_No keywords registered yet._" }, { quoted: msg });

                    let listStr = "📂 *REACTION DATABASE*\n\n";
                    entries.forEach(([kw, emj]) => {
                        listStr += `┃ *${kw}* ➾ ${emj}\n`;
                    });
                    listStr += "\n╰━━━━━━━━━━━━━━";
                    await sock.sendMessage(from, { text: listStr }, { quoted: msg });
                    return;
                }

                // --- FEATURE REQUEST LOGGING ---
                if (cmd === 'request') {
                    if (!args) return sock.sendMessage(from, { text: "❌ Usage: .request <your feature request>" }, { quoted: msg });

                    const requestLog = path.join(__dirname, '../database/requests.json');
                    const requests = fs.readJsonSync(requestLog, { throws: false }) || [];

                    requests.push({
                        from: sender,
                        name: pushName,
                        request: args,
                        timestamp: new Date().toISOString()
                    });

                    fs.writeJsonSync(requestLog, requests);
                    await sock.sendMessage(from, { text: `✅ *REQUEST LOGGED*\n\n📝 Your feature request has been recorded.\n🆔 Request #${requests.length}` }, { quoted: msg });
                    return;
                }

                // --- MESSAGE DELETION ---
                if (cmd === 'del') {
                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                    const quotedMsg = contextInfo?.quotedMessage;

                    if (!quotedMsg) {
                        return sock.sendMessage(from, { text: "❌ Please quote a message to delete it." }, { quoted: msg });
                    }

                    try {
                        await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: true, id: contextInfo.stanzaId, participant: contextInfo.participant } });
                        const { key: confirmKey } = await sock.sendMessage(from, { text: "🗑️ Message deleted." }, { quoted: msg });

                        // Auto-delete confirmation after 5 seconds
                        setTimeout(async () => {
                            await sock.sendMessage(from, { delete: confirmKey });
                        }, 5000);
                    } catch (e) {
                        await sock.sendMessage(from, { text: "❌ Failed to delete message. Make sure it's from me." }, { quoted: msg });
                    }
                    return;
                }

                // --- CONTACTS LIST (Saved Messages Only) ---
                if (cmd === 'contacts') {
                    // Only work in Saved Messages (owner's DM, not groups)
                    if (!isOwner || isGroup) {
                        return sock.sendMessage(from, { text: "❌ This command only works in *Saved Messages* (DM only)." }, { quoted: msg });
                    }

                    const contactCount = Object.keys(botState.contacts).length;
                    if (contactCount === 0) {
                        return sock.sendMessage(from, { text: "📂 *CONTACT DATABASE*\n\n_No contacts saved yet._" }, { quoted: msg });
                    }

                    // Pagination: 50 contacts per page
                    const perPage = 50;
                    const totalPages = Math.ceil(contactCount / perPage);
                    const page = parseInt(args) || 1; // Default to page 1

                    if (page < 1 || page > totalPages) {
                        return sock.sendMessage(from, { text: `❌ Invalid page number. Use 1-${totalPages}` }, { quoted: msg });
                    }

                    const startIndex = (page - 1) * perPage;
                    const endIndex = startIndex + perPage;

                    let contactList = `📂 *CONTACT DATABASE*\n\n📊 Total: ${contactCount} contacts\n📄 Page: ${page}/${totalPages}\n\n`;
                    const sortedContacts = Object.entries(botState.contacts)
                        .sort((a, b) => a[1].name.localeCompare(b[1].name))
                        .slice(startIndex, endIndex);

                    sortedContacts.forEach(([jid, data], index) => {
                        const globalIndex = startIndex + index + 1;
                        contactList += `${globalIndex}. *${data.name}*\n   📱 ${jid.split('@')[0]}\n`;
                    });

                    // Navigation hint
                    if (page < totalPages) {
                        contactList += `\n💡 _Type .contacts ${page + 1} for next page_`;
                    }

                    contactList += "\n\n╰━━━━━━━━━━━━━━";
                    await sock.sendMessage(from, { text: contactList }, { quoted: msg });
                    return;
                }

                // --- BLOCK/UNBLOCK USER ---
                if (cmd === 'block') {
                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                    // In DM, block the person you're chatting with directly
                    const userToBlock = !isGroup ? from : (contextInfo?.mentionedJid?.[0] || contextInfo?.participant);

                    if (!userToBlock) {
                        return sock.sendMessage(from, { text: "❌ Please quote or mention a user to block." }, { quoted: msg });
                    }

                    try {
                        await sock.updateBlockStatus(userToBlock, 'block');
                        const { key: confirmKey } = await sock.sendMessage(from, { text: `🚫 Blocked @${userToBlock.split('@')[0]}`, mentions: [userToBlock] }, { quoted: msg });

                        setTimeout(async () => {
                            await sock.sendMessage(from, { delete: confirmKey });
                        }, 5000);
                    } catch (e) {
                        await sock.sendMessage(from, { text: "❌ Failed to block user." }, { quoted: msg });
                    }
                    return;
                }

                if (cmd === 'unblock') {
                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                    // In DM, unblock the person you're chatting with directly
                    const userToUnblock = !isGroup ? from : (contextInfo?.mentionedJid?.[0] || contextInfo?.participant);

                    if (!userToUnblock) {
                        return sock.sendMessage(from, { text: "❌ Please quote or mention a user to unblock." }, { quoted: msg });
                    }

                    try {
                        await sock.updateBlockStatus(userToUnblock, 'unblock');
                        const { key: confirmKey } = await sock.sendMessage(from, { text: `✅ Unblocked @${userToUnblock.split('@')[0]}`, mentions: [userToUnblock] }, { quoted: msg });

                        setTimeout(async () => {
                            await sock.sendMessage(from, { delete: confirmKey });
                        }, 5000);
                    } catch (e) {
                        await sock.sendMessage(from, { text: "❌ Failed to unblock user." }, { quoted: msg });
                    }
                    return;
                }

                // --- REPORT SPAM ---
                if (cmd === 'report') {
                    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                    // In DM, report the person you're chatting with directly
                    const userToReport = !isGroup ? from : (contextInfo?.mentionedJid?.[0] || contextInfo?.participant);

                    if (!userToReport) {
                        return sock.sendMessage(from, { text: "❌ Please quote or mention a user to report." }, { quoted: msg });
                    }

                    try {
                        // Report and block
                        await sock.updateBlockStatus(userToReport, 'block');
                        const { key: confirmKey } = await sock.sendMessage(from, { text: `⚠️ Reported & Blocked @${userToReport.split('@')[0]}`, mentions: [userToReport] }, { quoted: msg });

                        // Auto-delete confirmation after 5 seconds
                        setTimeout(async () => {
                            await sock.sendMessage(from, { delete: confirmKey });
                        }, 5000);
                    } catch (e) {
                        await sock.sendMessage(from, { text: "❌ Failed to report user." }, { quoted: msg });
                    }
                    return;
                }
            }

            // Admin/Group Commands
            if (isGroup && (cmd === 'tagall' || cmd === 'kick' || cmd === 'warn' || cmd === 'promote' || cmd === 'demote' || cmd === 'mute' || cmd === 'unmute' || cmd === 'antilink' || cmd === 'add' || cmd === 'mem' || cmd === 'memghost')) {
                const admin = require('./admin');
                await admin.handleAdminCommand(sock, msg, from, cmd, args, botState, sender, isOwner);
                return;
            }

            // Intelligent Error Handler - Suggest Commands with Auto-Delete
            const { suggestCommand } = require('./suggest');
            const suggestion = suggestCommand(cmd);

            let errorMsg = `❌ *Unknown command:* \`.${cmd}\``;
            if (suggestion) {
                errorMsg += `\n\n💡 *Did you mean:* \`.${suggestion}\`?`;
            }
            errorMsg += `\n\n_Type .menu to see all commands_`;

            const sentMsg = await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });

            // Auto-delete error message after 5 seconds
            setTimeout(async () => {
                try {
                    await sock.sendMessage(from, { delete: sentMsg.key });
                } catch (e) { }
            }, 5000);
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
