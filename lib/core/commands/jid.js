import utils from '../utils.js';
import fs from 'fs-extra';

export default {
    name: 'jid',
    aliases: ['id', 'ginfo'],
    category: 'general',
    description: 'Get Chat ID and Group Info.',
    execute: async (msg, sock, args, botState) => {
        const from = msg.key.remoteJid;
        const sender = utils.decodeJid(msg.key.participant || from);
        const isGroup = from.endsWith('@g.us');

        let text = `🆔 *ID INFO*\n\n`;
        text += `👤 *You:* \`${sender}\`\n`;
        text += `📍 *Chat:* \`${from}\``;

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
                        id: from,
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
                allowedGroups: [from],
                groupName: groupName,
                inviteLink: inviteLink
            };

            text += `\n\n\`\`\`json\n${JSON.stringify(configSnippet, null, 2)}\n\`\`\``;
        }

        await sock.sendMessage(from, { text }, { quoted: msg });
    }
};
