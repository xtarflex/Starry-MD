import infoZone from '../../services/info-zone.js';

/**
 * @type {import('../../types').Command}
 */
export default {
    name: "news",
    description: "Fetch latest news (Yahoo/Google Hybrid)",
    aliases: ["n"],
    category: "info",
    execute: async (msg, sock, args, botState) => {
        const argsStr = args.join(' ');
        return infoZone.handleNews(msg, sock, botState, argsStr);
    }
};
