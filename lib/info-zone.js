const axios = require('axios');
const lyricsFinder = require('lyrics-finder');
const utils = require('./utils');

/**
 * Information Suite - Knowledge & Utilities
 */
module.exports = {
    /**
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
            await sock.sendMessage(from, {
                text: `🎼 *STARRY LYRICS*\n\n*Results for:* ${query}\n\n${lyrics}`,
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Lyrics Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch lyrics." }, { quoted: msg });
        }
    },

    /**
     * Wikipedia Search (.wiki)
     */
    handleWiki: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Please provide a topic! Example: `.wiki Quantum Physics`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "📚", key: msg.key } });

        try {
            // Wikipedia is sensitive. We Title Case the query to help it find matches.
            // e.g. "quantum physics" -> "Quantum_Physics"
            const formattedQuery = query.trim().replace(/ /g, '_');

            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(formattedQuery)}`;

            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'StarryMD-Bot/2.0' }
            });

            if (!data.extract) {
                return sock.sendMessage(from, { text: "❌ No result found. Try checking your spelling." }, { quoted: msg });
            }

            let response = `📚 *WIKIPEDIA: ${data.title}*\n\n`;
            response += `${data.extract}\n\n`;

            if (data.content_urls?.desktop?.page) {
                response += `🔗 *Read more:* ${data.content_urls.desktop.page}`;
            }

            // Prepare message options
            let messageOptions = { text: response };

            // Attach thumbnail if available
            if (data.thumbnail?.source) {
                messageOptions = {
                    image: { url: data.thumbnail.source },
                    caption: response
                };
            }

            await sock.sendMessage(from, messageOptions, { quoted: msg });

        } catch (err) {
            if (err.response && err.response.status === 404) {
                return sock.sendMessage(from, { text: "❌ Topic not found on Wikipedia. Try capitalizing proper nouns (e.g., 'New York' instead of 'new york')." }, { quoted: msg });
            }
            utils.log("ERROR", `Wiki Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch Wikipedia info." }, { quoted: msg });
        }
    },

    /**
     * Weather Report (.weather)
     */
    handleWeather: async (msg, sock, botState, city) => {
        const from = msg.key.remoteJid;
        if (!city) return sock.sendMessage(from, { text: "❌ Please provide a city! Example: `.weather London`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🌤️", key: msg.key } });

        try {
            // 1. Fetch Text Data (Condition, Temp, Wind, Humidity)
            // Format codes: %C=Condition, %t=Temp, %w=Wind, %h=Humidity
            const textUrl = `https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%w+%h`;
            const { data: textData } = await axios.get(textUrl);

            // 2. Format the caption neatly
            // The raw data looks like: "Sunny +25°C 15km/h 60%"
            // We split it to label it properly.
            const parts = textData.split(' '); // This is a rough split, varies by condition

            // Fallback caption if splitting fails (wttr.in formats can be tricky)
            let caption = `🌤️ *Weather Report for: ${city}*\n\n${textData}`;

            // 3. Send Image + Caption
            // We use ?m for metric (Celsius) or ?u for US (Fahrenheit). Defaulting to Metric (?m)
            await sock.sendMessage(from, {
                image: { url: `https://wttr.in/${encodeURIComponent(city)}.png?m` },
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Weather Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Weather service unavailable (or city not found)." }, { quoted: msg });
        }
    }
};
