const fs = require('fs-extra');
const permissions = require('./admin-permissions');
const utils = require('./utils');

/**
 * Admin Commands Module - Extended
 * All admin command handlers
 */

const WARNS_FILE = './database/warns.json';
const GROUP_SETTINGS_FILE = './database/group_settings.json';
const BANNED_CHATS_FILE = './database/banned_chats.json';

// Load/Save functions
function loadWarns() {
    return fs.readJsonSync(WARNS_FILE, { throws: false }) || {};
}

function saveWarns(data) {
    fs.writeJsonSync(WARNS_FILE, data, { spaces: 2 });
}

function loadGroupSettings() {
    return fs.readJsonSync(GROUP_SETTINGS_FILE, { throws: false }) || {};
}

function saveGroupSettings(data) {
    fs.writeJsonSync(GROUP_SETTINGS_FILE, data, { spaces: 2 });
}

function loadBannedChats() {
    return fs.readJsonSync(BANNED_CHATS_FILE, { throws: false }) || [];
}

function saveBannedChats(data) {
    fs.writeJsonSync(BANNED_CHATS_FILE, data, { spaces: 2 });
}

function extractMentions(msg) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentions;
}

/**
 * Handle .tempmod command
 */
async function handleTempMod(msg, sock, botState, args, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    
    // Only admins can grant temp admin
    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'tempmod', isOwner)) {
        return sock.sendMessage(from, {
            text: "❌ Admin-only command!"
        }, { quoted: msg });
    }
    
    const subCmd = args.split(' ')[0]?.toLowerCase();
    
    // List temp admins
    if (subCmd === 'list') {
        const tempAdmins = permissions.listTempAdmins(from);
        
        if (tempAdmins.length === 0) {
            return sock.sendMessage(from, {
                text: "📋 *TEMP ADMINS*\n\nNo temporary admins in this group."
            }, { quoted: msg });
        }
        
        let text = "📋 *TEMP ADMINS*\n\n";
        for (const ta of tempAdmins) {
            const timeLeft = ta.expiresAt - Date.now();
            const minutesLeft = Math.floor(timeLeft / 60000);
            const cmds = Array.isArray(ta.allowedCommands) ? ta.allowedCommands.join(', ') : ta.allowedCommands;
            
            text += `👤 @${ta.userJid.split('@')[0]}\n`;
            text += `⏰ Expires in: ${minutesLeft}m\n`;
            text += `🎯 Commands: ${cmds}\n`;
            text += `📊 Used: ${ta.usageCount} times\n\n`;
        }
        
        return sock.sendMessage(from, {
            text,
            mentions: tempAdmins.map(ta => ta.userJid)
        }, { quoted: msg });
    }
    
    // Extract mentioned user
    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, {
            text: "❌ Please mention a user!\n\n*Usage:*\n" +
                  ".tempmod @user 30m kick,warn\n" +
                  ".tempmod @user 1h all\n" +
                  ".tempmod @user revoke\n" +
                  ".tempmod list"
        }, { quoted: msg });
    }
    
    const targetJid = mentions[0];
    const argsParts = args.split(' ').filter(a => a);
    
    // Revoke temp admin
    if (argsParts[0] === 'revoke') {
        const revoked = permissions.revokeTempAdmin(targetJid, from);
        if (revoked) {
            return sock.sendMessage(from, {
                text: `✅ *TEMP ADMIN REVOKED*\n\n@${targetJid.split('@')[0]} no longer has temporary admin powers.`,
                mentions: [targetJid]
            }, { quoted: msg });
        } else {
            return sock.sendMessage(from, {
                text: `❌ @${targetJid.split('@')[0]} is not a temp admin.`,
                mentions: [targetJid]
            }, { quoted: msg });
        }
    }
    
    // Grant temp admin
    const durationStr = argsParts[0];
    const commandsStr = argsParts[1] || 'all';
    
    if (!durationStr) {
        return sock.sendMessage(from, {
            text: "❌ Please specify duration!\n\n*Example:* .tempmod @user 30m kick,warn"
        }, { quoted: msg });
    }
    
    const duration = permissions.parseDuration(durationStr);
    if (!duration) {
        return sock.sendMessage(from, {
            text: "❌ Invalid duration format!\n\n*Valid formats:*\n" +
                  "• 30m (30 minutes)\n" +
                  "• 1h (1 hour)\n" +
                  "• 2d (2 days)\n\n" +
                  "*Max:* 24h"
        }, { quoted: msg });
    }
    
    // Max 24 hours
    if (duration > 24 * 60 * 60 * 1000) {
        return sock.sendMessage(from, {
            text: "❌ Maximum duration is 24 hours!"
        }, { quoted: msg });
    }
    
    const allowedCommands = commandsStr === 'all' ? 'all' : commandsStr.split(',');
    
    permissions.grantTempAdmin(targetJid, from, sender, duration, allowedCommands);
    
    const minutesDuration = Math.floor(duration / 60000);
    const cmds = Array.isArray(allowedCommands) ? allowedCommands.join(', ') : allowedCommands;
    
    await sock.sendMessage(from, {
        text: `✅ *TEMP ADMIN GRANTED*\n\n` +
              `👤 User: @${targetJid.split('@')[0]}\n` +
              `⏰ Duration: ${minutesDuration} minutes\n` +
              `🎯 Commands: ${cmds}\n\n` +
              `_Powers will auto-revoke after expiry._`,
        mentions: [targetJid]
    }, { quoted: msg });
    
    utils.log("ADMIN", `Temp admin granted to ${targetJid.split('@')[0]} for ${minutesDuration}m`);
}

/**
 * Handle .kick command
 */
async function handleKick(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check permissions
    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'kick', isOwner)) {
        return sock.sendMessage(from, {
            text: "❌ Admin-only command!"
        }, { quoted: msg });
    }
    
    // Check if bot is admin
    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, {
            text: "❌ Bot needs admin rights to kick members!"
        }, { quoted: msg });
    }
    
    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, {
            text: "❌ Please mention user(s) to kick!\n\n*Usage:* .kick @user"
        }, { quoted: msg });
    }
    
    // Check if target is protected
    for (const targetJid of mentions) {
        if (permissions.isProtected(targetJid, groupMetadata, botState.ownerID)) {
            return sock.sendMessage(from, {
                text: `❌ Can't kick @${targetJid.split('@')[0]} (protected)`,
                mentions: [targetJid]
            }, { quoted: msg });
        }
    }
    
    // Kick users
    try {
        await sock.groupParticipantsUpdate(from, mentions, 'remove');
        await sock.sendMessage(from, {
            text: `✅ Kicked ${mentions.length} user(s)`,
            mentions
        }, { quoted: msg });
        
        utils.log("ADMIN", `Kicked ${mentions.length} users from ${from}`);
    } catch (error) {
        await sock.sendMessage(from, {
            text: `❌ Failed to kick: ${error.message}`
        }, { quoted: msg });
    }
}

/**
 * Handle .add command
 */
async function handleAdd(msg, sock, botState, args, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'add', isOwner)) {
        return sock.sendMessage(from, {
            text: "❌ Admin-only command!"
        }, { quoted: msg });
    }
    
    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, {
            text: "❌ Bot needs admin rights to add members!"
        }, { quoted: msg });
    }
    
    const number = args.replace(/[^0-9]/g, '');
    if (!number) {
        return sock.sendMessage(from, {
            text: "❌ Please provide a phone number!\n\n*Usage:* .add 234XXXXXXXXXX"
        }, { quoted: msg });
    }
    
    const userJid = number + '@s.whatsapp.net';
    
    try {
        await sock.groupParticipantsUpdate(from, [userJid], 'add');
        await sock.sendMessage(from, {
            text: `✅ Added @${number}`,
            mentions: [userJid]
        }, { quoted: msg });
        
        utils.log("ADMIN", `Added ${number} to ${from}`);
    } catch (error) {
        await sock.sendMessage(from, {
            text: `❌ Failed to add: ${error.message}\n\n💡 Try .invite instead`
        }, { quoted: msg });
    }
}

/**
 * Handle .promote command
 */
async function handlePromote(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'promote', isOwner)) {
        return sock.sendMessage(from, {
            text: "❌ Admin-only command!"
        }, { quoted: msg });
    }
    
    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, {
            text: "❌ Bot needs admin rights to promote members!"
        }, { quoted: msg });
    }
    
    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, {
            text: "❌ Please mention user(s) to promote!\n\n*Usage:* .promote @user"
        }, { quoted: msg });
    }
    
    try {
        await sock.groupParticipantsUpdate(from, mentions, 'promote');
        await sock.sendMessage(from, {
            text: `✅ Promoted ${mentions.length} user(s) to admin`,
            mentions
        }, { quoted: msg });
        
        utils.log("ADMIN", `Promoted ${mentions.length} users in ${from}`);
    } catch (error) {
        await sock.sendMessage(from, {
            text: `❌ Failed to promote: ${error.message}`
        }, { quoted: msg });
    }
}

/**
 * Handle .demote command
 */
async function handleDemote(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'demote', isOwner)) {
        return sock.sendMessage(from, {
            text: "❌ Admin-only command!"
        }, { quoted: msg });
    }
    
    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, {
            text: "❌ Bot needs admin rights to demote members!"
        }, { quoted: msg });
    }
    
    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, {
            text: "❌ Please mention user(s) to demote!\n\n*Usage:* .demote @user"
        }, { quoted: msg });
    }
    
    // Check if trying to demote owner
    for (const targetJid of mentions) {
        if (targetJid === botState.ownerID) {
            return sock.sendMessage(from, {
                text: "❌ Can't demote bot owner!"
            }, { quoted: msg });
        }
    }
    
    try {
        await sock.groupParticipantsUpdate(from, mentions, 'demote');
        await sock.sendMessage(from, {
            text: `✅ Demoted ${mentions.length} user(s)`,
            mentions
        }, { quoted: msg });
        
        utils.log("ADMIN", `Demoted ${mentions.length} users in ${from}`);
    } catch (error) {
        await sock.sendMessage(from, {
            text: `❌ Failed to demote: ${error.message}`
        }, { quoted: msg });
    }
}

/**
 * Handle .warn command
 */
async function handleWarn(msg, sock, botState, args, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    
    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'warn', isOwner)) {
        return sock.sendMessage(from, {
            text: "❌ Admin-only command!"
        }, { quoted: msg });
    }
    
    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, {
            text: "❌ Please mention user to warn!\n\n*Usage:* .warn @user [reason]"
        }, { quoted: msg });
    }
    
    const targetJid = mentions[0];
    const reason = args || "No reason provided";
    
    // Check if protected
    if (permissions.isProtected(targetJid, groupMetadata, botState.ownerID)) {
        return sock.sendMessage(from, {
            text: `❌ Can't warn @${targetJid.split('@')[0]} (protected)`,
            mentions: [targetJid]
        }, { quoted: msg });
    }
    
    const warns = loadWarns();
    const key = `${from}_${targetJid}`;
    
    if (!warns[key]) {
        warns[key] = { warns: 0, maxWarns: 3, history: [] };
    }
    
    warns[key].warns++;
    warns[key].history.push(reason);
    saveWarns(warns);
    
    const warnCount = warns[key].warns;
    const maxWarns = warns[key].maxWarns;
    
    await sock.sendMessage(from, {
        text: `⚠️ *WARNING ISSUED*\n\n` +
              `👤 User: @${targetJid.split('@')[0]}\n` +
              `📊 Warnings: ${warnCount}/${maxWarns}\n` +
              `📝 Reason: ${reason}\n\n` +
              `${warnCount >= maxWarns ? '🚨 *MAX WARNINGS REACHED!*' : `_${maxWarns - warnCount} warning(s) left_`}`,
        mentions: [targetJid]
    }, { quoted: msg });
    
    // Auto-kick at max warns
    if (warnCount >= maxWarns && permissions.isBotAdmin(sock.user.id.split(':')[0] + '@s.whatsapp.net', groupMetadata)) {
        await sock.groupParticipantsUpdate(from, [targetJid], 'remove');
        await sock.sendMessage(from, {
            text: `🚨 @${targetJid.split('@')[0]} has been kicked for reaching max warnings!`,
            mentions: [targetJid]
        });
        
        // Reset warns
        delete warns[key];
        saveWarns(warns);
    }
    
    utils.log("ADMIN", `Warned ${targetJid.split('@')[0]} in ${from} (${warnCount}/${maxWarns})`);
}

/**
 * Handle .unwarn command
 */
async function handleUnwarn(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'unwarn', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, { text: "❌ Mention user to unwarn!\n\n*Usage:* .unwarn @user" }, { quoted: msg });
    }

    const targetJid = mentions[0];
    const warns = loadWarns();
    const key = `${from}_${targetJid}`;

    if (!warns[key] || warns[key].warns === 0) {
        return sock.sendMessage(from, {
            text: `@${targetJid.split('@')[0]} has no warnings.`,
            mentions: [targetJid]
        }, { quoted: msg });
    }

    warns[key].warns--;
    warns[key].history.pop();
    saveWarns(warns);

    await sock.sendMessage(from, {
        text: `✅ Removed 1 warning from @${targetJid.split('@')[0]}\n\n📊 Warnings: ${warns[key].warns}/${warns[key].maxWarns}`,
        mentions: [targetJid]
    }, { quoted: msg });
}

/**
 * Handle .resetwarn command
 */
async function handleResetWarn(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'resetwarn', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    const mentions = extractMentions(msg);
    if (mentions.length === 0) {
        return sock.sendMessage(from, { text: "❌ Mention user!\n\n*Usage:* .resetwarn @user" }, { quoted: msg });
    }

    const targetJid = mentions[0];
    const warns = loadWarns();
    const key = `${from}_${targetJid}`;

    delete warns[key];
    saveWarns(warns);

    await sock.sendMessage(from, {
        text: `✅ All warnings cleared for @${targetJid.split('@')[0]}`,
        mentions: [targetJid]
    }, { quoted: msg });
}

/**
 * Handle .warnings command
 */
async function handleWarnings(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const mentions = extractMentions(msg);
    const warns = loadWarns();

    if (mentions.length === 0) {
        // Show own warnings
        const sender = msg.key.participant || msg.key.remoteJid;
        const key = `${from}_${sender}`;
        const userWarns = warns[key];

        if (!userWarns || userWarns.warns === 0) {
            return sock.sendMessage(from, { text: "✅ You have no warnings!" }, { quoted: msg });
        }

        let text = `⚠️ *YOUR WARNINGS*\n\n📊 ${userWarns.warns}/${userWarns.maxWarns}\n\n*History:*\n`;
        userWarns.history.forEach((reason, i) => {
            text += `${i + 1}. ${reason}\n`;
        });

        return sock.sendMessage(from, { text }, { quoted: msg });
    }

    // Show someone else's warnings (admin only)
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'warnings', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only to check others!" }, { quoted: msg });
    }

    const targetJid = mentions[0];
    const key = `${from}_${targetJid}`;
    const userWarns = warns[key];

    if (!userWarns || userWarns.warns === 0) {
        return sock.sendMessage(from, {
            text: `@${targetJid.split('@')[0]} has no warnings.`,
            mentions: [targetJid]
        }, { quoted: msg });
    }

    let text = `⚠️ *WARNINGS FOR @${targetJid.split('@')[0]}*\n\n📊 ${userWarns.warns}/${userWarns.maxWarns}\n\n*History:*\n`;
    userWarns.history.forEach((reason, i) => {
        text += `${i + 1}. ${reason}\n`;
    });

    await sock.sendMessage(from, { text, mentions: [targetJid] }, { quoted: msg });
}

/**
 * Handle .group command (open/close)
 */
async function handleGroup(msg, sock, botState, args, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'group', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, { text: "❌ Bot needs admin rights!" }, { quoted: msg });
    }

    const action = args.toLowerCase();

    if (action === 'open') {
        await sock.groupSettingUpdate(from, 'not_announcement');
        return sock.sendMessage(from, { text: "🔓 *GROUP OPENED*\n\nEveryone can send messages now." }, { quoted: msg });
    }

    if (action === 'close') {
        await sock.groupSettingUpdate(from, 'announcement');
        return sock.sendMessage(from, { text: "🔒 *GROUP CLOSED*\n\nOnly admins can send messages now." }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: "❌ Invalid option!\n\n*Usage:*\n.group open\n.group close" }, { quoted: msg });
}

/**
 * Handle .setname command
 */
async function handleSetName(msg, sock, botState, args, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'setname', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, { text: "❌ Bot needs admin rights!" }, { quoted: msg });
    }

    if (!args) {
        return sock.sendMessage(from, { text: "❌ Provide new group name!\n\n*Usage:* .setname New Group Name" }, { quoted: msg });
    }

    await sock.groupUpdateSubject(from, args);
    await sock.sendMessage(from, { text: `✅ Group name updated to:\n*${args}*` }, { quoted: msg });
}

/**
 * Handle .link command
 */
async function handleLink(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, { text: "❌ Bot needs admin rights!" }, { quoted: msg });
    }

    const code = await sock.groupInviteCode(from);
    const link = `https://chat.whatsapp.com/${code}`;

    await sock.sendMessage(from, {
        text: `🔗 *GROUP INVITE LINK*\n\n${link}\n\n_Share wisely!_`
    }, { quoted: msg });
}

/**
 * Handle .hidetag command
 */
async function handleHidetag(msg, sock, botState, args, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'hidetag', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    const text = args || "📢 *ANNOUNCEMENT*";
    const participants = groupMetadata.participants.map(p => p.id);

    await sock.sendMessage(from, {
        text,
        mentions: participants
    }, { quoted: msg });
}

/**
 * Handle .tagall command
 */
async function handleTagAll(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'tagall', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    let text = "📢 *TAGGING EVERYONE*\n\n";
    const participants = groupMetadata.participants;

    participants.forEach((p, i) => {
        text += `${i + 1}. @${p.id.split('@')[0]}\n`;
    });

    await sock.sendMessage(from, {
        text,
        mentions: participants.map(p => p.id)
    }, { quoted: msg });
}

/**
 * Handle .admins command
 */
async function handleAdmins(msg, sock, groupMetadata) {
    const from = msg.key.remoteJid;

    const admins = groupMetadata.participants.filter(p => p.admin);

    if (admins.length === 0) {
        return sock.sendMessage(from, { text: "❌ No admins found!" }, { quoted: msg });
    }

    let text = "👑 *GROUP ADMINS*\n\n";
    admins.forEach((admin, i) => {
        const role = admin.admin === 'superadmin' ? '👑' : '⭐';
        text += `${i + 1}. ${role} @${admin.id.split('@')[0]}\n`;
    });

    await sock.sendMessage(from, {
        text,
        mentions: admins.map(a => a.id)
    }, { quoted: msg });
}

/**
 * Handle .antilink command
 */
async function handleAntilink(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner-only command!" }, { quoted: msg });
    }

    const settings = loadGroupSettings();
    if (!settings[from]) settings[from] = {};

    const action = args.toLowerCase();

    if (action === 'on') {
        settings[from].antilink = true;
        saveGroupSettings(settings);
        return sock.sendMessage(from, { text: "🛡️ *ANTILINK ENABLED*\n\nGroup links will be auto-deleted and senders kicked." }, { quoted: msg });
    }

    if (action === 'off') {
        settings[from].antilink = false;
        saveGroupSettings(settings);
        return sock.sendMessage(from, { text: "🔓 *ANTILINK DISABLED*" }, { quoted: msg });
    }

    const status = settings[from]?.antilink ? 'ON' : 'OFF';
    return sock.sendMessage(from, { text: `🛡️ *ANTILINK STATUS*\n\n📊 ${status}\n\n*Usage:*\n.antilink on\n.antilink off` }, { quoted: msg });
}

/**
 * Handle .welcome command
 */
async function handleWelcome(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner-only command!" }, { quoted: msg });
    }

    const settings = loadGroupSettings();
    if (!settings[from]) settings[from] = {};

    const action = args.toLowerCase();

    if (action === 'on') {
        settings[from].welcome = true;
        saveGroupSettings(settings);
        return sock.sendMessage(from, { text: "👋 *WELCOME ENABLED*\n\nNew members will be greeted." }, { quoted: msg });
    }

    if (action === 'off') {
        settings[from].welcome = false;
        saveGroupSettings(settings);
        return sock.sendMessage(from, { text: "🔕 *WELCOME DISABLED*" }, { quoted: msg });
    }

    const status = settings[from]?.welcome ? 'ON' : 'OFF';
    return sock.sendMessage(from, { text: `👋 *WELCOME STATUS*\n\n📊 ${status}\n\n*Usage:*\n.welcome on\n.welcome off` }, { quoted: msg });
}

/**
 * Handle .goodbye command
 */
async function handleGoodbye(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner-only command!" }, { quoted: msg });
    }

    const settings = loadGroupSettings();
    if (!settings[from]) settings[from] = {};

    const action = args.toLowerCase();

    if (action === 'on') {
        settings[from].goodbye = true;
        saveGroupSettings(settings);
        return sock.sendMessage(from, { text: "👋 *GOODBYE ENABLED*\n\nLeaving members will be farewelled." }, { quoted: msg });
    }

    if (action === 'off') {
        settings[from].goodbye = false;
        saveGroupSettings(settings);
        return sock.sendMessage(from, { text: "🔕 *GOODBYE DISABLED*" }, { quoted: msg });
    }

    const status = settings[from]?.goodbye ? 'ON' : 'OFF';
    return sock.sendMessage(from, { text: `👋 *GOODBYE STATUS*\n\n📊 ${status}\n\n*Usage:*\n.goodbye on\n.goodbye off` }, { quoted: msg });
}

/**
 * Handle .delete command
 */
async function handleDelete(msg, sock, botState, groupMetadata) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);
    const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

    if (!permissions.canUseAdminCommand(sender, from, groupMetadata, 'delete', isOwner)) {
        return sock.sendMessage(from, { text: "❌ Admin-only command!" }, { quoted: msg });
    }

    if (!permissions.isBotAdmin(botJid, groupMetadata)) {
        return sock.sendMessage(from, { text: "❌ Bot needs admin rights!" }, { quoted: msg });
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
    if (!quotedMsg) {
        return sock.sendMessage(from, { text: "❌ Reply to a message to delete it!" }, { quoted: msg });
    }

    await sock.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: quotedMsg.stanzaId, participant: quotedMsg.participant } });
}

/**
 * Handle .clearchat command
 */
async function handleClearChat(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner-only command!" }, { quoted: msg });
    }

    // Clear bot's message cache for this chat
    if (botState.chatHistory) {
        botState.chatHistory.delete(from);
    }
    if (botState.processedMessages) {
        // Clear processed messages for this chat
        const toDelete = [];
        for (const msgId of botState.processedMessages) {
            if (msgId.includes(from)) {
                toDelete.push(msgId);
            }
        }
        toDelete.forEach(id => botState.processedMessages.delete(id));
    }

    await sock.sendMessage(from, { text: "✅ *CHAT CLEARED*\n\nBot's message cache cleared for this chat." }, { quoted: msg });
}

/**
 * Handle .banchat command
 */
async function handleBanChat(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner-only command!" }, { quoted: msg });
    }

    const bannedChats = loadBannedChats();
    if (bannedChats.includes(from)) {
        return sock.sendMessage(from, { text: "❌ This chat is already banned!" }, { quoted: msg });
    }

    bannedChats.push(from);
    saveBannedChats(bannedChats);

    await sock.sendMessage(from, { text: "🚫 *CHAT BANNED*\n\nBot will ignore all commands in this chat.\n\nUse .unbanchat to restore." }, { quoted: msg });
}

/**
 * Handle .unbanchat command
 */
async function handleUnbanChat(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes(botState.ownerID.split('@')[0]);

    if (!isOwner) {
        return sock.sendMessage(from, { text: "❌ Owner-only command!" }, { quoted: msg });
    }

    let bannedChats = loadBannedChats();
    if (!bannedChats.includes(from)) {
        return sock.sendMessage(from, { text: "❌ This chat is not banned!" }, { quoted: msg });
    }

    bannedChats = bannedChats.filter(id => id !== from);
    saveBannedChats(bannedChats);

    await sock.sendMessage(from, { text: "✅ *CHAT UNBANNED*\n\nBot will now respond to commands in this chat." }, { quoted: msg });
}

/**
 * Handle .mem command
 */
async function handleMem(msg, sock, groupMetadata) {
    const from = msg.key.remoteJid;
    const total = groupMetadata.participants.length;
    const admins = groupMetadata.participants.filter(p => p.admin).length;
    const regular = total - admins;

    return sock.sendMessage(from, {
        text: `👥 *GROUP MEMBERS*\n\n📊 Total: ${total}\n👑 Admins: ${admins}\n👤 Members: ${regular}`
    }, { quoted: msg });
}

module.exports = {
    // Member Management
    handleTempMod,
    handleKick,
    handleAdd,
    handlePromote,
    handleDemote,
    handleWarn,
    handleUnwarn,
    handleResetWarn,
    handleWarnings,

    // Group Settings
    handleGroup,
    handleSetName,
    handleLink,

    // Mass Mention
    handleHidetag,
    handleTagAll,
    handleAdmins,

    // Security
    handleAntilink,
    handleWelcome,
    handleGoodbye,

    // Message Management
    handleDelete,
    handleClearChat,
    handleBanChat,
    handleUnbanChat,
    handleMem
};
