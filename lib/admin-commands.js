const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const utils = require('./utils');
const adminPermissions = require('./admin-permissions');

const WARNS_DB = path.join(__dirname, '../database/warns.json');
const SETTINGS_DB = path.join(__dirname, '../database/group_settings.json');

/**
 * Admin Commands Module 2.0 (Hardened)
 * Fully rewritten for maximum compatibility and multi-device support.
 */

// --- UTILS ---
// Local getTarget removed in favor of utils.parseTarget

// --- HANDLERS ---

/**
 * Member Management: Kick, Add, Promote, Demote
 */
const handleMemberAction = async (msg, sock, botState, cmd, targetJid, isOwner) => {
    const from = msg.key.remoteJid;
    if (!targetJid) return sock.sendMessage(from, { text: "❌ Please mention or quote a user!" }, { quoted: msg });

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);
        const sender = msg.key.participant || from;

        // Security Gate
        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can use this command!" }, { quoted: msg });
        }

        // Bot Status Check
        if (!adminPermissions.isBotAdmin(sock.decodeJid(sock.user.id), groupMetadata)) {
            return sock.sendMessage(from, { text: "❌ I need to be an admin to perform this action!" }, { quoted: msg });
        }

        // Protection Check (Don't kick/demote admins or owners)
        if ((cmd === 'kick' || cmd === 'demote') && adminPermissions.isProtected(targetJid, groupMetadata, config.OWNER_ID + '@s.whatsapp.net')) {
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

/**
 * Temporary Admin Management (.tempmod)
 */
const handleTempMod = async (msg, sock, botState, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isOwner = sender.includes(config.OWNER_ID);

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

/**
 * Group Control: Set Name, Settings, Links, Admin List
 */
const handleGroupControl = async (msg, sock, botState, cmd, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isOwner = sender.includes(config.OWNER_ID);

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage group settings!" }, { quoted: msg });
        }

        switch (cmd) {
            case 'setname':
                if (!args) return sock.sendMessage(from, { text: "❌ Provide a new name for the group!" }, { quoted: msg });
                await sock.groupUpdateSubject(from, args);
                await sock.sendMessage(from, { text: `✅ Group name updated to: *${args}*` }, { quoted: msg });
                break;

            case 'group':
                const action = args.toLowerCase().trim();
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

/**
 * Broadcast Tools: Tag All, Hide Tag
 */
const handleBroadcast = async (msg, sock, botState, cmd, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isOwner = sender.includes(config.OWNER_ID);

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
            await sock.sendMessage(from, { text: messageText, mentions: participants });
        }

    } catch (err) {
        utils.log("ERROR", `Broadcast [${cmd}] Failed: ${err.message}`);
    }
};

/**
 * Global Broadcast System (.bcast)
 */
const handleGlobalBroadcast = async (msg, sock, botState, args) => {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || from;
    const isOwner = sender.includes(config.OWNER_ID);

    const subCmd = args.toLowerCase().trim();

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
    if (targetGroups.length === 0) return sock.sendMessage(from, { text: "❌ No groups registered for broadcast." });

    await sock.sendMessage(from, { text: `🚀 *SENDING GLOBAL BROADCAST*\n\nTargeting *${targetGroups.length}* groups...` });

    let success = 0;
    let fail = 0;

    const broadText = `🌌 *STARRY MD OFFICIAL BROADCAST* 🌌\n\n${args}\n\n_Sent by Owner_`;

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

/**
 * Warning System: Warn, Unwarn, List Warnings
 */
const handleWarnings = async (msg, sock, botState, cmd, targetJid, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isOwner = sender.includes(config.OWNER_ID);

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage warnings!" }, { quoted: msg });
        }

        const warns = fs.readJsonSync(WARNS_DB, { throws: false }) || {};
        const key = `${from}_${targetJid}`;

        if (cmd === 'warn') {
            if (!targetJid) return sock.sendMessage(from, { text: "❌ Mention or quote a user to warn!" }, { quoted: msg });

            if (adminPermissions.isProtected(targetJid, groupMetadata, config.OWNER_ID + '@s.whatsapp.net')) {
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

/**
 * Security Gates: Anti-Link
 */
const handleSecurity = async (msg, sock, botState, cmd, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const isOwner = sender.includes(config.OWNER_ID);

    try {
        const groupMetadata = botState.groupMetadata[from] || await sock.groupMetadata(from);

        if (!adminPermissions.canUseAdminCommand(sender, from, groupMetadata, cmd, isOwner)) {
            return sock.sendMessage(from, { text: "❌ Only admins can manage security gates!" }, { quoted: msg });
        }

        const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};
        if (!settings[from]) settings[from] = {};

        if (cmd === 'antilink') {
            const status = args.toLowerCase().trim();
            if (status === 'on') {
                settings[from].antilink = true;
                await sock.sendMessage(from, { text: "🛡️ *ANTI-LINK ACTIVATED*\n\nI will now remove anyone (except admins) who sends group invite links." }, { quoted: msg });
            } else if (status === 'off') {
                settings[from].antilink = false;
                await sock.sendMessage(from, { text: "🔓 *ANTI-LINK DEACTIVATED*" }, { quoted: msg });
            } else {
                const current = settings[from].antilink ? 'ON 🛡️' : 'OFF 🔓';
                await sock.sendMessage(from, { text: `🛡️ *ANTI-LINK STATUS:* ${current}\n\nUsage: .antilink on/off` }, { quoted: msg });
            }
        }
        else if (cmd === 'welcome') {
            const status = args.toLowerCase().trim();
            if (status === 'on') {
                settings[from].welcome = true;
                await sock.sendMessage(from, { text: "👋 *WELCOME SYSTEM ACTIVATED*" }, { quoted: msg });
            } else if (status === 'off') {
                settings[from].welcome = false;
                await sock.sendMessage(from, { text: "🔓 *WELCOME SYSTEM DEACTIVATED*" }, { quoted: msg });
            } else {
                const current = settings[from].welcome ? 'ON 👋' : 'OFF 🔓';
                await sock.sendMessage(from, { text: `👋 *WELCOME STATUS:* ${current}\n\nUsage: .welcome on/off` }, { quoted: msg });
            }
        }
        else if (cmd === 'goodbye') {
            const status = args.toLowerCase().trim();
            if (status === 'on') {
                settings[from].goodbye = true;
                await sock.sendMessage(from, { text: "🚪 *GOODBYE SYSTEM ACTIVATED*" }, { quoted: msg });
            } else if (status === 'off') {
                settings[from].goodbye = false;
                await sock.sendMessage(from, { text: "🔓 *GOODBYE SYSTEM DEACTIVATED*" }, { quoted: msg });
            } else {
                const current = settings[from].goodbye ? 'ON 🚪' : 'OFF 🔓';
                await sock.sendMessage(from, { text: `🚪 *GOODBYE STATUS:* ${current}\n\nUsage: .goodbye on/off` }, { quoted: msg });
            }
        }

        fs.writeJsonSync(SETTINGS_DB, settings);

    } catch (err) {
        utils.log("ERROR", `Security [${cmd}] Failed: ${err.message}`);
    }
};

/**
 * Main Admin Dispatcher
 */
const handleGroupCommand = async (msg, sock, botState, cmd, args, isOwner) => {
    const from = msg.key.remoteJid;
    if (!from.endsWith('@g.us')) {
        return sock.sendMessage(from, { text: "❌ This command can only be used in groups!" }, { quoted: msg });
    }

    // Refresh metadata if older than 5 minutes
    if (!botState.groupMetadata[from] || (Date.now() - (botState.groupMetadata[from].lastUpdated || 0) > 300000)) {
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
            return handleSecurity(msg, sock, botState, cmd, args);

        case 'bcast':
            return handleGlobalBroadcast(msg, sock, botState, args);

        default:
            return sock.sendMessage(from, { text: "⚠️ Command recognized but handler logic is incomplete." }, { quoted: msg });
    }
};

module.exports = {
    handleGroupCommand
};
