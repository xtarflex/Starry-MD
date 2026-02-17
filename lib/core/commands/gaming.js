import { handleNews } from '../../services/info-zone.js';

/**
 * @type {import('../../types').Command}
 */
export const name = "gaming";
export const description = "Fetch latest Gaming news (IGN)";
export const aliases = ["games"];
export const category = "news";
export async function execute(msg, sock, args, botState) {
    const argsStr = args.join(' ');
    const rssUrl = "https://www.gamespot.com/feeds/news/";
    return handleNews(msg, sock, botState, argsStr, rssUrl, "GameSpot News");
}
