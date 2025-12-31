const config = require("../config");

/**
 * Admin Group Commands for Starry MD
 */
module.exports = {
    handleAdminCommand: async (sock, msg, from, cmd, args, botState, sender, isOwner) => {
        const groupMetadata = await sock.groupMetadata(from);
        const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin;

        if (!isAdmin && !isOwner) {
            return sock.sendMessage(from, { text: "❌ Admin only command." });
        }

        const userToTarget = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
            (msg.message.extendedTextMessage?.contextInfo?.quotedMessage ? msg.message.extendedTextMessage.contextInfo.participant : null);

        switch (cmd) {
            case "kick":
                if (userToTarget) await sock.groupParticipantsUpdate(from, [userToTarget], "remove");
                break;
            case "add":
                if (args[0]) await sock.groupParticipantsUpdate(from, [args[0] + "@s.whatsapp.net"], "add");
                break;
            case "promote":
                if (userToTarget) await sock.groupParticipantsUpdate(from, [userToTarget], "promote");
                break;
            case "demote":
                if (userToTarget) await sock.groupParticipantsUpdate(from, [userToTarget], "demote");
                break;
            case "warn":
                if (!userToTarget) return sock.sendMessage(from, { text: "Tag or reply to a user to warn them." });
                let warnCount = (botState.warns.get(userToTarget) || 0) + 1;
                botState.warns.set(userToTarget, warnCount);
                if (warnCount >= 4) {
                    await sock.sendMessage(from, { text: `🚫 @${userToTarget.split('@')[0]} reached 4 warnings and is being kicked.`, mentions: [userToTarget] });
                    await sock.groupParticipantsUpdate(from, [userToTarget], "remove");
                    botState.warns.delete(userToTarget);
                } else {
                    await sock.sendMessage(from, { text: `⚠️ @${userToTarget.split('@')[0]} Warned! [${warnCount}/4]`, mentions: [userToTarget] });
                }
                break;
            case "antilink":
                if (botState.antiLinkGroups.has(from)) {
                    botState.antiLinkGroups.delete(from);
                    await sock.sendMessage(from, { text: "✅ Anti-Link disabled." });
                } else {
                    botState.antiLinkGroups.add(from);
                    await sock.sendMessage(from, { text: "✅ Anti-Link enabled." });
                }
                break;
            case "mute":
                await sock.groupSettingUpdate(from, 'announcement');
                await sock.sendMessage(from, { text: "🔇 Group muted." });
                break;
            case "unmute":
                await sock.groupSettingUpdate(from, 'not_announcement');
                await sock.sendMessage(from, { text: "🔊 Group unmuted." });
                break;
        }
    }
};
