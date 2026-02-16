const infoZone = require('../../services/info-zone');

/**
 * @type {import('../../types').Command}
 */
module.exports = {
    name: "gaming",
    description: "Fetch latest Gaming news (IGN)",
    aliases: ["games"],
    category: "news",
    execute: async (msg, sock, args, botState) => {
        const argsStr = args.join(' ');
        const rssUrl = "https://www.gamespot.com/feeds/news/";
        return infoZone.handleNews(msg, sock, botState, argsStr, rssUrl, "GameSpot News");
    }
};
