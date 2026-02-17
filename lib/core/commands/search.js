import utils from '../utils.js';

/**
 * Search-related commands (Placeholder/Deprecated)
 * Ported from monolithic handler.js
 */
export default {
    name: 'yts',
    aliases: ['ytsearch'],
    category: 'search',
    description: 'Search YouTube for videos (Currently Deprecated).',
    execute: async (msg, sock, args, botState) => {
        const from = msg.key.remoteJid;
        // audioLab is deprecated, so we send a informative message
        await sock.sendMessage(from, {
            text: "⚠️ *DEPRECATED*\n\nThe `yts` command is currently disabled due to library bugs. It will be restored in a future update once the audioLab module is rewritten."
        }, { quoted: msg });
    }
};
