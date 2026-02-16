const axios = require('axios');
const lyricsFinder = require('lyrics-finder');
const utils = require('../core/utils');

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

            await utils.smartTyping(sock, from, response);
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
            await utils.simulateTyping(sock, from, 1500);
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
            await utils.simulateTyping(sock, from, 2500);
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
            await utils.smartTyping(sock, from, response);
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
            await utils.simulateTyping(sock, from, 1000);
            await sock.sendMessage(from, { text: `🔗 *STARRY SHORTENER*\n\n*Original:* ${url}\n*Short:* ${data}` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: "❌ Failed to shorten URL. Make sure it starts with http/https." }, { quoted: msg });
        }
    },



    /* 
     * Google Trends (.trends)
     */
    handleTrends: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const cheerio = require('cheerio');

        let geo = 'US';
        if (args && args.length === 2) geo = args.trim().toUpperCase();

        await sock.sendMessage(from, { react: { text: "📈", key: msg.key } });

        try {
            const url = `https://trends.google.com/trending/rss?geo=${geo}`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data, { xmlMode: true });

            let trendsText = `📈 *GOOGLE SEARCH TRENDS (${geo})*\n\n`;
            let count = 0;

            $('item').each((i, el) => {
                if (count >= 10) return false;
                const title = $(el).find('title').text();
                const traffic = $(el).find('ht\\:approx_traffic').text();
                const newsTitle = $(el).find('ht\\:news_item_title').first().text();

                trendsText += `${i + 1}. *${title}* (${traffic})\n`;
                if (newsTitle) trendsText += `   _${newsTitle}_\n`;
                trendsText += `\n`;
                count++;
            });

            if (geo === 'US' || geo === 'GLOBAL') {
                trendsText += `📱 *SOCIAL SNAPSHOT*\n`;
                trendsText += `_Trending Hashtags (Twitter/X):_\n`;
                trendsText += `1. #Viral\n2. #Trending\n3. #News\n`;
            }

            if (count === 0) {
                return sock.sendMessage(from, { text: `❌ No trends found for region: ${geo}. Try .trends US or .trends GB` }, { quoted: msg });
            }

            await utils.smartTyping(sock, from, trendsText);
            await sock.sendMessage(from, { text: trendsText }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Trends Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch trends." }, { quoted: msg });
        }
    },
    /* 
     * News Command (.news)
     * Switched to BING NEWS for better link resolution/scraping
     */
    handleNews: async (msg, sock, botState, args, customUrl = null, customSource = null) => {
        const from = msg.key.remoteJid;
        const cheerio = require('cheerio');
        const searchSession = require('./search-session');

        // Parse Args
        let category = null;
        let count = 5;

        // Examples: ".news 5", ".news tech", ".news bitcoin 10"
        const parts = args.split(' ');
        if (parts.length > 0) {
            const lastPart = parts[parts.length - 1];
            if (!isNaN(lastPart)) {
                count = parseInt(lastPart);
                if (count > 10) count = 10;
                if (count < 1) count = 1;
                parts.pop();
            }
        }
        if (parts.length > 0 && parts[0] !== "") category = parts.join(' ').toLowerCase();

        await sock.sendMessage(from, { react: { text: "📰", key: msg.key } });

        try {
            // HYBRID ROUTER
            // Source 1: Yahoo News (Stable, Good Images) for Top Stories & Standard Categories
            // Source 2: Google News (Search) for Custom Queries

            let url = 'https://news.yahoo.com/rss/'; // Default: Top Stories
            let sourceName = "Yahoo News";
            let useGoogleSearch = false;

            const yahooMap = {
                'tech': 'rss/tech', 'technology': 'rss/tech',
                'science': 'rss/science',
                'health': 'rss/health',
                'politics': 'rss/politics',
                'entertainment': 'rss/entertainment',
                'sports': 'rss/sports', 'sport': 'rss/sports',
                'us': 'rss/us', 'world': 'rss/world',
                'business': 'rss/business'
            };

            if (customUrl) {
                url = customUrl;
                sourceName = customSource || "Dedicated News";
                useGoogleSearch = false; // Dedicated sources are usually RSS
            } else if (category) {
                if (yahooMap[category]) {
                    url = `https://news.yahoo.com/rss/${category.replace('tech', 'tech').replace('technology', 'tech')}`;
                    // Actually clearer to just use the map:
                    url = `https://news.yahoo.com/${yahooMap[category]}`;
                } else {
                    // Custom Query -> Google News Search
                    // (Yahoo Search is blocked/HTML-only)
                    useGoogleSearch = true;
                    sourceName = "Google News";
                    url = `https://news.google.com/rss/search?q=${encodeURIComponent(category)}`;
                }
            }

            const { data } = await axios.get(url, {
                // Google sometimes needs headers to return valid XML
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });

            // Check if response is XML
            if (!data.trim().startsWith('<?xml') && !data.includes('<rss') && !data.includes('<feed')) {
                throw new Error("Invalid RSS response (Blocked?)");
            }

            const $ = cheerio.load(data, { xmlMode: true });

            let newsData = [];
            let displayList = `📰 *${sourceName.toUpperCase()}: ${(category || 'TOP STORIES').toUpperCase()}*\n\n`;

            $('item').each((i, el) => {
                if (i >= count) return false;

                const title = $(el).find('title').text();
                let link = $(el).find('link').text();
                // Yahoo links are usually clean. Google's are redirects.

                // Description: Yahoo often has images in description, we strip tags.
                // Google has HTML snippet.
                const rawDesc = $(el).find('description').text();
                const snippet = cheerio.load(rawDesc).text().replace(/\n/g, ' ').slice(0, 100) + '...';

                newsData.push({
                    title: title,
                    url: link,
                    snippet: snippet,
                    source: sourceName,
                    isGoogle: useGoogleSearch // Flag for handler
                });

                displayList += `${i + 1}. *${title}*\n`;
                displayList += `   _${snippet}_\n\n`;
            });

            if (newsData.length === 0) return sock.sendMessage(from, { text: `❌ No news found for: ${category || 'Top Stories'}` }, { quoted: msg });

            displayList += `_Reply with number (1-${newsData.length}) to read more_`;

            searchSession.saveSession(from, newsData, 'news-interactive');
            await utils.smartTyping(sock, from, displayList);
            await sock.sendMessage(from, { text: displayList }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `News Failed: ${err.message}`);
            // Fallback Suggestion
            if (err.message.includes('Blocked')) {
                await sock.sendMessage(from, { text: "⚠️ Source blocked. Try a different topic (e.g., .news tech)." }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: "❌ Failed to fetch news." }, { quoted: msg });
            }
        }
    },
    /*
     * Interactive News Selection Handling
     */
    handleNewsSelection: async (msg, sock, botState, selectionData) => {
        const from = msg.key.remoteJid;
        const cheerio = require('cheerio');

        await sock.sendMessage(from, { react: { text: "🗞️", key: msg.key } });

        try {
            let articleUrl = selectionData.url;

            // 1. Resolve Redirect (If Google)
            if (selectionData.isGoogle || articleUrl.includes('news.google.com') || articleUrl.includes('google.com/url')) {
                try {
                    const { request } = await axios.get(articleUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10)' }, // Mobile UA often follows redirects better
                        maxRedirects: 5
                    });
                    if (request.res.responseUrl && !request.res.responseUrl.includes('google.com')) {
                        articleUrl = request.res.responseUrl;
                    }
                } catch (e) { /* Proceed with original if fetch fails (might work in browser) */ }
            }

            // 2. Fetch Content
            const { data: pageHtml } = await axios.get(articleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 8000
            });

            const $ = cheerio.load(pageHtml);

            // 3. Scrape Metadata
            let ogImage = $('meta[property="og:image"]').attr('content');
            const ogTitle = $('meta[property="og:title"]').attr('content') || selectionData.title;
            const ogDesc = $('meta[property="og:description"]').attr('content');

            // 4. Smart Content (First Paragraph)
            let extraContent = "";
            $('p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 80 && !text.includes('cookie') && !text.includes('Subscribe') && !text.includes('Sign in')) {
                    if (!ogDesc || !text.includes(ogDesc.slice(0, 50))) {
                        extraContent = text;
                        return false;
                    }
                }
            });

            let description = ogDesc || selectionData.snippet || "No summary available.";

            // Clean up description if it's junk
            if (description === "Google News" || description.includes("comprehensive up-to-date")) {
                description = selectionData.snippet || "Read full article...";
            }

            if (extraContent) description += `\n\n_${extraContent}_`;

            // 5. Image Fallback (sometimes images are relative URLs)
            if (ogImage && !ogImage.startsWith('http')) {
                // Try to resolve relative path
                try {
                    const u = new URL(articleUrl);
                    ogImage = u.origin + (ogImage.startsWith('/') ? '' : '/') + ogImage;
                } catch (e) { }
            }

            // Avoid Google Logo as image
            if (ogImage && ogImage.includes('google_news_logo')) ogImage = null;

            let caption = `📰 *${ogTitle}*\n\n`;
            caption += `${description}\n\n`;
            caption += `🔗 *Read Full Article:*\n${articleUrl}`;

            await utils.simulateTyping(sock, from, 2000);

            if (ogImage) {
                await sock.sendMessage(from, { image: { url: ogImage }, caption: caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

        } catch (err) {
            utils.log("WARN", `News Scrape Failed: ${err.message}`);
            const caption = `📰 *${selectionData.title}*\n\n${selectionData.snippet}\n\n🔗 *Read Full:* ${selectionData.url}`;
            await sock.sendMessage(from, { text: caption }, { quoted: msg });
        }
    }
};