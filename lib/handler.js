const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const utils = require('./utils');
const getMenu = require('./menu');
const status = require('./status');
const aiFeatures = require('./ai-features');
const adminCommands = require('./admin-commands');
const adminPermissions = require('./admin-permissions');
const stickerLab = require('./sticker-lab');
const audioLab = require('./audio-lab');
const imageTools = require('./image-tools');
const infoZone = require('./info-zone');
const funZone = require('./fun-zone');
const gameZone = require('./game-zone');

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
    // Auto-react processes non-bot messages in ALL modes except $sleep
    // Keyword matching uses word boundaries for single words, includes() for phrases
    // Rate limiting via canProcess() prevents spam
    if (!isMe && !isNewsletter && botState.mode !== '$sleep' && body) {

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

    // --- 3. THE HANDSHAKE PROTOCOL (Anti-Ban/Stranger Danger) ---
    // Only trigger for true strangers (not in contacts database)
    if (!isMe && !isGroup && !isTool && !isSys && botState.mode !== '$sleep' && !isStatus && !isNewsletter && !botState.contacts[sender]) {
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
            await sock.sendMessage(from, { text: "Could you please save my contact? 🌠 This ensures you get my status updates!\n\nIgnore the message if u already saved my contact" });
            return;
        }
    }

    if (isTool || isSys || isMentioned) {
        const currentPrefix = isSys ? pSys : pTool; // Default to pTool for mentions
        const isCmd = isTool || isSys;

        const cmd = isCmd ? body.slice(currentPrefix.length).trim().split(/\s+/)[0].toLowerCase() : "";
        const args = isCmd ? body.slice(currentPrefix.length + cmd.length).trim() : body.trim();

        // --- AI MENTION HANDLER (Before Guardian Protocol) ---
        if (isMentioned && !isCmd) {
            // Try AI mention response
            const handled = await aiFeatures.handleMentionAI(msg, sock, botState, body);
            if (handled) return; // AI responded, we're done
            // If not handled (aiMentionMode is off), continue normal flow
        }

        // --- 4. THE GUARDIAN PROTOCOL (Security & Mode Enforcement) ---
        if (isCmd && !isOwner) {
            // 1. Sleep Mode Enforcement
            if (botState.mode === '$sleep') return;

            // 2. Private Mode Enforcement - Shh reaction (applies to both groups and DMs)
            if (botState.mode === '$private') {
                await sock.sendMessage(from, { react: { text: "🤫", key: msg.key } });
                // No timeout - let users see the shh reaction
                return;
            }

            // 3. Global Rate Limiting (The Shield)
            if (!utils.canProcess(sender, botState.cooldowns)) {
                await sock.sendMessage(from, { react: { text: "❄️", key: msg.key } });
                return;
            }
        }

        // --- 5. COMING SOON INTERCEPTOR ---
        const comingSoonCommands = []; // All tools are now being unlea9shed or have placeholders
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

            try {
                // Pollinations.ai - Free, no API key needed, verified working
                const seed = Math.floor(Math.random() * 100000);
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`;

                await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: `🌠 *STARRY IMAGINE*\n\n*Prompt:* _${prompt}_\n*Model:* _Pollinations AI_`,
                }, { quoted: msg });

                // Finalize loading message
                await sock.sendMessage(from, { text: "✅ Vision Manifested.", edit: key });
                utils.log("AI", `Image sent to ${pushName}.`);
            } catch (error) {
                await sock.sendMessage(from, { text: "❌ Failed to generate image. Please try again.", edit: key });
                utils.log("ERROR", `Image generation failed: ${error.message}`);
            }
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

                // Send loading message
                const startTime = Date.now();
                const loadingMsg = await sock.sendMessage(from, {
                    text: "🏓 Pinging..."
                }, { quoted: msg });

                // Calculate response time
                const responseTime = Date.now() - startTime;

                // Simulate latency check (measure message round-trip)
                const pingStart = Date.now();
                await sock.sendMessage(from, { react: { text: "🚀", key: msg.key } });
                const latency = Date.now() - pingStart;

                // Determine speed rating
                let speedRating, speedEmoji;
                if (latency < 100) {
                    speedRating = "Excellent";
                    speedEmoji = "🟢";
                } else if (latency < 300) {
                    speedRating = "Good";
                    speedEmoji = "🟡";
                } else if (latency < 500) {
                    speedRating = "Fair";
                    speedEmoji = "🟠";
                } else {
                    speedRating = "Poor";
                    speedEmoji = "🔴";
                }

                // Edit the loading message with results
                const pongText = `🏓 *Pong!*

⚡ *Starry MD 2.0 is Alive*

╭━━━ 📊 *METRICS* ━━━╮
┃
┃ ⏱️ *Response Time:* ${responseTime}ms
┃ 📡 *Latency:* ${latency}ms
┃ ${speedEmoji} *Speed:* ${speedRating}
┃
╰━━━━━━━━━━━━━━━━━━╯

> _Systems operational. Ready to serve._`;

                await sock.sendMessage(from, {
                    text: pongText,
                    edit: loadingMsg.key
                });
                return;
            }



            // Public Command: To-Image (.toimg)
            if (cmd === 'toimg') {
                return stickerLab.handleToImg(msg, sock, botState);
            }

            // Public Command: To-Video (.tovideo / .mp4)
            if (cmd === 'tovideo' || cmd === 'mp4') {
                return stickerLab.handleToVideo(msg, sock, botState);
            }

            // Public Command: Random Animals (.doge / .cat)
            if (cmd === 'doge' || cmd === 'cat') {
                return stickerLab.handleAnimal(msg, sock, botState, cmd);
            }

            // Audio Lab: YouTube Search (.yts)
            if (cmd === 'yts') {
                return audioLab.handleYTS(msg, sock, botState, args);
            }

            // Audio Lab: Play (.play)
            if (cmd === 'play') {
                return audioLab.handlePlay(msg, sock, botState, args);
            }

            // Audio Lab: Voice Note (.tovn)
            if (cmd === 'tovn') {
                return audioLab.handleToVN(msg, sock, botState);
            }

            // Audio Lab: Speed (.fast / .slow)
            if (cmd === 'fast' || cmd === 'slow') {
                return audioLab.handleSpeed(msg, sock, botState, cmd);
            }

            // Image Tools: Meme (.meme)
            if (cmd === 'meme') {
                return imageTools.handleMeme(msg, sock, botState, args);
            }

            // Image Tools: Wasted (.wasted)
            if (cmd === 'wasted') {
                return imageTools.handleWasted(msg, sock, botState);
            }

            // Image Tools: To-URL (.tourl)
            if (cmd === 'tourl') {
                return imageTools.handleToURL(msg, sock, botState);
            }

            // --- PHASE 4: INFO, FUN & GAMES ---

            // Info Zone
            if (['lyrics', 'wiki', 'weather'].includes(cmd)) {
                if (cmd === 'lyrics') return infoZone.handleLyrics(msg, sock, botState, args);
                if (cmd === 'wiki') return infoZone.handleWiki(msg, sock, botState, args);
                if (cmd === 'weather') return infoZone.handleWeather(msg, sock, botState, args);
            }

            // Fun Zone
            if (['ship', 'match', 'gaycheck', 'gay', 'truth', 'dare', '8ball'].includes(cmd)) {
                if (cmd === 'ship') return funZone.handleShip(msg, sock, botState);
                if (cmd === 'match') return funZone.handleMatch(msg, sock, botState);
                if (cmd === 'gaycheck' || cmd === 'gay') return funZone.handleGayCheck(msg, sock, botState);
                if (cmd === 'truth') return funZone.handleTruth(msg, sock, botState);
                if (cmd === 'dare') return funZone.handleDare(msg, sock, botState);
                if (cmd === '8ball') return funZone.handle8Ball(msg, sock, botState, args);
            }

            // Game Zone
            if (['ttt', 'tictactoe', 'move'].includes(cmd)) {
                if (cmd === 'move') return gameZone.handleMove(msg, sock, botState, args[0]);
                return gameZone.handleTicTacToe(msg, sock, botState, args);
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
                const { Sticker, StickerTypes } = require('wa-sticker-formatter');

                try {
                    const buffer = await downloadMediaMessage(
                        { message: messageToDownload },
                        'buffer',
                        {},
                        { reuploadRequest: sock.updateMediaMessage }
                    );

                    // Parse caption for custom metadata: .sticker PackName|Author
                    const caption = args || '';
                    let packName = 'Starry Stickers';
                    let authorName = config.OWNER_NAME || 'Starry MD';

                    if (caption && caption.includes('|')) {
                        const parts = caption.split('|');
                        packName = parts[0].trim() || packName;
                        authorName = parts[1].trim() || authorName;
                    }

                    // Create sticker with proper Exif metadata
                    const sticker = new Sticker(buffer, {
                        pack: packName,
                        author: authorName,
                        type: isVideo ? StickerTypes.FULL : StickerTypes.DEFAULT,
                        quality: 50
                    });

                    const stickerBuffer = await sticker.toBuffer();
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
                    utils.log("MEDIA", `Sticker created for ${pushName} (Pack: ${packName}, Author: ${authorName})`);
                } catch (err) {
                    utils.log("ERROR", `Sticker Creation Failed: ${err.message}`);
                    await sock.sendMessage(from, { text: "❌ Failed to forge sticker. Ensure the media is valid." }, { quoted: msg });
                }
                return;
            }

            // Public Command: Steal Sticker (Metadata Thief)
            if (cmd === 'stealsticker' || cmd === 'ssteal' || cmd === 'steal') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                const quoted = contextInfo?.quotedMessage;

                if (!quoted || !quoted.stickerMessage) {
                    return sock.sendMessage(from, { text: "❌ Please quote a *sticker* to steal!" }, { quoted: msg });
                }

                await sock.sendMessage(from, { react: { text: "🥷", key: msg.key } });
                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                const { Sticker } = require('wa-sticker-formatter');

                try {
                    // Download the sticker (works for both static and animated)
                    const buffer = await downloadMediaMessage(
                        { message: quoted },
                        'buffer',
                        {},
                        { reuploadRequest: sock.updateMediaMessage }
                    );

                    // Re-create sticker with YOUR metadata
                    const packName = 'Stolen Stickers';
                    const authorName = config.OWNER_NAME || 'Starry MD';

                    const sticker = new Sticker(buffer, {
                        pack: packName,
                        author: authorName,
                        quality: 50
                    });

                    const stickerBuffer = await sticker.toBuffer();
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
                    utils.log("MEDIA", `Sticker stolen and re-branded for ${pushName}`);
                } catch (err) {
                    utils.log("ERROR", `Sticker Steal Failed: ${err.message}`);
                    await sock.sendMessage(from, { text: "❌ Failed to steal sticker. Try again." }, { quoted: msg });
                }
                return;
            }

            // Public Command: Hunt (Ghost Protocol)
            if (cmd === 'hunt') {
                if (!botState.settings.huntedChats) botState.settings.huntedChats = [];

                const action = args.toLowerCase().trim();

                // List hunted chats
                if (action === 'list') {
                    if (botState.settings.huntedChats.length === 0) {
                        return sock.sendMessage(from, {
                            text: "🎯 *HUNT LIST*\n\n_No chats are being hunted._\n\n💡 Use `.hunt` in a chat to start monitoring."
                        }, { quoted: msg });
                    }

                    let text = `🎯 *HUNT LIST* (${botState.settings.huntedChats.length})\n\n`;
                    for (const chatId of botState.settings.huntedChats) {
                        const chatName = botState.contacts[chatId]?.name || chatId.split('@')[0];
                        const isCurrentChat = chatId === from;
                        text += `${isCurrentChat ? '📍' : '🔍'} ${chatName}\n`;
                    }
                    text += `\n💡 Use \`.hunt\` in a chat to toggle monitoring.`;
                    return sock.sendMessage(from, { text }, { quoted: msg });
                }

                // Owner-only check for groups
                if (isGroup && !isOwner) {
                    return sock.sendMessage(from, {
                        text: "❌ Only the owner can initiate hunt in groups."
                    }, { quoted: msg });
                }

                // Toggle hunt for current chat
                const isHunted = botState.settings.huntedChats.includes(from);

                if (isHunted) {
                    // Disable hunt
                    botState.settings.huntedChats = botState.settings.huntedChats.filter(id => id !== from);
                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, {
                        text: "� *HUNT DISABLED*\n\nThis chat is no longer being monitored for deleted messages.\n\n💡 Use `.hunt list` to see all hunted chats."
                    }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } });
                } else {
                    // Enable hunt
                    botState.settings.huntedChats.push(from);
                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, {
                        text: "🎯 *HUNT ACTIVATED*\n\nThis chat is now being monitored. Deleted messages will be forwarded to you.\n\n_Use `.hunt` again to disable._"
                    }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: "🎯", key: msg.key } });
                }
                return;
            }

            // Owner Command: Reveal Deleted Message
            if (cmd === 'reveal') {
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                const quotedText = contextInfo?.quotedMessage?.conversation ||
                    contextInfo?.quotedMessage?.extendedTextMessage?.text || "";

                // Extract delete ID from quoted message
                const idMatch = quotedText.match(/🔑 \*ID:\* (del_\d+_[a-z0-9]+)/);

                if (!idMatch) {
                    return sock.sendMessage(from, {
                        text: "❌ Please quote a hunt alert message to reveal the deleted content."
                    }, { quoted: msg });
                }

                const deleteId = idMatch[1];

                if (!botState.deletedMessages || !botState.deletedMessages.has(deleteId)) {
                    return sock.sendMessage(from, {
                        text: "❌ Deleted message not found or expired (messages are kept for 1 hour)."
                    }, { quoted: msg });
                }

                const deletedData = botState.deletedMessages.get(deleteId);
                const targetChat = deletedData.from;

                await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

                // Send reveal header to target chat
                const revealHeader = `🔓 *DELETED MESSAGE REVEALED*\n\n` +
                    `👤 *Originally from:* ${deletedData.pushName}\n` +
                    `⏰ *Deleted at:* ${new Date(deletedData.timestamp).toLocaleString()}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━`;

                await sock.sendMessage(targetChat, { text: revealHeader });

                // Forward the actual deleted message
                await utils.copyNForward(sock, targetChat, deletedData.msg, false);

                await sock.sendMessage(from, {
                    text: `✅ Deleted message revealed in the original chat.`
                }, { quoted: msg });

                utils.log("HUNT", `Revealed deleted message ${deleteId} in ${targetChat}`);
                return;
            }

            // Owner Command: Set Hunt Buffer Duration
            if (cmd === 'huntbuffer') {
                const minutes = parseInt(args);

                if (!minutes || minutes < 1 || minutes > 60) {
                    const currentMinutes = Math.floor((config.GHOST_BUFFER_MS || 600000) / 60000);
                    return sock.sendMessage(from, {
                        text: `⏱️ *HUNT BUFFER SETTINGS*\n\n` +
                            `📊 *Current:* ${currentMinutes} minutes\n\n` +
                            `*Usage:* .huntbuffer <minutes>\n` +
                            `*Range:* 1-60 minutes\n\n` +
                            `*Example:* .huntbuffer 15`
                    }, { quoted: msg });
                }

                config.GHOST_BUFFER_MS = minutes * 60000;

                await sock.sendMessage(from, {
                    text: `✅ *HUNT BUFFER UPDATED*\n\n` +
                        `⏱️ *Duration:* ${minutes} minutes\n\n` +
                        `Deleted messages will be captured for ${minutes} minute(s) after being sent.\n\n` +
                        `⚠️ *Note:* Restart bot to apply changes.`
                }, { quoted: msg });

                utils.log("CONFIG", `Hunt buffer set to ${minutes} minutes`);
                return;
            }

            // --- AI TOGGLE COMMAND ---
            if (cmd === 'aitoggle') {
                if (!isOwner) {
                    return sock.sendMessage(from, {
                        text: "❌ Owner-only command."
                    }, { quoted: msg });
                }
                return aiFeatures.handleAIToggle(msg, sock, botState, args);
            }

            // --- DYNAMIC HELP COMMAND ---
            if (cmd === 'help') {
                const getHelp = require('./help');

                // Check if it's a question (dynamic help)
                const isQuestion = args && (
                    args.includes('?') ||
                    args.includes('how') ||
                    args.includes('what') ||
                    args.includes('why') ||
                    args.split(' ').length > 2
                );

                if (isQuestion) {
                    // Use AI-powered dynamic help
                    return aiFeatures.handleDynamicHelp(msg, sock, botState, args);
                }

                // Use normal help
                return sock.sendMessage(from, {
                    text: getHelp(args)
                }, { quoted: msg });
            }

            // --- ADMIN COMMANDS ---

            // .tempmod - Temporary Admin
            if (cmd === 'tempmod') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handleTempMod(msg, sock, botState, args, groupMetadata);
            }

            // .kick - Remove participant
            if (cmd === 'kick') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handleKick(msg, sock, botState, groupMetadata);
            }

            // .add - Add user
            if (cmd === 'add') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handleAdd(msg, sock, botState, args, groupMetadata);
            }

            // .promote - Make admin
            if (cmd === 'promote') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handlePromote(msg, sock, botState, groupMetadata);
            }

            // .demote - Remove admin
            if (cmd === 'demote') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handleDemote(msg, sock, botState, groupMetadata);
            }

            // .warn - Issue warning
            if (cmd === 'warn') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handleWarn(msg, sock, botState, args, groupMetadata);
            }

            // .banchat - Mute bot in group
            if (cmd === 'banchat') {
                return adminCommands.handleBanChat(msg, sock, botState);
            }

            // .unbanchat - Unmute bot
            if (cmd === 'unbanchat') {
                return adminCommands.handleUnbanChat(msg, sock, botState);
            }

            // .mem - Member count
            if (cmd === 'mem') {
                if (!isGroup) return sock.sendMessage(from, { text: "❌ Group-only command!" }, { quoted: msg });
                const groupMetadata = await sock.groupMetadata(from);
                return adminCommands.handleMem(msg, sock, groupMetadata);
            }


            // Public Command: Alive (God Tier)
            if (cmd === 'alive') {
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                const bannerPath = require('path').join(__dirname, '../database/banner.png');

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

� *SYSTEM STATS*

⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s
🧠 *RAM Usage:* ${usedRAM}GB / ${totalRAM}GB (${ramPercent}%)
${platformEmoji} *Platform:* ${platform.toUpperCase()}
📱 *Contacts:* ${contactCount} synced
${modeEmoji} *Mode:* ${mode}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👨‍💻 *OWNER INFO*

📛 *Name:* ${config.OWNER_NAME || 'Starry Xander'}
📞 *Number:* ${config.OWNER_NUMBER || 'Not Set'}

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

                // Send banner if exists, otherwise text-only
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

            // Command: .sv / .save (Owner Only)
            if ((cmd === 'sv' || cmd === 'save') && isOwner) {
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                const quoted = contextInfo?.quotedMessage;

                // Enhanced status detection - check multiple indicators
                const isStatusBroadcast = contextInfo?.remoteJid === 'status@broadcast';
                const isStatusNotification = quoted && (
                    quoted.imageMessage?.contextInfo?.isForwarded ||
                    quoted.videoMessage?.contextInfo?.isForwarded ||
                    contextInfo?.participant?.includes('@s.whatsapp.net')
                );
                const hasStatusMedia = quoted && (quoted.imageMessage || quoted.videoMessage || quoted.conversation || quoted.extendedTextMessage);

                const isStatus = isStatusBroadcast || (isStatusNotification && hasStatusMedia);

                utils.log("DEBUG", `Save command - isStatus: ${isStatus}, isStatusBroadcast: ${isStatusBroadcast}, isStatusNotification: ${isStatusNotification}, hasQuoted: ${!!quoted}`);

                // --- 1. STATUS SAVER LOGIC ---
                if (isStatus && quoted) {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const routing = args.toLowerCase().trim() === 'me' ? 'me' : 'dm';
                    const target = routing === 'me' ? botState.ownerID : from;

                    await sock.sendMessage(from, { react: { text: "💾", key: msg.key } });

                    try {
                        const caption = `🌠 *STARRY STATUS SAVER* ${routing === 'me' ? '💾' : '📸'}`;

                        // Handle different message types
                        if (quoted.imageMessage) {
                            const buffer = await downloadMediaMessage(
                                { message: quoted },
                                'buffer',
                                {},
                                { reuploadRequest: sock.updateMediaMessage }
                            );
                            await sock.sendMessage(target, { image: buffer, caption }, { quoted: msg });
                        } else if (quoted.videoMessage) {
                            const buffer = await downloadMediaMessage(
                                { message: quoted },
                                'buffer',
                                {},
                                { reuploadRequest: sock.updateMediaMessage }
                            );
                            await sock.sendMessage(target, { video: buffer, caption }, { quoted: msg });
                        } else if (quoted.conversation || quoted.extendedTextMessage) {
                            const text = quoted.conversation || quoted.extendedTextMessage.text;
                            await sock.sendMessage(target, { text: `🌠 *STARRY STATUS SAVER* 📝\n\n${text}` }, { quoted: msg });
                        } else {
                            throw new Error("Unsupported status type");
                        }

                        if (target !== from) {
                            await sock.sendMessage(from, { text: "✅ Status saved and sent to *Saved Messages*." }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
                        }

                        utils.log("MEDIA", `Status saved for ${pushName} (routing: ${routing})`);
                        return;
                    } catch (err) {
                        const isExpired = err.message.includes("derive") || err.message.includes("expired") || err.message.includes("410");
                        utils.log(isExpired ? "WARN" : "ERROR", `Status Save Failed: ${err.message}`);

                        const errorMsg = isExpired
                            ? "❌ *Status Expired:* This media is no longer available on WhatsApp servers."
                            : `❌ *Save Failed:* ${err.message}`;

                        await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
                        return;
                    }
                }

                // --- 2. VCARD SAVING LOGIC (DM Only) ---
                if (isGroup) {
                    await sock.sendMessage(from, { text: "❌ Contact saving is restricted to DMs only.\n\n💡 *Tip:* To save a status, quote the status message and use `.save`" }, { quoted: msg });
                    return;
                }

                if (!quoted) {
                    await sock.sendMessage(from, { text: "❌ Please quote a message to save.\n\n*Usage:*\n• Quote a status → `.save` or `.save me`\n• Quote a contact → `.save [name]`" }, { quoted: msg });
                    return;
                }

                // Create VCard for contact
                await sock.sendMessage(from, { react: { text: "🤔", key: msg.key } });

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

                utils.log("CONTACT", `VCard created for ${saveName}`);
                return;
            }

            // Command: .vv / .viewonce (Media Unlocker)
            if (cmd === 'vv' || cmd === 'viewonce') {
                const contextInfo = msg.message.extendedTextMessage?.contextInfo;
                const quoted = contextInfo?.quotedMessage;

                if (!quoted) return sock.sendMessage(from, { text: "❌ Please quote a *View-Once* message to unlock it." }, { quoted: msg });

                // Detect View-Once (Standard, V2, or V2Extension)
                const voContent = quoted.viewOnceMessage?.message ||
                    quoted.viewOnceMessageV2?.message ||
                    quoted.viewOnceMessageV2Extension?.message;

                if (!voContent) {
                    utils.log("DEBUG", `VV Detection failed. Quoted message keys: ${Object.keys(quoted).join(', ')}`);
                    utils.log("DEBUG", `Full quoted structure: ${JSON.stringify(Object.keys(quoted), null, 2)}`);

                    // Check if it's a regular image/video that might have been a view-once
                    if (quoted.imageMessage || quoted.videoMessage) {
                        utils.log("DEBUG", `Found media without viewOnce wrapper. Attempting download anyway...`);
                        // Try to download it anyway - it might be a converted view-once
                        const mediaContent = quoted.imageMessage || quoted.videoMessage;

                        // Permission check for non-owners
                        if (!isOwner && botState.settings.viewOnceMode === 'private') {
                            return sock.sendMessage(from, { text: "🔐 *VV Unlock is in PRIVATE mode.*\n\nRequest owner to change via `.vvmode general` to allow public access." }, { quoted: msg });
                        }

                        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                        try {
                            await sock.sendMessage(from, { react: { text: "🔐", key: msg.key } });
                            const buffer = await downloadMediaMessage(
                                { message: quoted },
                                'buffer',
                                {},
                                { reuploadRequest: sock.updateMediaMessage }
                            );

                            if (!buffer) throw new Error("Empty media buffer");

                            // Determine target based on viewOnceMode
                            let target;
                            if (botState.settings.viewOnceMode === 'save') {
                                target = botState.ownerID; // Owner's DM
                            } else if (botState.settings.viewOnceMode === 'dm') {
                                target = sender; // User's DM who used .vv
                            } else {
                                target = from; // Current chat (group or DM)
                            }

                            const caption = `🔓 *VIEW-ONCE UNLOCKED* by StarryMD\n\n_Mode: ${botState.settings.viewOnceMode.toUpperCase()}_`;

                            if (quoted.imageMessage) {
                                await sock.sendMessage(target, { image: buffer, caption }, { quoted: msg });
                            } else if (quoted.videoMessage) {
                                await sock.sendMessage(target, { video: buffer, caption }, { quoted: msg });
                            }

                            // Notify user based on where it was sent
                            if (target === botState.ownerID) {
                                await sock.sendMessage(from, { text: "✅ Sent to *Owner's DM* (Saved Messages)." }, { quoted: msg });
                            } else if (target === sender && isGroup) {
                                await sock.sendMessage(from, { text: "✅ Sent to *your DM*." }, { quoted: msg });
                            }
                            return;
                        } catch (err) {
                            utils.log("ERROR", `VV fallback download failed: ${err.message}`);
                            return sock.sendMessage(from, { text: `❌ Failed to download media: ${err.message}` }, { quoted: msg });
                        }
                    }

                    return sock.sendMessage(from, { text: "❌ That is not a View-Once message." }, { quoted: msg });
                }

                // Permission check for non-owners
                if (!isOwner && botState.settings.viewOnceMode === 'private') {
                    return sock.sendMessage(from, { text: "🔐 *VV Unlock is in PRIVATE mode.*\n\nRequest owner to change via `.vvmode general` to allow public access." }, { quoted: msg });
                }

                const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                try {
                    await sock.sendMessage(from, { react: { text: "🔐", key: msg.key } });
                    const buffer = await downloadMediaMessage(
                        { message: voContent },
                        'buffer',
                        {},
                        { reuploadRequest: sock.updateMediaMessage }
                    );

                    if (!buffer) throw new Error("Empty media buffer");

                    // SMART ROUTING LOGIC
                    let target;
                    let effectiveMode = botState.settings.viewOnceMode;

                    if (botState.settings.viewOnceMode === 'save') {
                        // Save mode: Only owner gets it in their DM, others get it in their own DM
                        if (isOwner) {
                            target = botState.ownerID; // Owner's DM
                        } else {
                            target = sender; // User's DM (auto-switch to dm mode)
                            effectiveMode = 'dm (auto)';
                        }
                    } else if (botState.settings.viewOnceMode === 'dm') {
                        target = sender; // User's DM who used .vv
                    } else if (botState.settings.viewOnceMode === 'private') {
                        // Private mode: Owner only, send to their DM
                        target = botState.ownerID;
                    } else {
                        target = from; // Current chat (group or DM)
                    }

                    // SPAM PREVENTION: Check if too many .vv requests in this group
                    if (isGroup && target === sender) {
                        // Initialize VV request tracker if not exists
                        if (!botState.vvRequests) botState.vvRequests = {};
                        if (!botState.vvRequests[from]) botState.vvRequests[from] = [];

                        // Add this request
                        const now = Date.now();
                        botState.vvRequests[from].push(now);

                        // Clean old requests (older than 5 minutes)
                        botState.vvRequests[from] = botState.vvRequests[from].filter(t => now - t < 300000);

                        // If more than 3 requests in last 5 minutes, tell user to DM bot
                        if (botState.vvRequests[from].length > 3) {
                            return sock.sendMessage(from, {
                                text: `⚠️ *Too many VV requests in this group!*

To prevent spam detection, please:
1. DM me privately: wa.me/${config.OWNER_NUMBER?.replace(/[^0-9]/g, '')}
2. Save my contact
3. Return to group and retry command
4. It should save to your DM now

This protects the bot from being flagged. 🛡️`
                            }, { quoted: msg });
                        }
                    }

                    const caption = `🌠 *STARRY VV UNLOCKER* 🔐\n\n_Mode: ${effectiveMode.toUpperCase()}_`;

                    if (voContent.imageMessage) {
                        await sock.sendMessage(target, { image: buffer, caption }, { quoted: msg });
                    } else if (voContent.videoMessage) {
                        await sock.sendMessage(target, { video: buffer, caption }, { quoted: msg });
                    }

                    // SMART NOTIFICATIONS based on who requested and where it was sent
                    if (target === botState.ownerID && !isOwner) {
                        // Non-owner triggered, sent to owner
                        await sock.sendMessage(from, { text: "✅ Media unlocked and sent to *Owner's DM*." }, { quoted: msg });
                    } else if (target === sender && isGroup) {
                        // Sent to user's DM in a group
                        await sock.sendMessage(from, { text: "✅ Media unlocked and sent to *your DM*. Check your private chat with me! 💬" }, { quoted: msg });
                    } else if (target === sender && !isGroup) {
                        // Sent to user's DM but they're already in DM
                        await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    }
                    // If sent to current chat, no notification needed (they see it)

                    utils.log("MEDIA", `VV unlocked for ${pushName} (mode: ${effectiveMode}, target: ${target === botState.ownerID ? 'owner' : target === sender ? 'user DM' : 'chat'})`);
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
                if (args === 'help') {
                    // Show detailed help guide
                    const getHelp = require('./help');
                    await sock.sendMessage(from, { text: getHelp() }, { quoted: msg });
                } else {
                    // Show command menu with banner
                    const menuText = getMenu(botState.mode);
                    const bannerPath = require('path').join(__dirname, '../database/banner.png');

                    if (require('fs').existsSync(bannerPath)) {
                        await sock.sendMessage(from, {
                            image: { url: bannerPath },
                            caption: menuText
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                    }
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
                    await sock.sendMessage(from, { text: `✅ Auto - Bio is now * ${botState.settings.autoBio ? 'ON' : 'OFF'}*.` }, { quoted: msg });
                    return;
                }

                if (cmd === 'vvmode') {
                    const arg = args.toLowerCase().trim();

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
                            text: `📊 *VV MODE CONTROL*

┃ *Current:* ${botState.settings.viewOnceMode.toUpperCase()}
┃
┃ *Usage:* .vvmode <mode>
┃
┃ *Available Modes:*
┃
┃ 🌍 *chat* - Send to current chat
┃    (Public in groups, everyone sees)
┃
┃ 💬 *dm* - Send to user's DM
┃    (Private, only requester gets it)
┃
┃ 💾 *save* - Send to owner's DM
┃    (Owner's Saved Messages only)
┃
┃ 🔒 *private* - Owner only mode
┃    (Only owner can use .vv)
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *Recommended for groups:* \`dm\` or \`private\`` }, { quoted: msg });
                    }

                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, { text: `✅ View-Once mode set to *${botState.settings.viewOnceMode.toUpperCase()}*.` }, { quoted: msg });
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
                        await sock.sendMessage(from, { text: `✅ Manually viewed / liked ${count} statuses from target.` }, { quoted: msg });
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

                        let text = `📜 * VIP STATUS LIST * (${vipList.length}) \n\n`;
                        for (const jid of vipList) {
                            const contactName = botState.contacts[jid]?.name || "Unknown";
                            text += `🌟 ${contactName} (+${jid.split('@')[0]}) \n`;
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
                    await sock.sendMessage(from, { text: `✅ Status Notifications are now * ${enabled ? 'ON' : 'OFF'}*.` }, { quoted: msg });
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

                    let infoStr = `📊 * STATUS SCHEDULER INFO *\n\n`;
                    infoStr += `⏰ * Schedule:* [${settings.schedule.join(', ')}]\n`;
                    infoStr += `⏱️ * Buffer:* ${settings.bufferMin} ms - ${settings.bufferMax} ms\n\n`;
                    infoStr += `📬 * Pending:* ${pendingCount} statuses\n`;
                    infoStr += `👥 * Tracked Posters:* ${posterCount} \n\n`;
                    infoStr += `🔜 * Next Run:* ${nextRun} \n\n`;
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
                    await sock.sendMessage(from, { text: `✅ Status Buffer updated: ${parts[0]} ms - ${parts[1]} ms` }, { quoted: msg });
                    return;
                }

                if (cmd === 'alpha' || cmd === 'statbatch') {
                    await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
                    const { key: loadingKey } = await sock.sendMessage(from, {
                        text: "🌀 *ALPHA PROTOCOL*\n\n⏳ Scanning status database..."
                    }, { quoted: msg });

                    try {
                        const count = await status.processStatuses(sock);
                        const resultStr = `✅ *ALPHA PROTOCOL COMPLETE*\n\n` +
                            `📊 *Processed:* ${count} statuses\n` +
                            `🕐 *Finished:* ${new Date().toLocaleTimeString()}\n` +
                            `✨ *Status:* Operational\n` +
                            `╰━━━━━━━━━━━━━━`;

                        await sock.sendMessage(from, { text: resultStr, edit: loadingKey });
                    } catch (error) {
                        utils.log("ERROR", `Alpha Protocol Error: ${error.message}`);
                        await sock.sendMessage(from, {
                            text: `❌ *ALPHA PROTOCOL ERROR*\n\n${error.message}\n\nPlease check the logs.`
                        }, { edit: loadingKey });
                    }
                    return;
                }

                if (cmd === 'statusinfo') {
                    const statusSettings = status.getSettings();
                    const pendingCount = status.getPendingCount();
                    const lastRun = botState.lastStatusRun ? new Date(botState.lastStatusRun).toLocaleString() : 'Never';

                    const infoStr = `📊 * STATUS BOT INTEL *\n\n` +
                        `⏰ * Schedule:* ${statusSettings.schedule.map(h => h + ':00').join(', ')} \n` +
                        `⏱️ * Buffer:* ${statusSettings.bufferMin} ms - ${statusSettings.bufferMax} ms\n` +
                        `📦 * Pending:* ${pendingCount} statuses\n` +
                        `🕐 * Last Run:* ${lastRun} \n` +
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

                    let requestStr = `📝 * FEATURE REQUESTS * (🆔 ${requests.length}) \n\n`;
                    const recent = requests.slice(-10).reverse(); // Last 10, newest first

                    recent.forEach((req, index) => {
                        const date = new Date(req.timestamp).toLocaleString();
                        requestStr += `${requests.length - index}. * ${req.name}*\n`;
                        requestStr += `   💬 ${req.request} \n`;
                        requestStr += `   🕐 ${date} \n\n`;
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

                    let logStr = `📜 * RECENT LOGS * (Last 50) \n\n`;
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

                    let statsStr = `📊 * STATUS STATISTICS *\n\n👥 Total Posters: ${Object.keys(botState.statusPosters).length} \n\n`;

                    sorted.forEach(([jid, data], index) => {
                        const lastPosted = data.lastPosted ? new Date(data.lastPosted).toLocaleDateString() : 'Unknown';
                        statsStr += `${index + 1}. * ${data.name}*\n`;
                        statsStr += `   📸 ${data.count} posts\n`;
                        statsStr += `   🕐 Last: ${lastPosted} \n\n`;
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
                    await sock.sendMessage(from, { text: `✅ Reaction added: * ${keyword}* ➾ ${emoji} ` }, { quoted: msg });
                    return;
                }

                if (cmd === 'delreact') {
                    const keyword = args.toLowerCase().trim();
                    if (!keyword) return sock.sendMessage(from, { text: "❌ Usage: .delreact <keyword>" }, { quoted: msg });

                    if (botState.reactions[keyword]) {
                        const emoji = botState.reactions[keyword];
                        delete botState.reactions[keyword];
                        fs.writeJsonSync("./database/reactions.json", botState.reactions);
                        await sock.sendMessage(from, { text: `✅ Reaction removed: * ${keyword}* (was ${emoji})` }, { quoted: msg });
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
                        listStr += `┃ * ${kw}* ➾ ${emj} \n`;
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
                    await sock.sendMessage(from, { text: `✅ * REQUEST LOGGED *\n\n📝 Your feature request has been recorded.\n🆔 Request #${requests.length} ` }, { quoted: msg });
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
                        return sock.sendMessage(from, { text: `❌ Invalid page number.Use 1 - ${totalPages} ` }, { quoted: msg });
                    }

                    const startIndex = (page - 1) * perPage;
                    const endIndex = startIndex + perPage;

                    let contactList = `📂 * CONTACT DATABASE *\n\n📊 Total: ${contactCount} contacts\n📄 Page: ${page}/${totalPages}\n\n`;
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
