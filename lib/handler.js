const fs = require('fs-extra');
const path = require('path');
const dbManager = require('./db-manager');
const config = require('../config');
const utils = require('./utils');
const getMenu = require('./menu');
const status = require('./status');
const aiFeatures = require('./ai-features');
const adminCommands = require('./admin-commands');
const adminPermissions = require('./admin-permissions');
const stickerLab = require('./sticker-lab');
const socialLab = require('./social-lab');
const audioLab = require('./audio-lab');
const imageTools = require('./image-tools');


const infoZone = require('./info-zone');
const funZone = require('./fun-zone');
const gameZone = require('./game-zone');
const economy = require('./economy');
const economyBasic = require('./economy-basic');
const economyActivities = require('./economy-activities');
const economyShop = require('./economy-shop');
const economyWorld = require('./economy-world');
const economyBilling = require('./economy-billing');
const economyCards = require('./economy-cards');
const economyGame = require('./economy-game');
const economyTasks = require('./economy-tasks');
const economySocial = require('./economy-social');
const economyJustice = require('./economy-justice');
const economyCrypto = require('./economy-crypto');
const economyStock = require('./economy-stock');
const help = require('./help');
const restricted = require('./restricted');
const sessionManager = require('./session-manager');
const searchSession = require('./search-session');
const router = require('./router');
const aiController = require('./controllers/ai-controller');
const economyController = require('./controllers/economy-controller');

/* 
 * Message Handler 2.0 (Neural Link)
 */
module.exports = async (msg, sock, botState) => {
    if (!msg || !msg.key || !msg.key.remoteJid) {
        return; // Ignore invalid messages
    }
    const from = utils.decodeJid(msg.key.remoteJid);

    // Initialize bannedChats if missing (Lazy Load)
    if (!botState.bannedChats) {
        try {
            botState.bannedChats = require('fs-extra').readJsonSync('./database/banned.json', { throws: false }) || [];
        } catch (e) {
            botState.bannedChats = [];
        }
    }
    const isGroup = from.endsWith('@g.us');
    const isMe = msg.key.fromMe;
    const pushName = msg.pushName || "User";

    // Extract Body (with safety checks for edge cases)
    const body = (msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        "").trim();

    // 🌟 INTERACTIVE SEARCH LISTENER
    // Matches: "1", "10", "1 video", "5 audio", etc.
    const selectionMatch = body.match(/^([1-9]|10)\s*(v|video|a|audio)?$/i);

    if (selectionMatch) {
        const index = parseInt(selectionMatch[1]);
        const type = (selectionMatch[2] || "").toLowerCase();

        const sender = msg.key.participant || from;
        const selectionObj = searchSession.getSelection(sender, index);

        if (selectionObj) {
            const { data, provider } = selectionObj;
            utils.log("DEBUG", `[Handler] Interactive selection: ${provider} -> ${data.title}`);

            // ROUTING BASED ON PROVIDER

            // 1. TikTok
            if (provider === 'tiktok') {
                // Directly send the video data stored in session
                return socialLab.sendTikTokVideo(msg, sock, data);
            }

            // 1.5 TikTok User Selection
            if (provider === 'tiktok-user') {
                // Trigger profile fetch for selected user
                return socialLab.handleTikTok(msg, sock, botState, ['@' + data.unique_id]);
            }

            // 2. YouTube (Default)
            if (provider === 'youtube') {
                if (type === 'v' || type === 'video') {
                    return audioLab.handleVideo(msg, sock, botState, data.url);
                } else {
                    return audioLab.handlePlay(msg, sock, botState, data.url);
                }
            }

            // 3. Pinterest Fallback
            if (provider === 'pinterest-fallback') {
                if (index === 1) {
                    return socialLab.handlePinterestFallback(msg, sock, botState, data);
                } else if (index === 2) {
                    return sock.sendMessage(from, { text: "✅ Cancelled." }, { quoted: msg });
                }
            }
        }
    }


    const rawSender = isMe ? sock.user.id : (isGroup ? msg.key.participant : from);
    const sender = utils.decodeJid(rawSender);
    // Dynamic owner check: fromMe, JID match, or botState ownerID match
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = isMe ||
        (sender && typeof sender === 'string' && ownerIds.some(id => sender.includes(id))) ||
        (sender === botState.ownerID) ||
        (sender === utils.decodeJid(sock.user.id));



    // Bot's JID for mention detection
    const selfJid = utils.decodeJid(sock.user.id);
    const botJid = selfJid; // Use selfJid for botJid
    const botNumber = botJid.split('@')[0];
    const isQuoted = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
    const isMentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botJid) ||
        body.toLowerCase().includes(`@${botNumber}`) ||
        body.toLowerCase().includes('@starry') ||
        isQuoted;

    // --- 0. BLACKLIST ENFORCEMENT (Auto-Delete) ---
    // If sender OR group is banned, delete message and IGNORE completely
    if (botState.bannedChats.includes(sender) || botState.bannedChats.includes(from)) {
        // Only attempt delete if not me (sanity check)
        if (!isMe) {
            try {
                // Delete the message
                await sock.sendMessage(from, { delete: msg.key });
                utils.log("BAN", `Deleted message from banned user: ${sender}`);
            } catch (e) {
                // Might fail if not admin or msg too old, but we still ignore processing
            }
        }
        return; // STOP execution
    }

    // --- 1. MINIMAL MONITORING ---
    if (!isMe) {
        utils.log("INFLOW", `Msg from ${pushName} (${sender}): "${body.slice(0, 20)}..."`);
    }

    // DEBUG: Log view-once messages for structure analysis (including from owner)
    if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension) {
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
                const ownerIds = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                for (const ownerId of ownerIds) {
                    try {
                        await sock.sendMessage(ownerId, {
                            text: `🆕 *NEW STATUS POSTER*\n\n👤 ${posterName}\n📱 ${posterJid.split('@')[0]}\n\n_Just posted their first status!_\n_Reply .vs to view immediately_`
                        });
                    } catch (e) {
                        utils.log("WARN", `Failed to notify owner ${ownerId}: ${e.message}`);
                    }
                }
            }
        }

        await status.saveStatus(msg, sock);
        return;
    }

    // --- 4. ANTI-LINK ENGINE (Group Security) ---
    if (isGroup && !isMe && botState.groupSettings[from]?.antilink && body.includes('chat.whatsapp.com')) {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);
        const isAdmin = adminPermissions.isAdmin(sender, groupMetadata);

        if (!isAdmin && !isOwner) {
            const mode = botState.groupSettings[from].antilinkMode || 'kick';
            utils.log("SECURITY", `Anti-Link triggered in ${from} by ${sender}. Mode: ${mode}`);

            if (mode === 'kick') {
                await sock.sendMessage(from, { text: `🛡️ *ANTI-LINK SYSTEM*\n\nUser @${sender.split('@')[0]} has been removed for sending a group link.`, mentions: [sender] });
                await sock.groupParticipantsUpdate(from, [sender], 'remove');
                return; // Stop processing
            } else if (mode === 'warn') {
                // Route to warning system
                await adminCommands.handleGroupCommand(msg, sock, botState, 'warn', `@${sender.split('@')[0]} Anti-Link violation`, isOwner);
                await sock.sendMessage(from, { delete: msg.key }); // Delete the link anyway
                return;
            } else if (mode === 'delete') {
                await sock.sendMessage(from, { delete: msg.key });
                return;
            }
        }
    }

    // --- 5. AUTO-REACTION PROTOCOL (Keyword Detection) ---
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
            // Async save to prevent blocking
            dbManager.save("./database/contacts.json", botState.contacts);

            // Time-Aware Greeting
            const hour = new Date().getHours();
            let greeting = "Hello";
            if (hour < 12) greeting = "Good Morning";
            else if (hour < 18) greeting = "Good Afternoon";
            else greeting = "Good Evening";

            // Artificial Delay for "Human" feel (3-6s)
            const delay = Math.floor(Math.random() * 3000) + 3000;
            await utils.delay(delay);

            // Simulate "Recording Audio" to fake out the user or show hesitation
            await sock.sendPresenceUpdate('recording', from); // Shows "Recording audio..."
            await utils.delay(4000); // Record for 4s
            await sock.sendPresenceUpdate('paused', from); // Stop recording

            const vcard = require('./vcard').getOwnerVCard(config.OWNER_NAME || "Starry Owner", config.OWNER_ID);

            // Send VCard
            await sock.sendMessage(from, {
                contacts: {
                    displayName: config.OWNER_NAME || "Starry Owner",
                    contacts: [{ vcard }]
                }
            });

            // Follow up text
            await sock.sendMessage(from, { text: `${greeting}! 🌠 Saving my contact ensures you see my status updates.\n\n(Ignore if already saved!)` });
            return;
        }
    }

    // --- GUARDIAN PROTOCOL (Security) ---
    // Ensure permissions are defined
    let isAdmin = false;
    let isBotAdmin = false;

    if (isGroup) {
        try {
            const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);
            isAdmin = adminPermissions.isAdmin(sender, groupMetadata);
            // Calculate Bot Admin Status
            const botJid = utils.decodeJid(sock.user.id);
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
            isBotAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');
        } catch (e) {
            // utils.log("WARN", `Failed to load metadata for ${from}: ${e.message}`);
        }
    }

    const guardian = require('./guardian');
    // Pass isTool || isSys as "isCmd" (Normal chat vs Command)
    const isGuardianBlocked = await guardian.check(msg, sock, isGroup, isAdmin, isBotAdmin, (isTool || isSys));
    if (isGuardianBlocked) return;

    if (isTool || isSys || isMentioned) {
        const currentPrefix = isSys ? pSys : pTool;
        const isCmd = isTool || isSys;

        const cmd = isCmd ? body.slice(currentPrefix.length).trim().split(/\s+/)[0].toLowerCase() : "";
        const argsStr = isCmd ? body.slice(currentPrefix.length + cmd.length).trim() : body.trim();
        const args = argsStr.split(/\s+/).filter(a => a !== "");

        // DEBUG: Trace Owner Check
        if (cmd === 'eval') {
            const configuredOwner = config.OWNER_ID;
            utils.log("DEBUG", `Eval Check - Sender: ${sender}, ConfigOwner: ${configuredOwner}, isOwner: ${isOwner}`);
            if (!isOwner) {
                return sock.sendMessage(from, { text: `❌ *ACCESS DENIED*\n\nYour JID: \`${sender}\`\nOwner JID: \`${configuredOwner}\`\n\n_Update .env or config.js if this is incorrect._` }, { quoted: msg });
            }
        }


        // --- ROUTER CHECK (Command Separation) ---
        // If the command is restricted to specific groups, enforce it here.
        if (isCmd && !isOwner) { // Owners bypass restrictions
            const routeStatus = await router.checkRoute(cmd, from);
            if (!routeStatus.allowed) {
                // SILENCE CHECK: Only warn if we are in a known Starry Group
                // If we are in a random/unrelated group, just ignore the command entirely.
                if (router.isKnownGroup(from)) {
                    const redirect = routeStatus.redirect;
                    const linkText = redirect.inviteLink ? `\n🔗 *Join here:* ${redirect.inviteLink}` : "";

                    await sock.sendMessage(from, {
                        text: `⚠️ *Wrong Channel!*\n\nPlease use the *${currentPrefix}${cmd}* command in *${redirect.groupName || "the correct group"}*.${linkText}`
                    }, { quoted: msg });
                }
                return; // STOP execution (Silent or Warned)
            }
        }

        // --- JAIL SYSTEM MIDDLEWARE ---
        // If user is jailed, they can only use .bail or .escape (and maybe .status)
        // They cannot rob, work, or play games.
        const userProfile = await economy.getUserProfile(sender);
        if (userProfile.jail_until && userProfile.jail_until > Date.now()) {
            const allowedCommands = ['bail', 'escape', 'status', 'help'];
            if (!allowedCommands.includes(cmd)) {
                const timeLeft = economy.formatTime(userProfile.jail_until - Date.now());
                return sock.sendMessage(from, {
                    text: `🔒 *ACCESS DENIED - PRISONER*\n\nYou are currently serving time in the Starry Penitentiary.\n\n⏳ *Release:* ${timeLeft}\n\n*Options:* \`.bail\` (Pay) or \`.escape\` (Risk)`
                }, { quoted: msg });
            }
        }

        // --- RPG REGISTRATION GUARD ---
        const RPG_COMMANDS = [
            'work', 'daily', 'mine', 'dig', 'fish', 'hunt',
            'buy', 'shop', 'bank', 'bal',
            'balance', 'loan', 'dep', 'deposit',
            'with', 'withdraw', 'inventory', 'inv',
            'sell', 'heal', 'use', 'guide', 'map', 'rules', 'travel',
            'diamond', 'purge', 'rob', 'steal', 'arrest', 'drone', 'remote'
        ];

        if (RPG_COMMANDS.includes(cmd)) {
            const economy = require('./economy');
            if (!economy.isRegistered(sender) && cmd !== 'spawn') {
                const unregMsg = `🚫 *UNREGISTERED ENTITY*\n\nYou have not entered the Starry Multiverse yet.\nType *.spawn* to create your character and receive your Starter Pack.`;
                return sock.sendMessage(from, { text: unregMsg }, { quoted: msg });
            }

            // --- PASSIVE BILLING ENGINE (Interest, Upkeep) ---
            const billingReport = await economyBilling.processBilling(sender);
            if (billingReport) {
                let billMsg = `🧾 *GALACTIC BILLING STATEMENT*\n\nCycles Passed: ${billingReport.cycles}\n🏘️ *Upkeep:* $${billingReport.upkeep.toLocaleString()}\n💸 *Loan Interest:* $${billingReport.interestAdded.toLocaleString()}\n\n`;

                if (billingReport.paymentSuccess) {
                    billMsg += `✅ *STATUS:* Settled automatically from Bank/Wallet.`;
                } else if (billingReport.totalDeduction > 0) {
                    billMsg += `⚠️ *STATUS:* Payment Failed. Unpaid debt has been added to your Account. Clearing it is MANDATORY to avoid asset seizure.`;
                    // Debt is already increased in processBilling if payment fails? No, let's check.
                    // Actually, let's just make the debt increase here to be safe and clear.
                    const user = await economy.getUserProfile(sender);
                    user.financials.debt += billingReport.totalDeduction;
                    await economy.saveDB();
                }

                // Send to DM for privacy
                await sock.sendMessage(sender, { text: billMsg });
            }
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

            // 3. New Configurable Rate Limiting (The Shield 2.0)
            const rateLimit = require('./rate-limit');
            const limitCheck = rateLimit.check(sender, cmd);

            if (!limitCheck.allowed) {
                // If "warn" is true, it means we should send a text warning (first offense in this block/day)
                if (limitCheck.warn) {
                    let warnText = "";
                    if (limitCheck.reason === 'daily') {
                        warnText = `🛑 *DAILY LIMIT REACHED*\n\nYou have used your daily allowance for \`.${cmd}\`.\nResets in: ${economy.formatTime(limitCheck.timeLeft)}`;
                    } else {
                        // Rate limit (cooldown)
                        const waitTime = Math.ceil(limitCheck.timeLeft / 1000);
                        warnText = `⏳ *Slow Down!* Please wait ${waitTime}s before using \`.${cmd}\` again.`;
                        if (limitCheck.timeLeft > 60000) {
                            warnText = `⏳ *Cooldown Active* \n\nPlease wait ${economy.formatTime(limitCheck.timeLeft)} before using \`.${cmd}\` again.`;
                        }
                    }
                    await sock.sendMessage(from, { text: warnText }, { quoted: msg });
                } else {
                    // Subsequent spam -> Silent or Reaction
                    await sock.sendMessage(from, { react: { text: "🤫", key: msg.key } });
                }
                return; // STOP execution
            }
        }

        // --- CHAOS EVENT TRIGGER (RNG) ---
        // Restricted to Gameplay Groups (Frontier, Battlefield, Casino)
        const GAMEPLAY_GROUPS = [
            '120363423775743301@g.us', // Frontier
            '120363423737042736@g.us', // Battlefield
            '120363423669487608@g.us'  // Casino
        ];

        if (isGroup && GAMEPLAY_GROUPS.includes(from)) {
            const diamondEvent = await economyGame.processDiamondEvent(sock, from);
            if (diamondEvent) {
                const broadcastMsg = `💎 *CHAOS DIAMOND DETECTED* 💎\n\nA massive energy signature has appeared on * ${diamondEvent.location}* !\n\nValue: $${diamondEvent.value.toLocaleString()}\nExpires: 30 Minutes\n\n*Type .diamond on that planet to claim it!*`;
                // Broadcast to current group/chat (Simulated global alert)
                await sock.sendMessage(from, { text: broadcastMsg });
            }
        }

        // --- 5. COMING SOON INTERCEPTOR ---
        const comingSoonCommands = []; // All tools are now being unleashed or have placeholders
        if (comingSoonCommands.includes(cmd)) {
            await sock.sendMessage(from, { text: `⏳ *${cmd.toUpperCase()}* protocol is currently in development.` }, { quoted: msg });
            return;
        }

        // --- 5. NEURAL AI & VISION (Delegated) ---
        if (await aiController.handleAI(msg, sock, botState, cmd, args, body, isMentioned, isOwner)) return;

        // Security Group Command: Anti-Link Toggle (.antilink on/off)
        if (cmd === 'antilink') {
            if (!isGroup) return sock.sendMessage(from, { text: "❌ Group command only." }, { quoted: msg });
            if (!isAdmin) return sock.sendMessage(from, { text: "❌ Admin command only." }, { quoted: msg });
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ I need Admin privileges to enforce Anti-Link!" }, { quoted: msg });

            const guardian = require('./guardian');
            const newState = args[0] === 'on';
            guardian.toggleAntiLink(from, newState);

            return sock.sendMessage(from, { text: `🛡️ *Anti-Link Protocol* \n\nStatus: ${newState ? '✅ ENABLED' : '🔴 DISABLED'}\n\n_Note: I will delete any links sent by non-admins._` }, { quoted: msg });
        }

        // Public Command: Player Census, Cooldowns, Investors, Crypto, Forex, Temp Mail, etc.
        if (await economyController.handleEconomy(msg, sock, botState, cmd, args)) return;

        // Public Command: Temp Mail (.tempmail)
        if (cmd === 'tempmail' || cmd === 'tm' || cmd === 'mail') {
            const tempMail = require('./temp-mail');
            // If the user pasted "email id" as args, we need to handle that carefully
            // The handler splits args by space, so args[0] is email, args[1] is id. This matches our logic.
            return tempMail.handleTempMail(msg, sock, botState, args);
        }

        // Public Command: Temp SMS (.tempsms)
        if (cmd === 'tempsms' || cmd === 'tempsms' || cmd === 'sms') {
            const tempSms = require('./temp-sms');
            return tempSms.handleTempSms(msg, sock, botState, args);
        }

        // Public Command: Test Album (.testalbum)
        if (cmd === 'testalbum') {
            await sock.sendMessage(from, { text: "📸 *Sending Album...*" }, { quoted: msg });
            const sampleImages = [
                { url: 'https://files.catbox.moe/p9t9u8.jpeg', caption: 'Image 1' },
                { url: 'https://files.catbox.moe/8381c0.jpeg', caption: 'Image 2' },
                { url: 'https://files.catbox.moe/3p0g1h.jpg', caption: 'Image 3' }
            ];
            await utils.sendAlbum(sock, from, sampleImages, { quoted: msg });
            return;
        }


        // Utility: Get JID (.jid / .id / .ginfo)
        if (cmd === 'jid' || cmd === 'id' || cmd === 'ginfo') {
            const chatJid = from;
            const senderJid = sender;

            let text = `🆔 *ID INFO*\n\n`;
            text += `👤 *You:* \`${senderJid}\`\n`;
            text += `📍 *Chat:* \`${chatJid}\``;

            if (isGroup) {
                text += `\n\n📋 *CONFIG SNIPPET*\n_Copy this into command-router.json:_`;

                let groupName = "Unknown";
                let inviteLink = "";

                try {
                    const metadata = await sock.groupMetadata(from);
                    groupName = metadata.subject;

                    // Try to get invite link (needs admin)
                    try {
                        const code = await sock.groupInviteCode(from);
                        inviteLink = `https://chat.whatsapp.com/${code}`;
                    } catch (e) {
                        inviteLink = "BOT_NEEDS_ADMIN_FOR_LINK";
                    }

                    // --- LOG TO TEMP FILE ---
                    try {
                        const dumpPath = './temp/groups_dump.json';
                        await fs.ensureDir('./temp');

                        let currentDump = {};
                        try {
                            currentDump = await fs.readJSON(dumpPath);
                        } catch (err) {
                            currentDump = {};
                        }

                        currentDump[groupName] = {
                            id: chatJid,
                            name: groupName,
                            description: metadata.desc ? metadata.desc.toString() : "No Description",
                            inviteLink: inviteLink,
                            dumpedAt: new Date().toISOString()
                        };

                        await fs.writeJSON(dumpPath, currentDump, { spaces: 2 });
                        text += `\n\n✅ _Saved to temp/groups_dump.json_`;

                    } catch (logErr) {
                        utils.log("ERROR", `Failed to log JID dump: ${logErr.message}`);
                    }
                    // ------------------------

                } catch (e) {
                    groupName = "Error Fetching Metadata";
                }

                const configSnippet = {
                    allowedGroups: [chatJid],
                    groupName: groupName,
                    inviteLink: inviteLink
                };

                text += `\n\n\`\`\`json\n${JSON.stringify(configSnippet, null, 2)}\n\`\`\``;
            }

            return sock.sendMessage(from, { text }, { quoted: msg });
        }




        // 1. TOOL & SYSTEM COMMANDS
        if (isCmd) {
            // Public Command: Ping
            if (cmd === 'ping' || cmd === 'p') {
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
                return audioLab.handleYTS(msg, sock, botState, argsStr);
            }

            // Audio Lab: Play (.play / .song)
            if (cmd === 'play' || cmd === 'song') {
                return audioLab.handlePlay(msg, sock, botState, argsStr);
            }

            // Audio Lab: Video (.video / .ytv)
            if (cmd === 'video' || cmd === 'ytv') {
                return audioLab.handleVideo(msg, sock, botState, argsStr);
            }

            // Public Command: TikTok Downloader (.tt)
            if (cmd === 'tt' || cmd === 'tiktok') {
                return socialLab.handleTikTok(msg, sock, botState, args);
            }

            // Public Command: Instagram Downloader (.ig)
            if (cmd === 'ig' || cmd === 'insta' || cmd === 'instagram') {
                return socialLab.handleInstagram(msg, sock, botState, args);
            }

            // Public Command: Pinterest (.pint)
            if (cmd === 'pint' || cmd === 'pinterest') {
                return socialLab.handlePinterest(msg, sock, botState, args);
            }

            // Audio Lab: Voice Note (.tovn)
            if (cmd === 'tomp3' || cmd === 'mp3') {
                return audioLab.handleToAudio(msg, sock, botState);
            }

            if (cmd === 'tovn') {
                return audioLab.handleToVN(msg, sock, botState);
            }

            // Audio Lab: Speed (.fast / .slow)
            if (cmd === 'fast' || cmd === 'slow') {
                return audioLab.handleSpeed(msg, sock, botState, cmd);
            }

            // Audio Lab: Custom Speed (.speed <value>)
            if (cmd === 'speed') {
                return audioLab.handleCustomSpeed(msg, sock, botState, args);
            }

            // Audio Lab: Filters (.bass / .deep / .nightcore / .reverse etc.)
            const audioFilters = ['bass', 'deep', 'high', 'nightcore', 'blown', 'earrape', 'reverse', 'echo', 'tremolo'];
            if (audioFilters.includes(cmd)) {
                return audioLab.handleFilter(msg, sock, botState, cmd, args);
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

            // Image Tools: Filters (.circle, .blur, .invert)
            if (cmd === 'circle' || cmd === 'blur' || cmd === 'invert') {
                return imageTools.handleFilter(msg, sock, botState, cmd);
            }

            // --- GAME ZONE ---
            if (cmd === 'ttt') {
                return gameZone.handleTicTacToe(msg, sock, botState, args);
            }
            if (cmd === 'move') {
                return gameZone.handleMove(msg, sock, botState, args);
            }
            if (cmd === 'gamble') {
                return gameZone.handleGamble(msg, sock, botState, args);
            }
            if (cmd === 'coinflip') {
                return gameZone.handleCoinflip(msg, sock, botState, args);
            }
            if (cmd === 'slot') {
                return gameZone.handleSlot(msg, sock, botState, args);
            }
            if (cmd === 'roulette') {
                return gameZone.handleRoulette(msg, sock, botState, args);
            }
            if (cmd === 'bj' || cmd === 'blackjack') {
                return gameZone.handleBlackjack(msg, sock, botState, args);
            }
            if (cmd === 'hit') {
                return gameZone.handleHit(msg, sock, botState);
            }
            if (cmd === 'stand') {
                return gameZone.handleStand(msg, sock, botState);
            }
            if (cmd === 'bet') {
                return gameZone.handleGamble(msg, sock, botState, args);
            }
            if (cmd === 'duel') {
                return gameZone.handleDuel(msg, sock, botState, args);
            }
            if (cmd === 'accept') {
                return gameZone.handleAcceptDuel(msg, sock, botState);
            }
            if (cmd === 'reject') {
                return gameZone.handleRejectDuel(msg, sock, botState);
            }

            // --- SUB-BOT HOSTING (Dynamic Sessions) ---
            if (cmd === 'host' || cmd === 'clone' || cmd === 'deploy') {
                if (isGroup) return sock.sendMessage(from, { text: "❌ Please use this command in DM to keep your pairing code private." }, { quoted: msg });

                // Allow user to specify phone number
                let targetPhone = args[0] ? args[0].replace(/[^0-9]/g, "") : null;

                if (!targetPhone) {
                    return sock.sendMessage(from, { text: "⚠️ *Missing Phone Number*\n\nPlease specify the number you want to host.\nUsage: `.host <number>`\nExample: `.host 2348012345678`" });
                }

                // Default to using sender's number ONLY if they explicitly asked for "me" or similar? 
                // No, sticking to safe usage prompt is better to avoid accidental self-cloning logic errors.

                if (targetPhone.startsWith('0')) {
                    return sock.sendMessage(from, { text: "⚠️ *Format Error*\n\nPlease use the **International Format** (e.g., 23481...) without the leading '0' or '+'.\n\nExample: `.host 2348012345678`" });
                }

                if (targetPhone.length < 10) {
                    return sock.sendMessage(from, { text: "❌ Invalid phone number. Usage: `.host <number>` (e.g. .host 2349012345678)" });
                }

                // Check if session already exists for this user (Simple limit: 1 per user for now)
                const sessionId = `user_${targetPhone}`;
                const existing = sessionManager.getSession(sessionId);

                if (existing) {
                    return sock.sendMessage(from, { text: "⚠️ You already have an active bot session running!" });
                }

                await sock.sendMessage(from, { text: `🚀 *Deploying Starry Clone...*\n\nTarget: +${targetPhone}\n\nPlease wait for the Pairing Code.` });

                // Start Session
                const newSock = await sessionManager.startSession(sessionId, {
                    usePairingCode: true,
                    phoneNumber: targetPhone,
                    owner: sender,
                    onPairingCode: async (code) => {
                        await sock.sendMessage(from, { text: `🔑 *YOUR PAIRING CODE IS:*` });
                        await utils.delay(500); // Ensure order
                        await sock.sendMessage(from, { text: code }); // Clean code only
                        await utils.delay(500);
                        await sock.sendMessage(from, { text: `_Enter this in WhatsApp > Linked Devices > Link with phone number_` });

                        // ALERT OWNER
                        if (config.OWNER_ID) {
                            const ownerIds = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                            const alertMsg = `🚀 *NEW CLONE DEPLOYED*\n\n👤 *User:* ${pushName} (+${targetPhone})\n🆔 *Session:* ${sessionId}\n⏰ *Time:* ${new Date().toLocaleTimeString()}`;
                            for (const ownerId of ownerIds) {
                                await sock.sendMessage(ownerId, { text: alertMsg });
                            }
                        }
                    },
                    onMessage: (m, s) => {
                        // Forward basic commands to main handler? 
                        // Or recursing handler(m, s, botState)?
                        // CAUTION: Recursion might share botState! 
                        // Ideally sub-bots should have their own isolated state or minimal handler.
                        // For now, let's just log.
                        // utils.log("SUB", `Message on ${sessionId}`);
                    }
                });

                if (!newSock) {
                    return sock.sendMessage(from, { text: "❌ Failed to start session. Check console/logs." });
                }
                return;
            }

            // --- CLONE MANAGEMENT (Owner & User) ---

            if (cmd === 'listclones' && isOwner) {
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

            if (cmd === 'stopbot' || cmd === 'shutdown') {
                const sessionId = `user_${sender.split('@')[0]}`;
                // Owner can target specific ID
                const targetId = (isOwner && args[0]) ? args[0] : sessionId;

                const existing = sessionManager.getSession(targetId);
                if (!existing && targetId === sessionId) { // Only complain if deleting own non-existent bot
                    return sock.sendMessage(from, { text: "❌ You don't have a running bot session." });
                } else if (!existing) {
                    return sock.sendMessage(from, { text: `❌ Session ${targetId} not found.` });
                }

                await sessionManager.stopSession(targetId);

                // ALERT OWNER (if not owner action)
                if (config.OWNER_ID && !isOwner) {
                    const ownerIds = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                    for (const ownerId of ownerIds) {
                        await sock.sendMessage(ownerId, { text: `🛑 *CLONE STOPPED*\n\nUser: ${pushName}\nID: ${targetId}` });
                    }
                }
                return sock.sendMessage(from, { text: `🛑 Session ${targetId} stopped (Data preserved).` });
            }

            if (cmd === 'logout' || cmd === 'delbot') {
                const sessionId = `user_${sender.split('@')[0]}`;
                // Owner can target specific ID
                const targetId = (isOwner && args[0]) ? args[0] : sessionId;

                if (!isOwner && targetId !== sessionId) return; // Prevent user from deleting others

                // Confirm if data exists (even if not running)
                const deleted = await sessionManager.deleteSession(targetId);

                if (deleted) {
                    await sock.sendMessage(from, { text: `🗑️ *Session Deleted*\n\n${targetId} has been logged out and data removed.` });
                    // ALERT OWNER (if not owner action)
                    if (config.OWNER_ID && !isOwner) {
                        const ownerIds = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                        for (const ownerId of ownerIds) {
                            await sock.sendMessage(ownerId, { text: `🗑️ *CLONE DELETED*\n\nUser: ${pushName}\nID: ${targetId}` });
                        }
                    }
                } else {
                    return sock.sendMessage(from, { text: `❌ Could not find/delete session data for ${targetId}.` });
                }
                return;
            }

            // --- ADMIN SUITE ---
            if ([
                'kick', 'add', 'promote', 'demote', 'tempmod', 'group', 'setname',
                'link', 'admins', 'tagall', 'hidetag', 'warn', 'unwarn', 'warnings',
                'antilink', 'welcome', 'goodbye', 'setwelcome', 'setgoodbye',
                'testwelcome', 'testgoodbye', 'bcast'
            ].includes(cmd)) {
                return adminCommands.handleGroupCommand(msg, sock, botState, cmd, args, isOwner);
            }

            // --- PHASE 4: INFO, FUN & GAMES ---

            // Info Zone (Phase 4 & 6)
            if ([
                'lyrics', 'wiki', 'wikipedia', 'weather', 'pint', 'pinterest', 'define', 'google', 'shorten',
            ].includes(cmd)) {
                if (cmd === 'lyrics') return infoZone.handleLyrics(msg, sock, botState, argsStr);
                if (cmd === 'wiki' || cmd === 'wikipedia') return infoZone.handleWiki(msg, sock, botState, argsStr);
                if (cmd === 'weather') return infoZone.handleWeather(msg, sock, botState, argsStr);
                if (cmd === 'pint' || cmd === 'pinterest') return infoZone.handlePint(msg, sock, botState, argsStr);
                if (cmd === 'define') return infoZone.handleDefine(msg, sock, botState, argsStr);
                if (cmd === 'google') return infoZone.handleGoogle(msg, sock, botState, argsStr);
                if (cmd === 'shorten') return infoZone.handleShorten(msg, sock, botState, argsStr);
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
            if (['ttt', 'tictactoe', 'move', 'gamble', 'coinflip', 'slot', 'chess', 'c4', 'connect4', 'monopoly', 'm', 'roll', 'buyprop'].includes(cmd)) {
                if (cmd === 'move') return gameZone.handleMove(msg, sock, botState, args[0]);
                if (cmd === 'gamble') return gameZone.handleGamble(msg, sock, botState, args);

                // Smart Routing for .bet
                if (cmd === 'bet') {
                    // Check for mention or Reply
                    const target = utils.parseTarget(msg, args);
                    if (target) {
                        return gameZone.handleDuel(msg, sock, botState, args);
                    } else {
                        return gameZone.handleGamble(msg, sock, botState, args);
                    }
                }
                if (cmd === 'coinflip') return gameZone.handleCoinflip(msg, sock, botState, args);
                if (cmd === 'slot') return gameZone.handleSlot(msg, sock, botState, args);

                // New Games
                if (cmd === 'chess') return gameZone.handleChess(msg, sock, botState, args);
                if (['c4', 'connect4'].includes(cmd)) return gameZone.handleConnect4(msg, sock, botState, args);
                if (['monopoly', 'm'].includes(cmd)) return gameZone.handleMonopoly(msg, sock, botState, args);
                if (['roll', 'buyprop', 'endturn'].includes(cmd)) return gameZone.handleGameAction(msg, sock, botState, cmd);

                return gameZone.handleTicTacToe(msg, sock, botState, args);
            }

            // Economy System
            if (['balance', 'bal', 'spawn', 'guide', 'rules', 'map', 'update', 'travel', 'loan', 'diamond'].includes(cmd)) {
                if (cmd === 'spawn') return economyBasic.handleSpawn(msg, sock, botState, args);
                if (cmd === 'guide' || cmd === 'rules') return economyBasic.handleGuide(msg, sock, botState, args);
                if (cmd === 'map') return economyBasic.handleMap(msg, sock, botState);
                if (cmd === 'travel') {
                    const economyWorld = require('./economy-world');
                    return economyWorld.handleTravel(msg, sock, botState, args);
                }
                if (cmd === 'update') return economyBasic.handleUpdateAlert(msg, sock, botState);
                if (cmd === 'loan') return economyBasic.handleLoan(msg, sock, botState);
                // rob command moved to economy-social to avoid duplicate logic
                if (cmd === 'diamond') return economyGame.claimDiamond(msg, sock, botState);
                return economyBasic.handleBalance(msg, sock, botState);
            }
            if (cmd === 'purge' && isOwner) {
                const p = economyGame.startPurge(60);
                return sock.sendMessage(from, { text: `🚨 *THE PURGE HAS BEGUN* 🚨\n\nAll crime laws are suspended for 60 minutes.\nRobbery defense multipliers are NULLIFIED.` });
            }
            if (cmd === 'daily') {
                return economyBasic.handleDaily(msg, sock, botState);
            }
            if (cmd === 'work') {
                return economyBasic.handleWork(msg, sock, botState);
            }
            if (['deposit', 'dep'].includes(cmd)) {
                return economyBasic.handleDeposit(msg, sock, botState);
            }
            if (['withdraw', 'with'].includes(cmd)) {
                return economyBasic.handleWithdraw(msg, sock, botState);
            }

            // Economy Activities
            if (cmd === 'fish') {
                return economyActivities.handleFish(msg, sock, botState);
            }
            if (cmd === 'mine' || cmd === 'dig') {
                return economyActivities.handleMine(msg, sock, botState);
            }
            if (cmd === 'hunt') {
                return economyActivities.handleHunt(msg, sock, botState);
            }

            // Economy Shop & Inventory
            if (cmd === 'shop') {
                return economyShop.handleShop(msg, sock, botState);
            }
            if (cmd === 'buy') {
                return economyShop.handleBuy(msg, sock, botState, args);
            }
            if (cmd === 'inventory' || cmd === 'inv') {
                return economyShop.handleInventory(msg, sock, botState);
            }
            if (['tasks', 'mission', 'goals'].includes(cmd)) {
                return economyTasks.handleTasks(msg, sock, botState);
            }
            if (cmd === 'claim') {
                return economyTasks.handleClaim(msg, sock, botState, args);
            }
            if (cmd === 'sell') {
                return economyShop.handleSell(msg, sock, botState, args);
            }
            if (cmd === 'heal') {
                return economyShop.handleHeal(msg, sock, botState);
            }
            if (cmd === 'use') {
                return economyShop.handleUse(msg, sock, botState, args);
            }


            // Economy Crypto & Investment
            if (cmd === 'crypto') {
                return economyCrypto.handleCrypto(msg, sock, botState);
            }
            if (cmd === 'buycrypto') {
                return economyCrypto.handleBuy(msg, sock, botState, args);
            }
            if (cmd === 'sellcrypto') {
                return economyCrypto.handleSell(msg, sock, botState, args);
            }
            if (cmd === 'convert') {
                return economyCrypto.handleConvert(msg, sock, botState, args);
            }
            // Financial Advisor (AI)
            if (cmd === 'advisor' || cmd === 'forecast') {
                const economyAdvisor = require('./economy-advisor');
                return economyAdvisor.handleAdvisor(msg, sock, botState, args);
            }

            if (['stock', 'stocks', 'invest'].includes(cmd)) {
                return economyStock.handleStock(msg, sock, botState);
            }
            if (cmd === 'buystock') {
                return economyStock.handleBuy(msg, sock, botState, args);
            }
            if (cmd === 'sellstock') {
                return economyStock.handleSell(msg, sock, botState, args);
            }

            // Economy Social & Leaderboards
            if (cmd === 'rob') {
                return economyActivities.handleRob(msg, sock, botState, args);
            }
            if (cmd === 'drone' || cmd === 'remote') {
                return economyActivities.handleDroneRob(msg, sock, botState);
            }
            if (cmd === 'gift') {
                return economySocial.handleGift(msg, sock, botState, args);
            }
            if (cmd === 'leaderboard' || cmd === 'lb') {
                return economySocial.handleLeaderboard(msg, sock, botState);
            }
            if (cmd === 'profile') {
                return economySocial.handleProfile(msg, sock, botState, args);
            }
            if (cmd === 'setbio') {
                return economySocial.handleSetBio(msg, sock, botState, args);
            }
            if (cmd === 'setname') {
                return economySocial.handleSetName(msg, sock, botState, args);
            }
            if (cmd === 'name' || cmd === 'regname') {
                return economySocial.handleSetName(msg, sock, botState, args);
            }


            if (cmd === 'bio') {
                return economySocial.handleSetBio(msg, sock, botState, args);
            }
            if (cmd === 'rich' || cmd === 'richlist' || cmd === 'elite') {
                return economySocial.handleRichList(msg, sock, botState);
            }
            if (cmd === 'investors' || cmd === 'protrader') {
                return economySocial.handleInvestorLeaderboard(msg, sock, botState);
            }
            if (cmd === 'census' || cmd === 'users' || cmd === 'players') {
                return economySocial.handleCensus(msg, sock, botState);
            }

            if (cmd === 'titles' || cmd === 'title') {
                return economySocial.handleTitles(msg, sock, botState);
            }

            if (cmd === 'equip') {
                return economySocial.handleEquip(msg, sock, botState, args);
            }

            // Public Command: Sticker (Media Forge)
            if (cmd === 'sticker' || cmd === 's') {
                return stickerLab.handleSticker(msg, sock, botState, args);
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

            // Public Command: Ghost Protocol (Anti-Delete Monitor)
            if (cmd === 'ghost' || cmd === 'hunted') {
                if (!botState.settings.huntedChats) botState.settings.huntedChats = [];

                const action = args[0] ? args[0].toLowerCase().trim() : "";

                // List ghosted chats
                if (action === 'list') {
                    if (botState.settings.huntedChats.length === 0) {
                        return sock.sendMessage(from, {
                            text: "👻 *GHOST LIST*\n\n_No chats are being monitored._\n\n💡 Use `.ghost` in a chat to start monitoring."
                        }, { quoted: msg });
                    }

                    let text = `👻 *GHOST LIST* (${botState.settings.huntedChats.length})\n\n`;
                    for (const chatId of botState.settings.huntedChats) {
                        const chatName = botState.contacts[chatId]?.name || chatId.split('@')[0];
                        const isCurrentChat = chatId === from;
                        text += `${isCurrentChat ? '📍' : '🔍'} ${chatName}\n`;
                    }
                    text += `\n💡 Use \`.ghost\` in a chat to toggle monitoring.`;
                    return sock.sendMessage(from, { text }, { quoted: msg });
                }

                // Owner-only check for groups
                if (isGroup && !isOwner) {
                    return sock.sendMessage(from, {
                        text: "❌ Only the owner can initiate Ghost Protocol in groups."
                    }, { quoted: msg });
                }

                // Toggle monitor for current chat
                const isHunted = botState.settings.huntedChats.includes(from);

                if (isHunted) {
                    // Disable monitor
                    botState.settings.huntedChats = botState.settings.huntedChats.filter(id => id !== from);
                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, {
                        text: "🔓 *GHOST DISABLED*\n\nThis chat is no longer being monitored for deleted messages.\n\n💡 Use `.ghost list` to see all monitored chats."
                    }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } });
                } else {
                    // Enable monitor
                    botState.settings.huntedChats.push(from);
                    fs.writeJsonSync("./database/bot_settings.json", botState.settings);
                    await sock.sendMessage(from, {
                        text: "👻 *GHOST ACTIVATED*\n\nThis chat is now being monitored. Deleted messages will be forwarded to you.\n\n_Use `.ghost` again to disable._"
                    }, { quoted: msg });
                    await sock.sendMessage(from, { react: { text: "👻", key: msg.key } });
                }
                return;
            }

            // Owner Command: Reveal Deleted Message
            if (cmd === 'reveal') {
                if (!isOwner) return;
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                const quotedText = contextInfo?.quotedMessage?.conversation ||
                    contextInfo?.quotedMessage?.extendedTextMessage?.text || "";

                // Extract delete ID from quoted message
                const idMatch = quotedText.match(/🔑 \*ID:\* (del_\d+_[a-z0-9]+)/);

                if (!idMatch) {
                    return sock.sendMessage(from, {
                        text: "❌ Please quote a 👻 *Ghost Alert* message to reveal the deleted content."
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

            // Owner Command: Set Ghost Buffer Duration
            if (cmd === 'ghostbuffer' || cmd === 'huntbuffer') {
                if (!isOwner) return;
                const minutes = utils.parseNumber(args[0]);

                if (!minutes || minutes < 1 || minutes > 60) {
                    const currentMinutes = Math.floor((config.GHOST_BUFFER_MS || 600000) / 60000);
                    return sock.sendMessage(from, {
                        text: `⏱️ *GHOST BUFFER SETTINGS*\n\n` +
                            `📊 *Current:* ${currentMinutes} minutes\n\n` +
                            `*Usage:* .ghostbuffer <minutes>\n` +
                            `*Range:* 1-60 minutes\n\n` +
                            `*Example:* .ghostbuffer 15`
                    }, { quoted: msg });
                }

                config.GHOST_BUFFER_MS = minutes * 60000;

                await sock.sendMessage(from, {
                    text: `✅ *GHOST BUFFER UPDATED*\n\n` +
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
                    args.length > 2
                );

                if (isQuestion) {
                    // Use AI-powered dynamic help
                    return aiFeatures.handleDynamicHelp(msg, sock, botState, args);
                }

                // Use normal help
                return sock.sendMessage(from, {
                    text: utils.autoReadMore(getHelp(args[0] || 'all'))
                }, { quoted: msg });
            }

            // --- GAME ARCADE ---
            if (['ttt', 'move', 'bet', 'duel', 'accept', 'reject', 'gamble', 'coinflip', 'coin', 'slot', 'slots'].includes(cmd)) {
                if (cmd === 'ttt') {
                    if (args[0]?.toLowerCase() === 'stop') return gameZone.handleTicTacToe(msg, sock, botState, ['stop']);
                    return gameZone.handleTicTacToe(msg, sock, botState, args);
                }
                if (cmd === 'move') return gameZone.handleMove(msg, sock, botState, args[0]);
                if (cmd === 'bet' || cmd === 'duel') return gameZone.handleDuel(msg, sock, botState, args);
                if (cmd === 'accept') return gameZone.handleAcceptDuel(msg, sock, botState);
                if (cmd === 'reject') return gameZone.handleRejectDuel(msg, sock, botState);
                if (cmd === 'gamble') return gameZone.handleGamble(msg, sock, botState, args);
                if (cmd === 'coinflip' || cmd === 'coin') return gameZone.handleCoinflip(msg, sock, botState, args);
                if (cmd === 'slot' || cmd === 'slots') return gameZone.handleSlot(msg, sock, botState, args);
            }

            // --- FUN ZONE ---
            if (['ship', 'match', 'gaycheck', 'truth', 'dare', '8ball'].includes(cmd)) {
                if (cmd === 'ship') return funZone.handleShip(msg, sock, botState);
                if (cmd === 'match') return funZone.handleMatch(msg, sock, botState);
                if (cmd === 'gaycheck') return funZone.handleGayCheck(msg, sock, botState);
                if (cmd === 'truth') return funZone.handleTruth(msg, sock);
                if (cmd === 'dare') return funZone.handleDare(msg, sock);
                if (cmd === '8ball') return funZone.handle8Ball(msg, sock, botState, args.join(' '));
            }

            // --- ADMIN SUITE (RE-LINKED) ---
            const adminCategory = [
                'kick', 'add', 'promote', 'demote',
                'warn', 'unwarn', 'warnings',
                'group', 'setname', 'link', 'admins',
                'tagall', 'hidetag',
                'antilink', 'welcome', 'goodbye', 'tempmod',
                'treasury', 'giveaway'
            ];

            if (adminCategory.includes(cmd)) {
                return adminCommands.handleGroupCommand(msg, sock, botState, cmd, args, isOwner);
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

 *SYSTEM STATS*

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
                    const routing = args[0] && args[0].toLowerCase() === 'me' ? 'me' : 'dm';
                    const target = routing === 'me' ? sock.decodeJid(sock.user.id) : from;

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
                const saveName = argsStr || (quoted ? (contextInfo.pushName || "Saved User") : pushName);

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

            // Command: .upload (Media Saver) -> Redirect to Upload Manager
            if (cmd === 'upload' || cmd === 'savefile') {
                const uploadManager = require('./upload-manager');
                return uploadManager.handleUpload(msg, sock, botState, args);
            }

            // Command: .uploads / .listuploads
            if (cmd === 'uploads' || cmd === 'listuploads' || cmd === 'ls') {
                const uploadManager = require('./upload-manager');
                return uploadManager.handleList(msg, sock, botState, args);
            }

            // Command: .getupload / .get
            if (cmd === 'getupload' || cmd === 'get') {
                const uploadManager = require('./upload-manager');
                return uploadManager.handleGet(msg, sock, botState, args);
            }

            // Command: .delete / .delupload
            if (cmd === 'delete' || cmd === 'del' || cmd === 'delupload') {
                const uploadManager = require('./upload-manager');
                return uploadManager.handleDelete(msg, sock, botState, args);
            }

            // Command: .mkdir / .createfolder
            if (cmd === 'mkdir' || cmd === 'createfolder') {
                const uploadManager = require('./upload-manager');
                return uploadManager.handleCreateFolder(msg, sock, botState, args);
            }

            // Command: .url / .tourl (stored file)
            if (cmd === 'url' || cmd === 'web') {
                const uploadManager = require('./upload-manager');
                return uploadManager.handleUrlize(msg, sock, botState, args);
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

            // --- JUSTICE SYSTEM ---
            if (cmd === 'arrest') {
                return economyJustice.handleArrest(msg, sock, botState, args);
            }
            if (cmd === 'bail') {
                return economyJustice.handleBail(msg, sock, botState);
            }
            if (cmd === 'escape') {
                return economyJustice.handleEscape(msg, sock, botState);
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
                    await sock.sendMessage(from, { text: utils.autoReadMore(getHelp()) }, { quoted: msg });
                } else {
                    // Show command menu with banner
                    const menuText = getMenu(botState.mode);
                    const bannerPath = require('path').join(__dirname, '../database/banner.png');

                    if (require('fs').existsSync(bannerPath)) {
                        await sock.sendMessage(from, {
                            image: { url: bannerPath },
                            caption: utils.autoReadMore(menuText)
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: utils.autoReadMore(menuText) }, { quoted: msg });
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

                    try {
                        await sock.updateProfileStatus(newBio);
                        await sock.sendMessage(from, { text: "✅ Custom Bio set, saved, and applied immediately." }, { quoted: msg });
                    } catch (e) {
                        utils.log("ERROR", `Failed to apply bio: ${e.message}`);
                        await sock.sendMessage(from, { text: "✅ Bio saved but failed to apply immediately. It will sync later." }, { quoted: msg });
                    }
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
                    if (isGroup) {
                        return sock.sendMessage(from, { text: "❌ The `.vs` command is restricted to DMs only to prevent spam." }, { quoted: msg });
                    }
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
                    else if (args.length > 0) {
                        const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (mentionedJid) {
                            targetJid = mentionedJid;
                        } else {
                            // Handle raw number arg
                            const number = args.join("").replace(/[^0-9]/g, '');
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
                    const [action, ...target] = args;

                    if (action === 'list') {
                        const vipList = status.getVipList();
                        if (vipList.length === 0) return sock.sendMessage(from, { text: "📜 *VIP STATUS LIST*\n\n_No VIPs configured._" }, { quoted: msg });

                        let text = `📜 * VIP STATUS LIST * (${vipList.length}) \n\n`;
                        for (const jid of vipList) {
                            const contactName = botState.contacts[jid]?.name || "Unknown";
                            const cleanJid = (typeof jid === 'string') ? jid.split('@')[0] : "invalid";
                            text += `🌟 ${contactName} (+${cleanJid}) \n`;
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

                if (cmd === 'statnotify' || cmd === 'statusnotify') {
                    const arg = args[0]?.toLowerCase() || "";
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
                    const schedule = Array.isArray(settings.schedule) ? settings.schedule : [];
                    const nextHour = schedule.find(h => h > currentHour) || schedule[0];
                    const nextRun = (nextHour !== undefined)
                        ? (nextHour > currentHour ? `Today ${nextHour}:00` : `Tomorrow ${nextHour}:00`)
                        : "Not Scheduled";

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
                    const hours = args.join("").split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23);
                    if (hours.length === 0) return sock.sendMessage(from, { text: "❌ Usage: .setsched 9,12,14,15,18,21" }, { quoted: msg });

                    status.updateSettings({ statusSchedule: hours });
                    await sock.sendMessage(from, { text: `✅ Status Schedule updated: [${hours.join(', ')}]` }, { quoted: msg });
                    return;
                }

                if (cmd === 'setbuffer') {
                    const parts = args.map(p => parseInt(p.trim())).filter(p => !isNaN(p));
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

                // --- LOG COMMANDS (OWNER ONLY) ---

                // 1. List Logs (.logs)
                if (cmd === 'logs') {
                    if (!isOwner) return;
                    const dbDir = path.join(__dirname, '../database');
                    const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.log'));

                    let text = "📜 *AVAILABLE LOGS*\n\n";
                    files.forEach(f => text += `• ${f} (${(fs.statSync(path.join(dbDir, f)).size / 1024).toFixed(2)} KB)\n`);
                    text += `\n_Use .log <name> to view_`;

                    await sock.sendMessage(from, { text }, { quoted: msg });
                    return;
                }

                // 2. View Log (.log)
                if (cmd === 'log') {
                    if (!isOwner) return;
                    const dbDir = path.join(__dirname, '../database');
                    let targetLog = argsStr.trim();

                    if (!targetLog) {
                        targetLog = utils.sessionName ? `${utils.sessionName}.log` : 'bot.log';
                    }

                    if (!targetLog.endsWith('.log')) targetLog += '.log';

                    const logPath = path.join(dbDir, targetLog);

                    if (!fs.existsSync(logPath)) {
                        return sock.sendMessage(from, { text: `❌ Log file not found: ${targetLog}` }, { quoted: msg });
                    }

                    const content = fs.readFileSync(logPath, 'utf8');
                    const lines = content.split('\n');
                    const snippet = lines.length > 20 ? lines.slice(-20).join('\n') : content;

                    await sock.sendMessage(from, { text: `📜 *LOG VIEW: ${targetLog}*\n\n${snippet}` }, { quoted: msg });
                    return;
                }

                // 3. Eval (.eval)
                if (cmd === 'eval' || cmd === '>') {
                    if (!isOwner) return;

                    try {
                        let code = argsStr;
                        // Async Eval Wrapper
                        let evaled = await (async () => {
                            return eval(code);
                        })();

                        if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);

                        await sock.sendMessage(from, { text: `💻 *EVAL OUTPUT*\n\n${evaled}` }, { quoted: msg });
                    } catch (err) {
                        await sock.sendMessage(from, { text: `❌ *EVAL ERROR*\n\n${err.message}` }, { quoted: msg });
                    }
                    return;
                }

                // --- VIEW RECENT LOGS (Simplified Alias) ---
                if (cmd === 'recentlogs') {
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
                        const cleanJid = (typeof jid === 'string') ? jid.split('@')[0] : "invalid";
                        contactList += `${globalIndex}. *${data.name}*\n   📱 ${cleanJid}\n`;
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
                        // 1. Native Block
                        await sock.updateBlockStatus(userToBlock, 'block');

                        // 2. Add to Blacklist Database (if not already there)
                        if (!botState.bannedChats.includes(userToBlock)) {
                            botState.bannedChats.push(userToBlock);
                            fs.writeJsonSync("./database/banned_chats.json", botState.bannedChats);
                        }

                        const cleanUserJid = (typeof userToBlock === 'string') ? userToBlock.split('@')[0] : "invalid";
                        const { key: confirmKey } = await sock.sendMessage(from, {
                            text: `🚫 *USER BLOCKED & BLACKLISTED*\n\nTarget: @${cleanUserJid}\n\n_Their messages will now be auto-deleted in groups where I am admin._`,
                            mentions: [userToBlock]
                        }, { quoted: msg });

                        setTimeout(async () => {
                            await sock.sendMessage(from, { delete: confirmKey });
                        }, 5000);
                    } catch (e) {
                        utils.log("ERROR", `Block failed: ${e.message}`);
                        await sock.sendMessage(from, { text: `❌ Failed to block user: ${e.message}` }, { quoted: msg });
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
                        // 1. Native Unblock
                        await sock.updateBlockStatus(userToUnblock, 'unblock');

                        // 2. Remove from Blacklist Database
                        botState.bannedChats = botState.bannedChats.filter(id => id !== userToUnblock);
                        fs.writeJsonSync("./database/banned_chats.json", botState.bannedChats);

                        const cleanUserJid = (typeof userToUnblock === 'string') ? userToUnblock.split('@')[0] : "invalid";
                        const { key: confirmKey } = await sock.sendMessage(from, {
                            text: `✅ *USER UNBLOCKED*\n\nTarget: @${cleanUserJid}\n\n_They can now interact with the bot again._`,
                            mentions: [userToUnblock]
                        }, { quoted: msg });

                        setTimeout(async () => {
                            await sock.sendMessage(from, { delete: confirmKey });
                        }, 5000);
                    } catch (e) {
                        utils.log("ERROR", `Unblock failed: ${e.message}`);
                        await sock.sendMessage(from, { text: `❌ Failed to unblock user: ${e.message}` }, { quoted: msg });
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
                        const cleanUserJid = (typeof userToReport === 'string') ? userToReport.split('@')[0] : "invalid";
                        const { key: confirmKey } = await sock.sendMessage(from, { text: `⚠️ Reported & Blocked @${cleanUserJid}`, mentions: [userToReport] }, { quoted: msg });

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

            // --- 5.5 MODE COMMAND (.mode) ---
            if (cmd === 'mode') {
                if (!isOwner) return sock.sendMessage(from, { text: "❌ Owner only command." }, { quoted: msg });
                const targetMode = args[0]?.toLowerCase();
                const password = args[1];

                if (!targetMode) {
                    return sock.sendMessage(from, {
                        text: "🎮 *MODE SWITCHER*\n\nUsage: .mode <public|private|sleep|goon> [password]\n\nCurrent: " + botState.mode
                    }, { quoted: msg });
                }

                if (targetMode === 'public') {
                    botState.mode = '$public';
                    await sock.sendMessage(from, { text: "🟢 *MODE UPDATED:* Public Pulse Active." }, { quoted: msg });
                    return;
                }
                if (targetMode === 'private') {
                    botState.mode = '$private';
                    await sock.sendMessage(from, { text: "👻 *MODE UPDATED:* Stealth Mode Active." }, { quoted: msg });
                    return;
                }
                if (targetMode === 'sleep') {
                    botState.mode = '$sleep';
                    await sock.sendMessage(from, { text: "💤 *MODE UPDATED:* Sleep Mode Active." }, { quoted: msg });
                    return;
                }
                if (targetMode === 'goon') {
                    if (password === config.GOON_PASSWORD) {
                        botState.mode = '$goon';
                        await sock.sendMessage(from, { text: "😈 *ACCESS GRANTED:* Goon Mode Activated." }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: "❌ *DENIED:* Critical Password Verification Failed." }, { quoted: msg });
                    }
                    return;
                }

                return sock.sendMessage(from, { text: "❌ Unknown mode. Options: public, private, sleep, goon" });
            }

            // --- 5. GOON MODE (RESTRICTED COMMANDS) ---
            if (botState.mode === '$goon') {
                await restricted(sock, msg, from, cmd, args, botState);
            }

            // --- 6. SYSTEM PREFIX COMMANDS ($) ---
            if (isSys && isOwner) {
                // EVAL COMMAND ($eval)
                if (cmd === 'eval' || cmd === 'ev') {
                    if (!args) return sock.sendMessage(from, { text: "❌ Code required!" }, { quoted: msg });

                    try {
                        // Async Eval Wrapper
                        let evaled = await (async () => {
                            return eval(args);
                        })();

                        if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
                        return sock.sendMessage(from, { text: `✅ *EVAL OUTPUT*\n\n\`\`\`javascript\n${evaled}\n\`\`\`` }, { quoted: msg });
                    } catch (err) {
                        return sock.sendMessage(from, { text: `❌ *EVAL ERROR*\n\n\`\`\`javascript\n${err.message}\n\`\`\`` }, { quoted: msg });
                    }
                }

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
                if (cmd === 'goon') {
                    const password = args.trim();
                    if (password === config.GOON_PASSWORD) {
                        botState.mode = '$goon';
                        await sock.sendMessage(from, { text: "😈 *ACCESS GRANTED:* Goon Mode Activated." }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: "❌ *DENIED:* Critical Password Verification Failed." }, { quoted: msg });
                    }
                    return;
                }
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

    }
};
