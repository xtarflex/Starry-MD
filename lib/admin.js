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
                if (args) await sock.groupParticipantsUpdate(from, [args.trim() + "@s.whatsapp.net"], "add");
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
            case "tagall":
                let members = groupMetadata.participants.map(p => p.id);
                let tagMsg = `📢 *TAG ALL*\n\n*Message:* ${args || 'None'}\n\n`;
                for (let mem of members) tagMsg += `📍 @${mem.split('@')[0]}\n`;
                await sock.sendMessage(from, { text: tagMsg, mentions: members });
                break;
            case "mem":
                const totalMembers = groupMetadata.participants.length;
                const admins = groupMetadata.participants.filter(p => p.admin).length;
                const regular = totalMembers - admins;
                await sock.sendMessage(from, {
                    text: `👥 *GROUP MEMBERS*\n\n📊 Total: ${totalMembers}\n👑 Admins: ${admins}\n👤 Members: ${regular}`
                });
                break;
            case "memghost":
                // List members who haven't sent messages recently
                // For now, just list all members (activity tracking would need message history)
                const allMembers = groupMetadata.participants;
                let ghostMsg = `👻 *GHOST MEMBERS*\n\n_Members in this group:_\n\n`;
                allMembers.forEach((member, index) => {
                    const isAdmin = member.admin ? '👑' : '👤';
                    ghostMsg += `${index + 1}. ${isAdmin} @${member.id.split('@')[0]}\n`;
                });
                ghostMsg += `\n_Total: ${allMembers.length} members_\n`;
                ghostMsg += `\n💡 _Tip: Track activity over time to identify true ghosts_`;
                await sock.sendMessage(from, {
                    text: ghostMsg,
                    mentions: allMembers.map(m => m.id)
                });
                break;
        }
    }
};
