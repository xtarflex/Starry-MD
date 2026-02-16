const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/info-zone.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log("Reading info-zone.js...");

// We will find the block starting with "handleNews:" and ending before "handleNewsSelection:"
// And "handleNewsSelection:" to the end of the object.

// Helper to replace a function block robustly
function replaceFunction(source, funcName, newCode) {
    const startIdx = source.indexOf(`${funcName}: async`);
    if (startIdx === -1) {
        console.log(`❌ Function ${funcName} not found!`);
        return source;
    }

    // Find matching bracket
    let braceCount = 0;
    let foundStart = false;
    let endIdx = -1;

    for (let i = startIdx; i < source.length; i++) {
        if (source[i] === '{') {
            braceCount++;
            foundStart = true;
        } else if (source[i] === '}') {
            braceCount--;
        }

        if (foundStart && braceCount === 0) {
            endIdx = i + 1; // Include closing brace
            break;
        }
    }

    if (endIdx !== -1) {
        // Check for preceding comma or comments if we want to be clean, 
        // but replacing the range [startIdx, endIdx] is sufficient for the function body.
        console.log(`✅ Replacing ${funcName}...`);
        return source.substring(0, startIdx) + newCode + source.substring(endIdx);
    } else {
        console.log(`❌ Cound not find end of ${funcName}`);
        return source;
    }
}

const newHandleNews = `handleNews: async (msg, sock, botState, args) => {
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

            if (category) {
                if (yahooMap[category]) {
                    url = \`https://news.yahoo.com/rss/\${category.replace('tech', 'tech').replace('technology','tech')}\`; 
                    // Actually clearer to just use the map:
                    url = \`https://news.yahoo.com/\${yahooMap[category]}\`;
                } else {
                    // Custom Query -> Google News Search
                    // (Yahoo Search is blocked/HTML-only)
                    useGoogleSearch = true;
                    sourceName = "Google News";
                    url = \`https://news.google.com/rss/search?q=\${encodeURIComponent(category)}\`;
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
            let displayList = \`📰 *\${sourceName.toUpperCase()}: \${(category || 'TOP STORIES').toUpperCase()}*\\n\\n\`;

            $('item').each((i, el) => {
                if (i >= count) return false;

                const title = $(el).find('title').text();
                let link = $(el).find('link').text();
                // Yahoo links are usually clean. Google's are redirects.
                
                // Description: Yahoo often has images in description, we strip tags.
                // Google has HTML snippet.
                const rawDesc = $(el).find('description').text();
                const snippet = cheerio.load(rawDesc).text().replace(/\\n/g, ' ').slice(0, 100) + '...';

                newsData.push({
                    title: title,
                    url: link,
                    snippet: snippet,
                    source: sourceName,
                    isGoogle: useGoogleSearch // Flag for handler
                });

                displayList += \`\${i + 1}. *\${title}*\\n\`;
                displayList += \`   _\${snippet}_\\n\\n\`;
            });

            if (newsData.length === 0) return sock.sendMessage(from, { text: \`❌ No news found for: \${category || 'Top Stories'}\` }, { quoted: msg });

            displayList += \`_Reply with number (1-\${newsData.length}) to read more_\`;

            searchSession.saveSession(from, newsData, 'news-interactive');
            await utils.smartTyping(sock, from, displayList);
            await sock.sendMessage(from, { text: displayList }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", \`News Failed: \${err.message}\`);
            // Fallback Suggestion
            if (err.message.includes('Blocked')) {
                await sock.sendMessage(from, { text: "⚠️ Source blocked. Try a different topic (e.g., .news tech)." }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: "❌ Failed to fetch news." }, { quoted: msg });
            }
        }
    }`;

const newHandleSelection = `handleNewsSelection: async (msg, sock, botState, selectionData) => {
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
                } catch(e) { /* Proceed with original if fetch fails (might work in browser) */ }
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

            if (extraContent) description += \`\\n\\n_\${extraContent}_\`;

            // 5. Image Fallback (sometimes images are relative URLs)
            if (ogImage && !ogImage.startsWith('http')) {
                // Try to resolve relative path
                try {
                    const u = new URL(articleUrl);
                    ogImage = u.origin + (ogImage.startsWith('/') ? '' : '/') + ogImage;
                } catch(e) {}
            }

            // Avoid Google Logo as image
            if (ogImage && ogImage.includes('google_news_logo')) ogImage = null;

            let caption = \`📰 *\${ogTitle}*\\n\\n\`;
            caption += \`\${description}\\n\\n\`;
            caption += \`🔗 *Read Full Article:*\\n\${articleUrl}\`;

            await utils.simulateTyping(sock, from, 2000);

            if (ogImage) {
                await sock.sendMessage(from, { image: { url: ogImage }, caption: caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

        } catch (err) {
            utils.log("WARN", \`News Scrape Failed: \${err.message}\`);
            const caption = \`📰 *\${selectionData.title}*\\n\\n\${selectionData.snippet}\\n\\n🔗 *Read Full:* \${selectionData.url}\`;
            await sock.sendMessage(from, { text: caption }, { quoted: msg });
        }
    }`;

content = replaceFunction(content, 'handleNews', newHandleNews);
content = replaceFunction(content, 'handleNewsSelection', newHandleSelection);

fs.writeFileSync(filePath, content);
console.log("Router Patch Applied.");
