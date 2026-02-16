import { handleNews } from '../../services/info-zone';

/**
 * @type {import('../../types').Command}
 */
export const name = "anime";
export const description = "Fetch latest Anime news (Anime News Network)";
export const aliases = ["ann"];
export const category = "news";
export async function execute(msg, sock, args, botState) {
    const argsStr = args.join(' ');
    const rssUrl = "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us";
    return handleNews(msg, sock, botState, argsStr, rssUrl, "Anime News Network");
}
