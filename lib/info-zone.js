const axios = require('axios');
const lyricsFinder = require('lyrics-finder');
const utils = require('./utils');

/* 
 * Information Suite - Knowledge & Utilities
 */
module.exports = {
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

    /* 
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
            let caption = `🌤️ *WEATHER REPORT: ${city.toUpperCase()}*\n\n`;

            if (parts.length >= 3) {
                caption += `🌡️ *Temp:* ${parts[1]}\n`;
                caption += `☁️ *Condition:* ${parts[0]}\n`;
                caption += `🌬️ *Wind:* ${parts[2]}\n`;
                caption += `💧 *Humidity:* ${parts[3] || 'N/A'}\n`;
            } else {
                caption += `📝 ${textData}`;
            }

            caption += `\n╰───────────────`;

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
    },

    /* 
     * Pinterest Search (.pint)
     */
    handlePint: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const gis = require('g-i-s');
        const axios = require('axios');

        // Parse args for query and optional count
        let query = args;
        let count = 5;

        const parts = args.split(' ');
        const lastPart = parts[parts.length - 1];
        if (!isNaN(lastPart) && parts.length > 1) {
            count = parseInt(lastPart);
            if (count > 10) count = 10;
            if (count < 1) count = 1;
            query = parts.slice(0, -1).join(' ');
        }

        if (!query) return sock.sendMessage(from, { text: "❌ Please provide a search term!\nExample: `.pint aesthetic wallpaper 5`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

        try {
            const results = await new Promise((resolve, reject) => {
                gis(query, (error, results) => {
                    if (error) reject(error);
                    else resolve(results);
                });
            });

            if (!results || results.length === 0) {
                return sock.sendMessage(from, { text: "❌ No images found for that query." }, { quoted: msg });
            }

            // 1. Filter unique URLs
            const uniqueResults = [];
            const seenUrls = new Set();
            for (const res of results) {
                if (!seenUrls.has(res.url)) {
                    seenUrls.add(res.url);
                    uniqueResults.push(res);
                }
            }

            // 2. Shuffle using Fisher-Yates
            for (let i = uniqueResults.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [uniqueResults[i], uniqueResults[j]] = [uniqueResults[j], uniqueResults[i]];
            }

            // 3. Download Images First
            const albumMedia = [];
            let attempts = 0;
            const maxAttempts = Math.min(uniqueResults.length, 20); // Try 20 to get 'count' valid ones

            while (albumMedia.length < count && attempts < maxAttempts) {
                const imgData = uniqueResults[attempts];
                attempts++;

                try {
                    // Download image to buffer
                    const { data } = await axios.get(imgData.url, {
                        responseType: 'arraybuffer',
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });

                    // Store buffer
                    albumMedia.push({ buffer: data });

                } catch (dlErr) {
                    continue; // Skip failed downloads
                }
            }

            if (albumMedia.length === 0) {
                await sock.sendMessage(from, { text: "❌ Failed to download any images." }, { quoted: msg });
                return;
            }

            // 4. Send as Album
            await utils.sendAlbum(sock, from, albumMedia, {
                caption: `🎨 *Google Image:* ${query} (${albumMedia.length})`,
                quoted: msg,
                delay: 250 // Fast burst for efficient album grouping
            });

        } catch (err) {
            utils.log("ERROR", `Pint Search Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to search images." }, { quoted: msg });
        }
    },

    /* 
     * Dictionary (.define)
     */
    handleDefine: async (msg, sock, botState, word) => {
        const from = msg.key.remoteJid;
        if (!word) return sock.sendMessage(from, { text: "❌ Please provide a word to define!\nExample: `.define persistence`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "📖", key: msg.key } });

        try {
            const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            const entry = data[0];

            let response = `📖 *DICTIONARY: ${entry.word.toUpperCase()}*\n`;
            if (entry.phonetic) response += `🗣️ [${entry.phonetic}]\n`;
            response += `\n`;

            entry.meanings.slice(0, 2).forEach(m => {
                response += `🔹 *${m.partOfSpeech}:*\n`;
                m.definitions.slice(0, 2).forEach((d, i) => {
                    response += `   ${i + 1}. ${d.definition}\n`;
                    if (d.example) response += `      _"${d.example}"_\n`;
                });
                response += `\n`;
            });

            response += `╰───────────────`;
            await sock.sendMessage(from, { text: response }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Word "${word}" not found in our lexicon.` }, { quoted: msg });
        }
    },

    /* 
     * Google Search Fallback (.google)
     */
    handleGoogle: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Please provide a search query!" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

        try {
            // Using a simple search preview service for cleanliness
            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            await sock.sendMessage(from, {
                text: `🔍 *STARRY SEARCH*\n\nYour query: *${query}*\n\nI recommend checking the results directly here:\n🔗 ${url}\n\n_Or try .wiki for a detailed summary._`
            }, { quoted: msg });

        } catch (err) {
            await sock.sendMessage(from, { text: "❌ Search service encountered an error." }, { quoted: msg });
        }
    },

    /* 
     * URL Shortener (.shorten)
     */
    handleShorten: async (msg, sock, botState, url) => {
        const from = msg.key.remoteJid;
        if (!url) return sock.sendMessage(from, { text: "❌ Please provide a URL to shorten!" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🔗", key: msg.key } });

        try {
            // Migrated from retired TinyURL to is.gd (no key required)
            const { data } = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
            await sock.sendMessage(from, { text: `🔗 *STARRY SHORTENER*\n\n*Original:* ${url}\n*Short:* ${data}` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: "❌ Failed to shorten URL. Make sure it starts with http/https." }, { quoted: msg });
        }
    }
};
