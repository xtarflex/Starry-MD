const infoZone = require('../../services/info-zone');

/**
 * @type {import('../../types').Command}
 */
module.exports = {
    name: "news",
    description: "Fetch latest news (Yahoo/Google Hybrid)",
    aliases: ["n"],
    category: "info",
    execute: async (msg, sock, args, botState) => {
        const argsStr = args.join(' ');
        return infoZone.handleNews(msg, sock, botState, argsStr);
    }
};
