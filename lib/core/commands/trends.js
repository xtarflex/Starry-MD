const infoZone = require('../../services/info-zone');

/**
 * @type {import('../../types').Command}
 */
module.exports = {
    name: "trends",
    description: "Fetch latest Google search trends",
    aliases: ["trend"],
    category: "info",
    execute: async (msg, sock, args, botState) => {
        const argsStr = args.join(' ');
        return infoZone.handleTrends(msg, sock, botState, argsStr);
    }
};
