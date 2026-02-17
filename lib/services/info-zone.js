import axios from 'axios';
import lyricsFinder from 'lyrics-finder';
import utils from '../core/utils.js';

/* 
 * Information Suite - Knowledge & Utilities
 */
const infoZone = {
    /* 
     * Get Song Lyrics (.lyrics)
     */
    handleLyrics: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Please provide a song name! Example: `.lyrics Bohemian Rhapsody`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🎼", key: msg.key } });

        try {
            // "author" is left empty to let the library auto-detect
            const lyrics = await lyricsFinder(query, "");

            if (!lyrics || lyrics.length === 0) {
                return sock.sendMessage(from, { text: "❌ Lyrics not found. Try adding the artist name (e.g., '.lyrics Queen Bohemian Rhapsody')." }, { quoted: msg });
            }

            // WhatsApp has a character limit, but lyrics usually fit. 
            // Just in case, we log success.
            await utils.smartTyping(sock, from, lyrics);
            await sock.sendMessage(from, {
                text: `🎼 *STARRY LYRICS*\n\n*Results for:* ${query}\n\n${lyrics}`,
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Lyrics Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch lyrics." }, { quoted: msg });
        }
    },

    /* 
     * Wikipedia Search (.wiki)
     */
    handleWiki: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Please provide a topic! Example: `.wiki Quantum Physics`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "📚", key: msg.key } });

        try {
            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await axios.get(url);
            const data = response.data;

            if (!data || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
                return sock.sendMessage(from, { text: "❌ Topic not found on Wikipedia." }, { quoted: msg });
            }

            const summary = data.extract;
            const title = data.title;
            const img = (data.thumbnail && data.thumbnail.source) ? data.thumbnail.source : null;
            const link = data.content_urls.desktop.page;

            const caption = `📚 *WIKIPEDIA*: ${title}\n\n${summary}\n\n🔗 *Read More:* ${link}`;

            if (img) {
                await sock.sendMessage(from, { image: { url: img }, caption: caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

        } catch (err) {
            utils.log("ERROR", `Wiki Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch Wikipedia article." }, { quoted: msg });
        }
    },

    /* 
     * Google/Yahoo News (.news)
     */
    handleNews: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        const topic = query || "technology";

        await sock.sendMessage(from, { react: { text: "📰", key: msg.key } });

        try {
            // Using a public RSS feed + xml2js would be ideal, but for now we'll use a scraper or mock
            // Since we don't have a reliable free news API key, we'll try a simple scraping approach or placeholder
            // For stability, let's use a structured mock that suggests real sources, or a very simple RSS fetch if possible.

            // Placeholder for now to prevent crash
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
            const { get } = await import('axios');
            const { parseStringPromise } = await import('xml2js');

            const { data } = await get(url);
            const result = await parseStringPromise(data);

            const items = result.rss.channel[0].item.slice(0, 5);
            let response = `📰 *STARRY NEWS: ${topic.toUpperCase()}*\n\n`;

            items.forEach(item => {
                response += `🔹 *${item.title[0]}*\n🔗 ${item.link[0]}\n\n`;
            });

            await sock.sendMessage(from, { text: response }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `News Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch news." }, { quoted: msg });
        }
    },

    handleTrends: async (msg, sock, botState, query) => {
        // Placeholder for trends
        await sock.sendMessage(msg.key.remoteJid, { text: "📈 Trends feature coming soon!" }, { quoted: msg });
    },

    handleWeather: async (msg, sock, botState, query) => {
        // Placeholder for weather
        await sock.sendMessage(msg.key.remoteJid, { text: "Vm Weather feature coming soon!" }, { quoted: msg });
    },

    handleDefine: async (msg, sock, botState, query) => {
        // Placeholder for define
        await sock.sendMessage(msg.key.remoteJid, { text: "📖 Dictionary feature coming soon!" }, { quoted: msg });
    },

    handleGoogle: async (msg, sock, botState, query) => {
        // Placeholder for google
        await sock.sendMessage(msg.key.remoteJid, { text: "🔍 Google Search feature coming soon!" }, { quoted: msg });
    },

    handleShorten: async (msg, sock, botState, query) => {
        // Placeholder for shorten
        await sock.sendMessage(msg.key.remoteJid, { text: "🔗 URL Shortener feature coming soon!" }, { quoted: msg });
    }
};

// Named exports for compatibility
export const {
    handleLyrics,
    handleWiki,
    handleNews,
    handleTrends,
    handleWeather,
    handleDefine,
    handleGoogle,
    handleShorten
} = infoZone;

export default infoZone;