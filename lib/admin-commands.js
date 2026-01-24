const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const utils = require('./utils');
const adminPermissions = require('./admin-permissions');
const economy = require('./economy');

const WARNS_DB = path.join(__dirname, '../database/warns.json');
const SETTINGS_DB = path.join(__dirname, '../database/group_settings.json');
const BANNED_DB = path.join(__dirname, '../database/banned.json');

/* 
 * Admin Commands Module 2.0 (Hardened)
 * Fully rewritten for maximum compatibility and multi-device support.
 */

// --- UTILS ---
// Local getTarget removed in favor of utils.parseTarget

// --- HANDLERS ---

/* 
 * Member Management: Kick, Add, Promote, Demote
 */
const handleMemberAction = async (msg, sock, botState, cmd, targetJid, isOwner) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    if (!targetJid) return sock.sendMessage(from, { text: "❌ Please mention or quote a user!" }, { quoted: msg });

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);
        const sender = sock.decodeJid(msg.key.participant || from);

        // Security Gate
        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can use this command!" }, { quoted: msg });
        }

        // Bot Status Check
        if (!adminPermissions.isBotAdmin(sock.decodeJid(sock.user.id), groupMetadata)) {
            return sock.sendMessage(from, { text: "❌ I need to be an admin to perform this action!" }, { quoted: msg });
        }

        // Protection Check (Don't kick/demote admins or owners)
        const ownerJids = (config.OWNER_ID || "").toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
        if ((cmd === 'kick' || cmd === 'demote') && adminPermissions.isProtected(targetJid, groupMetadata, ownerJids)) {
            return sock.sendMessage(from, { text: "🛡️ *PROTECTION ACTIVE*\n\nI cannot act against an admin or the owner." }, { quoted: msg });
        }

        let responseText = "";
        switch (cmd) {
            case 'kick':
                await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                responseText = `👋 *EXILED*\n\nUser @${targetJid.split('@')[0]} has been removed from the group.`;
                break;
            case 'add':
                await sock.groupParticipantsUpdate(from, [targetJid], 'add');
                responseText = `🤝 *WELCOME*\n\nUser @${targetJid.split('@')[0]} has been added to the group.`;
                break;
            case 'promote':
                await sock.groupParticipantsUpdate(from, [targetJid], 'promote');
                responseText = `🎖️ *PROMOTED*\n\nUser @${targetJid.split('@')[0]} is now an admin!`;
                break;
            case 'demote':
                await sock.groupParticipantsUpdate(from, [targetJid], 'demote');
                responseText = `📉 *DEMOTED*\n\nUser @${targetJid.split('@')[0]} has been stripped of admin powers.`;
                break;
        }

        await sock.sendMessage(from, { text: responseText, mentions: [targetJid] }, { quoted: msg });

        // Refresh Metadata
        botState.groupMetadata[from] = await sock.groupMetadata(from);

    } catch (err) {
        utils.log("ERROR", `Member Action [${cmd}] Failed: ${err.message}`);
        await sock.sendMessage(from, { text: `❌ Action failed: ${err.message}` }, { quoted: msg });
    }
};

/* 
 * Temporary Admin Management (.tempmod)
 */
const handleTempMod = async (msg, sock, botState, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const sender = sock.decodeJid(msg.key.participant || from);
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = ownerIds.some(id => sender.includes(id));

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        // Only real admins or owner can grant temp admin
        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, 'tempmod', isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage temporary moderators!" }, { quoted: msg });
        }

        const target = utils.parseTarget(msg, args);
        if (!target) return sock.sendMessage(from, { text: "❌ Mention or quote a user to make them a temp mod!" }, { quoted: msg });

        // Parse duration (default 1h)
        const durStr = args.split(' ').find(a => /^\d+[mhd]$/.test(a)) || "1h";
        const duration = adminPermissions.parseDuration(durStr);

        if (!duration) {
            return sock.sendMessage(from, { text: "❌ Invalid duration! Use formats like 30m, 2h, or 1d." }, { quoted: msg });
        }

        const grant = adminPermissions.grantTempAdmin(target, from, sender, duration, 'all');
        const expiresStr = new Date(grant.expiresAt).toLocaleString();

        const response = `🛡️ *TEMPORARY MODERATOR GRANTED*\n\n` +
            `👤 *User:* @${target.split('@')[0]}\n` +
            `⏰ *Duration:* ${durStr}\n` +
            `📅 *Expires:* ${expiresStr}\n\n` +
            `_They now have access to all admin commands until expiration._`;

        await sock.sendMessage(from, { text: response, mentions: [target] }, { quoted: msg });
        utils.log("ADMIN", `Temp Mod granted to ${target} in ${from} by ${sender}`);

    } catch (err) {
        utils.log("ERROR", `TempMod Failed: ${err.message}`);
        await sock.sendMessage(from, { text: `❌ Failed to grant temp mod.` }, { quoted: msg });
    }
};

/* 
 * Group Control: Set Name, Settings, Links, Admin List
 */
const handleGroupControl = async (msg, sock, botState, cmd, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const sender = sock.decodeJid(msg.key.participant || from);
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = ownerIds.some(id => sender.includes(id));

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage group settings!" }, { quoted: msg });
        }

        switch (cmd) {
            case 'setname':
                if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Provide a new name for the group!" }, { quoted: msg });
                const newName = args.join(' ');
                await sock.groupUpdateSubject(from, newName);
                await sock.sendMessage(from, { text: `✅ Group name updated to: *${args}*` }, { quoted: msg });
                break;

            case 'group':
                if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: `.group open` or `.group close`" }, { quoted: msg });
                const action = args[0].toLowerCase().trim();
                if (action === 'open' || action === 'unlock') {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await sock.sendMessage(from, { text: "🔓 *GROUP OPENED*\n\nAll members can now send messages." });
                } else if (action === 'close' || action === 'lock') {
                    await sock.groupSettingUpdate(from, 'announcement');
                    await sock.sendMessage(from, { text: "🔒 *GROUP CLOSED*\n\nOnly admins can now send messages." });
                } else {
                    await sock.sendMessage(from, { text: "❌ Usage: `.group open` or `.group close`" }, { quoted: msg });
                }
                break;

            case 'link':
                const code = await sock.groupInviteCode(from);
                const link = `https://chat.whatsapp.com/${code}`;
                await sock.sendMessage(from, {
                    text: `🔗 *GROUP INVITE LINK*\n\n${link}\n\n_Note: Anyone with this link can join the group._`
                }, { quoted: msg });
                break;

            case 'admins':
                const admins = groupMetadata.participants
                    .filter(p => p.admin)
                    .map(p => `@${p.id.split('@')[0]}`);
                await sock.sendMessage(from, {
                    text: `🛡️ *GROUP ADMINS (${admins.length})*\n\n${admins.join('\n')}`,
                    mentions: groupMetadata.participants.filter(p => p.admin).map(p => p.id)
                }, { quoted: msg });
                break;
        }

        // Refresh metadata
        botState.groupMetadata[from] = await sock.groupMetadata(from);

    } catch (err) {
        utils.log("ERROR", `Group Control [${cmd}] Failed: ${err.message}`);
        await sock.sendMessage(from, { text: `❌ Action failed: ${err.message}` }, { quoted: msg });
    }
};

/* 
 * Broadcast Tools: Tag All, Hide Tag
 */
const handleBroadcast = async (msg, sock, botState, cmd, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const sender = sock.decodeJid(msg.key.participant || from);
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = ownerIds.some(id => sender.includes(id));

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can use broadcast tools!" }, { quoted: msg });
        }

        const participants = groupMetadata.participants.map(p => p.id);
        const messageText = args || "Ping!";

        if (cmd === 'tagall') {
            let tagText = `📢 *ATTENTION EVERYONE*\n\n*Message:* ${messageText}\n\n`;
            participants.forEach(id => {
                tagText += `@${id.split('@')[0]} `;
            });
            await sock.sendMessage(from, { text: tagText.trim(), mentions: participants }, { quoted: msg });
        }
        else if (cmd === 'hidetag') {
            const isQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (isQuoted) {
                // Forward the quoted message with hidden mentions
                const quotedContext = msg.message.extendedTextMessage.contextInfo;
                const quotedMsg = quotedContext.quotedMessage;

                // Determine message type (image, video, sticker, text)
                // We construct a specific forwarding object
                let forwardContent = {};

                if (quotedMsg.conversation) forwardContent = { text: quotedMsg.conversation };
                else if (quotedMsg.extendedTextMessage) forwardContent = { text: quotedMsg.extendedTextMessage.text };
                else if (quotedMsg.imageMessage) forwardContent = { image: quotedMsg.imageMessage, caption: quotedMsg.imageMessage.caption || "" };
                else if (quotedMsg.videoMessage) forwardContent = { video: quotedMsg.videoMessage, caption: quotedMsg.videoMessage.caption || "" };
                else if (quotedMsg.stickerMessage) forwardContent = { sticker: quotedMsg.stickerMessage };
                else {
                    // Fallback for unhandled types or complicated forwards -> just send text if provided
                    if (messageText) forwardContent = { text: messageText };
                    else return sock.sendMessage(from, { text: "❌ Unsupported message type for hidetag forwarding." }, { quoted: msg });
                }

                await sock.sendMessage(from, {
                    ...forwardContent,
                    mentions: participants
                });

            } else {
                // No quote, just text
                if (!messageText) return sock.sendMessage(from, { text: "❌ Please quote a message or provide text to hidetag!" }, { quoted: msg });
                await sock.sendMessage(from, { text: messageText, mentions: participants });
            }
        }

        // Clean up command trigger to keep chat tidy
        try {
            await sock.sendMessage(from, { delete: msg.key });
        } catch (e) {
            // Might fail if not admin or msg already gone
        }

    } catch (err) {
        utils.log("ERROR", `Broadcast [${cmd}] Failed: ${err.message}`);
    }
};

/* 
 * Global Broadcast System (.bcast)
 */
const handleGlobalBroadcast = async (msg, sock, botState, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const isGroup = from.endsWith('@g.us');
    const sender = sock.decodeJid(msg.key.participant || from);

    // Robust Owner Check (MATCHES HANDLER.JS)
    const isMe = msg.key.fromMe;
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = isMe ||
        (sender && typeof sender === 'string' && ownerIds.some(id => sender.includes(id))) ||
        (botState.ownerID && sender === botState.ownerID) ||
        (sock.user && sender === sock.decodeJid(sock.user.id));

    // If no args, assume it's a message unless specific keywords used
    const subCmd = args && args.length > 0 ? args[0].toLowerCase().trim() : '';

    // 1. Join Broadcast (Group Admins or Owner)
    if (subCmd === 'on' || subCmd === 'register') {
        if (!isGroup) return sock.sendMessage(from, { text: "❌ Group only command." });

        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);
        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, 'bcast', isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can register for broadcasts!" });
        }

        if (!botState.settings.broadcastList) botState.settings.broadcastList = [];
        if (botState.settings.broadcastList.includes(from)) {
            return sock.sendMessage(from, { text: "🔔 This group is already registered for official updates." });
        }

        botState.settings.broadcastList.push(from);
        fs.writeJsonSync("./database/bot_settings.json", botState.settings);
        return sock.sendMessage(from, { text: "✅ *BROADCAST SYSTEM ACTIVATED*\n\nThis group will now receive official Starry MD updates and announcements." });
    }

    // 2. Leave Broadcast
    if (subCmd === 'off' || subCmd === 'unregister') {
        if (!isGroup) return sock.sendMessage(from, { text: "❌ Group only command." });

        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);
        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, 'bcast', isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can unregister!" });
        }

        if (!botState.settings.broadcastList) return sock.sendMessage(from, { text: "❌ This group is not registered." });

        botState.settings.broadcastList = botState.settings.broadcastList.filter(id => id !== from);
        fs.writeJsonSync("./database/bot_settings.json", botState.settings);
        return sock.sendMessage(from, { text: "🔕 *BROADCAST SYSTEM DEACTIVATED*\n\nYou will no longer receive official updates." });
    }

    // 3. Send Broadcast (Owner Only)
    if (!isOwner) return sock.sendMessage(from, { text: "❌ Owner only command." });
    if (!args) return sock.sendMessage(from, { text: "❌ Usage: `.bcast <message>`" });

    const targetGroups = botState.settings.broadcastList || [];
    if (targetGroups.length === 0) {
        return sock.sendMessage(from, {
            text: "❌ *BROADCAST FAILED*\n\nNo groups have registered for official updates yet. Use `.bcast register` in a group chat to join the network."
        });
    }

    await sock.sendMessage(from, { text: `🚀 *SENDING GLOBAL BROADCAST*\n\nTargeting *${targetGroups.length}* groups...` });

    let success = 0;
    let fail = 0;

    const messageContent = args.join(' ');
    const broadText = `🌌 *STARRY MD OFFICIAL BROADCAST* 🌌\n\n${messageContent}\n\n_Sent by Owner_`;

    for (const groupJid of targetGroups) {
        try {
            await sock.sendMessage(groupJid, { text: broadText });
            success++;
            await utils.delay(2000); // 2s stagger to avoid rate limits
        } catch (e) {
            fail++;
            utils.log("ERROR", `Broadcast failed for ${groupJid}: ${e.message}`);
        }
    }

    await sock.sendMessage(from, { text: `📊 *BROADCAST RESULTS*\n\n✅ Success: ${success}\n❌ Failed: ${fail}` });
};

/* 
 * Warning System: Warn, Unwarn, List Warnings
 */
const handleWarnings = async (msg, sock, botState, cmd, targetJid, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const sender = sock.decodeJid(msg.key.participant || from);
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = ownerIds.some(id => sender.includes(id));

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage warnings!" }, { quoted: msg });
        }

        const warns = fs.readJsonSync(WARNS_DB, { throws: false }) || {};
        const key = `${from}_${targetJid}`;

        if (cmd === 'warn') {
            if (!targetJid) return sock.sendMessage(from, { text: "❌ Mention or quote a user to warn!" }, { quoted: msg });

            if (adminPermissions.isProtected(targetJid, groupMetadata, ownerJids)) {
                return sock.sendMessage(from, { text: "🛡️ *PROTECTION ACTIVE*\n\nI cannot warn an admin." }, { quoted: msg });
            }

            const reason = args.replace(/@\d+/g, '').trim() || "No reason provided";
            const currentWarns = (warns[key]?.count || 0) + 1;

            warns[key] = {
                count: currentWarns,
                reasons: [...(warns[key]?.reasons || []), { reason, by: sender, at: Date.now() }]
            };

            fs.writeJsonSync(WARNS_DB, warns);

            let warnMsg = `⚠️ *STARRY WARNING SYSTEM*\n\n` +
                `👤 *User:* @${targetJid.split('@')[0]}\n` +
                `📊 *Warning:* ${currentWarns}/3\n` +
                `📝 *Reason:* ${reason}\n\n`;

            if (currentWarns >= 3) {
                warnMsg += `🚫 *LIMIT REACHED:* User will be removed.`;
                await sock.sendMessage(from, { text: warnMsg, mentions: [targetJid] }, { quoted: msg });
                await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
                delete warns[key];
                fs.writeJsonSync(WARNS_DB, warns);
            } else {
                warnMsg += `_Use .unwarn to remove warnings._`;
                await sock.sendMessage(from, { text: warnMsg, mentions: [targetJid] }, { quoted: msg });
            }
        }
        else if (cmd === 'unwarn') {
            if (!targetJid) return sock.sendMessage(from, { text: "❌ Mention or quote a user to unwarn!" }, { quoted: msg });
            if (!warns[key]) return sock.sendMessage(from, { text: "✅ This user has no warnings." }, { quoted: msg });

            delete warns[key];
            fs.writeJsonSync(WARNS_DB, warns);
            await sock.sendMessage(from, { text: `✅ *WARNINGS CLEARED*\n\nUser @${targetJid.split('@')[0]} is back in good standing.`, mentions: [targetJid] }, { quoted: msg });
        }
        else if (cmd === 'warnings') {
            const target = targetJid || sender;
            const targetKey = `${from}_${target}`;
            const userWarns = warns[targetKey];

            if (!userWarns) return sock.sendMessage(from, { text: `✅ @${target.split('@')[0]} has no warnings.`, mentions: [target] }, { quoted: msg });

            let listText = `⚠️ *WARNING LOG: @${target.split('@')[0]}*\n\n` +
                `📊 *Total:* ${userWarns.count}/3\n\n` +
                `*History:* \n`;

            userWarns.reasons.forEach((r, i) => {
                listText += `${i + 1}. [${new Date(r.at).toLocaleDateString()}] ${r.reason}\n`;
            });

            await sock.sendMessage(from, { text: listText, mentions: [target] }, { quoted: msg });
        }

    } catch (err) {
        utils.log("ERROR", `Warnings [${cmd}] Failed: ${err.message}`);
    }
};

/* 
 * Security Gates: Anti-Link
 */
const handleSecurity = async (msg, sock, botState, cmd, args) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const sender = sock.decodeJid(msg.key.participant || from);
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = ownerIds.some(id => sender.includes(id));

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage security gates!" }, { quoted: msg });
        }

        const settings = botState.groupSettings;
        if (!settings[from]) settings[from] = {};

        if (cmd === 'antilink') {
            if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: `.antilink on/off` or `.antilink mode <action>`" }, { quoted: msg });

            const sub = args; // args is already an array of words
            const action = sub[0].toLowerCase();
            const mode = sub[1] ? sub[1].toLowerCase() : null;

            if (action === 'on') {
                settings[from].antilink = true;
                await sock.sendMessage(from, { text: "🛡️ *ANTI-LINK ACTIVATED*\n\nI will now remove anyone (except admins) who sends group invite links." }, { quoted: msg });
            } else if (action === 'off') {
                settings[from].antilink = false;
                await sock.sendMessage(from, { text: "🔓 *ANTI-LINK DEACTIVATED*" }, { quoted: msg });
            } else if (action === 'mode' && mode) {
                if (['kick', 'warn', 'delete'].includes(mode)) {
                    settings[from].antilinkMode = mode;
                    await sock.sendMessage(from, { text: `🛡️ *ANTI-LINK MODE UPDATED*\n\nAction for non-admins: *${mode.toUpperCase()}*` }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: "❌ Invalid mode! Use: `.antilink mode kick/warn/delete`" }, { quoted: msg });
                }
            } else {
                const current = settings[from].antilink ? 'ON 🛡️' : 'OFF 🔓';
                const currentMode = settings[from].antilinkMode || 'kick';
                await sock.sendMessage(from, { text: `🛡️ *ANTI-LINK STATUS:* ${current}\n⚡ *Mode:* ${currentMode.toUpperCase()}\n\nUsage:\n.antilink on/off\n.antilink mode kick/warn/delete` }, { quoted: msg });
            }
        }
        else if (cmd === 'welcome' || cmd === 'setwelcome') {
            if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: `.welcome on/off`" }, { quoted: msg });
            const status = args[0].toLowerCase().trim();
            if (status === 'on') {
                settings[from].welcome = true;
                await sock.sendMessage(from, { text: "👋 *WELCOME SYSTEM ACTIVATED*" }, { quoted: msg });
            } else if (status === 'off') {
                settings[from].welcome = false;
                await sock.sendMessage(from, { text: "🔓 *WELCOME SYSTEM DEACTIVATED*" }, { quoted: msg });
            } else if (cmd === 'setwelcome') {
                if (!args) return sock.sendMessage(from, { text: "❌ Provide a welcome message!\n\nUse `@user` and `@group` as placeholders." }, { quoted: msg });
                settings[from].welcomeMsg = args;
                await sock.sendMessage(from, { text: `✅ *WELCOME MESSAGE UPDATED*\n\nPreview:\n${args.replace(/@user/g, '@' + sender.split('@')[0]).replace(/@group/g, groupMetadata.subject)}`, mentions: [sender] }, { quoted: msg });
            } else {
                const current = settings[from].welcome ? 'ON 👋' : 'OFF 🔓';
                await sock.sendMessage(from, { text: `👋 *WELCOME STATUS:* ${current}\n\nUsage:\n.welcome on/off\n.setwelcome <text>` }, { quoted: msg });
            }
        }
        else if (cmd === 'goodbye' || cmd === 'setgoodbye') {
            if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: `.goodbye on/off`" }, { quoted: msg });
            const status = args[0].toLowerCase().trim();
            if (status === 'on') {
                settings[from].goodbye = true;
                await sock.sendMessage(from, { text: "🚪 *GOODBYE SYSTEM ACTIVATED*" }, { quoted: msg });
            } else if (status === 'off') {
                settings[from].goodbye = false;
                await sock.sendMessage(from, { text: "🔓 *GOODBYE SYSTEM DEACTIVATED*" }, { quoted: msg });
            } else if (cmd === 'setgoodbye') {
                if (!args) return sock.sendMessage(from, { text: "❌ Provide a goodbye message!\n\nUse `@user` and `@group` as placeholders." }, { quoted: msg });
                settings[from].goodbyeMsg = args;
                await sock.sendMessage(from, { text: `✅ *GOODBYE MESSAGE UPDATED*\n\nPreview:\n${args.replace(/@user/g, '@' + sender.split('@')[0]).replace(/@group/g, groupMetadata.subject)}`, mentions: [sender] }, { quoted: msg });
            } else {
                const current = settings[from].goodbye ? 'ON 🚪' : 'OFF 🔓';
                await sock.sendMessage(from, { text: `🚪 *GOODBYE STATUS:* ${current}\n\nUsage:\n.goodbye on/off\n.setgoodbye <text>` }, { quoted: msg });
            }
        }
        else if (cmd === 'testwelcome') {
            const welcomeMsg = settings[from]?.welcomeMsg || "Welcome @user to @group! 🌟";
            const text = welcomeMsg.replace(/@user/g, '@' + sender.split('@')[0]).replace(/@group/g, groupMetadata.subject);
            await sock.sendMessage(from, { text, mentions: [sender] });
        }
        else if (cmd === 'testgoodbye') {
            const goodbyeMsg = settings[from]?.goodbyeMsg || "Goodbye @user! We'll miss you. 🚪";
            const text = goodbyeMsg.replace(/@user/g, '@' + sender.split('@')[0]).replace(/@group/g, groupMetadata.subject);
            await sock.sendMessage(from, { text, mentions: [sender] });
        }
        else if (cmd === 'spam') {
            const guardian = require('./guardian');
            if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: `.spam on/off` (Controls Strict Spam Detector)" }, { quoted: msg });
            const status = args[0].toLowerCase().trim();
            if (status === 'on') {
                guardian.toggleSpam(from, true);
                await sock.sendMessage(from, { text: "🛡️ *STRICT SPAM DETECTOR ACTIVATED*\n\nI will now monitor ALL messages for spam (not just commands)." }, { quoted: msg });
            } else if (status === 'off') {
                guardian.toggleSpam(from, false);
                await sock.sendMessage(from, { text: "🔓 *STRICT SPAM DETECTOR DISABLED*\n\nI will only check for command spam." }, { quoted: msg });
            }
        }

        fs.writeJsonSync(SETTINGS_DB, settings);
        botState.groupSettings = settings;

    } catch (err) {
        utils.log("ERROR", `Security [${cmd}] Failed: ${err.message}`);
    }
};

/*
 * Treasury Management (.treasury)
 */
const handleTreasury = async (msg, sock, botState, cmd, args, isOwner) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    // Owner Only for now (or maybe specialized role later)
    if (!isOwner) return sock.sendMessage(from, { text: "❌ RESTRICTED: Only the Governor/Owner can access the Treasury." }, { quoted: msg });

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "🏛️ *TREASURY COMMANDS*\n\n.treasury info - View Balance\n.treasury print <amount> - Add Funds" }, { quoted: msg });
    }

    const subCmd = args[0].toLowerCase();

    if (subCmd === 'info') {
        const bal = await economy.getHouseBalance();
        return sock.sendMessage(from, { text: `🏛️ *CENTRAL BANK OF STARRY*\n\n💰 *Vault Reserve:* $${bal.toLocaleString()}\n📍 *Location:* Cyber City, Mars` }, { quoted: msg });
    }

    if (subCmd === 'print' || subCmd === 'mint') {
        const amount = utils.parseNumber(args[1]);
        if (!amount || isNaN(amount) || amount <= 0) return sock.sendMessage(from, { text: "❌ Usage: .treasury print <amount>" }, { quoted: msg });

        await economy.updateHouseBalance(amount);
        const newBal = await economy.getHouseBalance();

        return sock.sendMessage(from, {
            text: `🖨️ *MONEY PRINTER GO BRRR*\n\nMinted: *$${amount.toLocaleString()}*\nNew Reserve: *$${newBal.toLocaleString()}*`
        }, { quoted: msg });
    }
};

/*
 * Giveaway Command (.giveaway)
 */
const handleGiveaway = async (msg, sock, botState, cmd, args, isOwner) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    const sender = sock.decodeJid(msg.key.participant || from);

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can start a giveaway!" }, { quoted: msg });
        }

        if (!args || args.length < 2) {
            return sock.sendMessage(from, { text: "❌ Usage: `.giveaway <amount> <count>`\nExample: `.giveaway 1000 3` (3 winners get $1000 each)" }, { quoted: msg });
        }

        const amount = utils.parseNumber(args[0]);
        const count = utils.parseNumber(args[1]);

        if (isNaN(amount) || amount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount!" }, { quoted: msg });
        if (isNaN(count) || count <= 0) return sock.sendMessage(from, { text: "❌ Invalid winner count!" }, { quoted: msg });

        const participants = groupMetadata.participants
            .map(p => p.id)
            .filter(id => id !== sock.decodeJid(sock.user.id));

        if (participants.length < count) {
            return sock.sendMessage(from, { text: `❌ Not enough members! (Need ${count}, found ${participants.length})` }, { quoted: msg });
        }

        const winners = [];
        const pool = [...participants];

        for (let i = 0; i < count; i++) {
            const index = Math.floor(Math.random() * pool.length);
            winners.push(pool[index]);
            pool.splice(index, 1);
        }

        let winnerText = "";
        for (const winner of winners) {
            await economy.updateBalance(winner, amount, 'wallet');
            winnerText += `🎉 @${winner.split('@')[0]}\n`;
        }

        const response = `🎁 *GIVEAWAY COMPLETE* 🎁\n\n` +
            `💰 *Prize:* $${amount.toLocaleString()} each\n` +
            `🏆 *Winners:*\n${winnerText}\n` +
            `_Funds have been added to your wallets!_`;

        await sock.sendMessage(from, { text: response, mentions: winners }, { quoted: msg });

    } catch (err) {
        utils.log("ERROR", `Giveaway Failed: ${err.message}`);
        await sock.sendMessage(from, { text: `❌ Giveaway failed: ${err.message}` }, { quoted: msg });
    }
};

/*
 * Block/Unblock Command (.block / .unblock)
 */
const handleBlock = async (msg, sock, botState, cmd, targetJid, isOwner) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    if (!isOwner) return sock.sendMessage(from, { text: "❌ Owner only command." }, { quoted: msg });

    // Target: can be user (targetJid) OR the group itself (if no targetJid, assume group)
    const target = targetJid || (from.endsWith('@g.us') ? from : null);

    if (!target) return sock.sendMessage(from, { text: "❌ Please mention a user or use in a group to block." }, { quoted: msg });

    let banned = [];
    try {
        banned = fs.readJsonSync(BANNED_DB, { throws: false }) || [];
        if (!Array.isArray(banned)) banned = [];
    } catch (e) { banned = []; }

    if (cmd === 'block') {
        if (banned.includes(target)) return sock.sendMessage(from, { text: "⚠️ Already blocked." });
        banned.push(target);

        // Update Runtime
        if (!botState.bannedChats) botState.bannedChats = [];
        botState.bannedChats.push(target);

        fs.writeJsonSync(BANNED_DB, banned);
        await sock.sendMessage(from, { text: `🚫 *BLOCKED*\n\nTarget: ${target}\n_I will ignore commands from this source._` });
    } else {
        if (!banned.includes(target)) return sock.sendMessage(from, { text: "⚠️ Not blocked." });
        banned = banned.filter(id => id !== target);

        // Update Runtime
        if (botState.bannedChats) {
            botState.bannedChats = botState.bannedChats.filter(id => id !== target);
        }

        fs.writeJsonSync(BANNED_DB, banned);
        await sock.sendMessage(from, { text: `✅ *UNBLOCKED*\n\nTarget: ${target}` });
    }
};

/* 
 * Main Admin Dispatcher
 */
const handleGroupCommand = async (msg, sock, botState, cmd, args, isOwner) => {
    const from = sock.decodeJid(msg.key.remoteJid);
    if (!from.endsWith('@g.us') && cmd !== 'bcast') {
        return sock.sendMessage(from, { text: "❌ This command can only be used in groups!" }, { quoted: msg });
    }

    // Refresh metadata if older than 5 minutes (Group Only)
    const isGroup = from.endsWith('@g.us');
    if (isGroup && (!botState.groupMetadata[from] || (Date.now() - (botState.groupMetadata[from].lastUpdated || 0) > 300000))) {
        try {
            botState.groupMetadata[from] = await sock.groupMetadata(from);
            botState.groupMetadata[from].lastUpdated = Date.now();
        } catch (e) {
            utils.log("WARN", `Failed to fetch metadata for ${from}: ${e.message}`);
        }
    }

    switch (cmd) {
        case 'kick':
        case 'add':
        case 'promote':
        case 'demote':
            return handleMemberAction(msg, sock, botState, cmd, utils.parseTarget(msg, args), isOwner);

        case 'tempmod':
            return handleTempMod(msg, sock, botState, args);

        case 'group':
        case 'setname':
        case 'link':
        case 'admins':
            return handleGroupControl(msg, sock, botState, cmd, args);

        case 'tagall':
        case 'hidetag':
            return handleBroadcast(msg, sock, botState, cmd, args);

        case 'warn':
        case 'unwarn':
        case 'warnings':
            return handleWarnings(msg, sock, botState, cmd, utils.parseTarget(msg, args), args);

        case 'antilink':
        case 'welcome':
        case 'goodbye':
        case 'setwelcome':
        case 'setgoodbye':
        case 'testwelcome':
        case 'testgoodbye':
        case 'spam':
            return handleSecurity(msg, sock, botState, cmd, args);

        case 'block':
        case 'unblock':
            return handleBlock(msg, sock, botState, cmd, utils.parseTarget(msg, args), isOwner);

        case 'bcast':
            return handleGlobalBroadcast(msg, sock, botState, args);

        case 'treasury':
            return handleTreasury(msg, sock, botState, cmd, args, isOwner);

        case 'giveaway':
            return handleGiveaway(msg, sock, botState, cmd, args, isOwner);

        default:
            return sock.sendMessage(from, { text: "⚠️ Command recognized but handler logic is incomplete." }, { quoted: msg });
    }
};

module.exports = {
    handleGroupCommand
};
