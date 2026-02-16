import { handleNews } from '../../services/info-zone';

/**
 * @type {import('../../types').Command}
 */
export const name = "crypto";
export const description = "Fetch latest Crypto news (CoinDesk)";
export const aliases = ["coin"];
export const category = "news";
export async function execute(msg, sock, args, botState) {
    const argsStr = args.join(' ');
    const rssUrl = "https://www.coindesk.com/arc/outboundfeeds/rss/";
    return handleNews(msg, sock, botState, argsStr, rssUrl, "CoinDesk");
}
