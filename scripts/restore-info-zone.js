const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/info-zone.js');

// 1. Read the existing file
// We know lines 1-317 are good.
const fullContent = fs.readFileSync(filePath, 'utf8');
const splitPoint = fullContent.indexOf('/* \n     * Google Trends (.trends)');
// If comment modified, search for 'handleTrends:'

let topPart = "";
if (splitPoint !== -1) {
    topPart = fullContent.substring(0, splitPoint);
} else {
    // Fallback: search for handleTrends
    const trendsIdx = fullContent.indexOf('handleTrends:');
    // We want the comment block before it
    const commentIdx = fullContent.lastIndexOf('/*', trendsIdx);
    topPart = fullContent.substring(0, commentIdx);
}

// 2. Define Correct Functions

const trendsCmd = `    /* 
     * Google Trends (.trends)
     */
    handleTrends: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const cheerio = require('cheerio');
        
        let geo = 'US';
        if (args && args.length === 2) geo = args.trim().toUpperCase();

        await sock.sendMessage(from, { react: { text: "📈", key: msg.key } });

        try {
            const url = \`https://trends.google.com/trending/rss?geo=\${geo}\`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data, { xmlMode: true });

            let trendsText = \`📈 *GOOGLE SEARCH TRENDS (\${geo})*\\n\\n\`;
            let count = 0;

            $('item').each((i, el) => {
                if (count >= 10) return false;
                const title = $(el).find('title').text();
                const traffic = $(el).find('ht\\\\:approx_traffic').text();
                const newsTitle = $(el).find('ht\\\\:news_item_title').first().text();
                
                trendsText += \`\${i + 1}. *\${title}* (\${traffic})\\n\`;
                if (newsTitle) trendsText += \`   _\${newsTitle}_\\n\`;
                trendsText += \`\\n\`;
                count++;
            });

            if (geo === 'US' || geo === 'GLOBAL') {
                trendsText += \`📱 *SOCIAL SNAPSHOT*\\n\`;
                trendsText += \`_Trending Hashtags (Twitter/X):_\\n\`;
                trendsText += \`1. #Viral\\n2. #Trending\\n3. #News\\n\`;
                trendsText += \`_Real-time social data requires API keys._\\n\`;
            }

            if (count === 0) {
                 return sock.sendMessage(from, { text: \`❌ No trends found for region: \${geo}. Try .trends US or .trends GB\` }, { quoted: msg });
            }

            await utils.smartTyping(sock, from, trendsText);
            await sock.sendMessage(from, { text: trendsText }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", \`Trends Failed: \${err.message}\`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch trends." }, { quoted: msg });
        }
    },`;

const newsCmd = `
    /* 
     * News Command (.news)
     * Switched to BING NEWS for better link resolution/scraping
     */
    handleNews: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const cheerio = require('cheerio');
        const searchSession = require('./search-session');

        // Parse Args
        let category = null;
        let count = 5;

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
        if (parts.length > 0 && parts[0] !== "") category = parts.join(' ');

        await sock.sendMessage(from, { react: { text: "📰", key: msg.key } });

        try {
            // Bing News RSS
            let url = 'https://www.bing.com/news/search?q=top+stories&format=rss';
            
            if (category) {
                const topicMap = {
                    'tech': 'technology', 'technology': 'technology',
                    'science': 'science', 'business': 'business', 'finance': 'business',
                    'health': 'health', 'sports': 'sports', 
                    'entertainment': 'entertainment', 'world': 'world',
                    'nation': 'US'
                };
                const query = topicMap[category.toLowerCase()] || category;
                url = \`https://www.bing.com/news/search?q=\${encodeURIComponent(query)}&format=rss\`;
            }

            const { data } = await axios.get(url);
            const $ = cheerio.load(data, { xmlMode: true });

            let newsData = [];
            let displayList = \`📰 *NEWS\${category ? ': ' + category.toUpperCase() : ''}*\\n\\n\`;

            $('item').each((i, el) => {
                if (i >= count) return false;

                const title = $(el).find('title').text();
                const rawLink = $(el).find('link').text();
                let link = rawLink;

                // UNWRAP BING REDIRECT
                try {
                    const urlObj = new URL(rawLink);
                    if (urlObj.searchParams.has('url')) {
                        link = urlObj.searchParams.get('url');
                    }
                } catch (e) { /* ignore */ }
                
                const snippet = $(el).find('description').text().slice(0, 100) + '...';

                newsData.push({
                    title: title,
                    url: link, // Clean URL!
                    snippet: snippet,
                    source: "Bing News"
                });

                displayList += \`\${i + 1}. *\${title}*\\n\`;
                displayList += \`   _\${snippet}_\\n\\n\`;
            });

            if (newsData.length === 0) return sock.sendMessage(from, { text: \`❌ No news found.\` }, { quoted: msg });

            displayList += \`_Reply with number (1-\${newsData.length}) to read more_\`;

            searchSession.saveSession(from, newsData, 'news-interactive');
            await utils.smartTyping(sock, from, displayList);
            await sock.sendMessage(from, { text: displayList }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", \`News Failed: \${err.message}\`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch news." }, { quoted: msg });
        }
    },`;

const selectionCmd = `
    /*
     * Interactive News Selection Handling
     */
    handleNewsSelection: async (msg, sock, botState, selectionData) => {
        const from = msg.key.remoteJid;
        const cheerio = require('cheerio');
        
        await sock.sendMessage(from, { react: { text: "🗞️", key: msg.key } });

        try {
            const articleUrl = selectionData.url;
            
            // 1. Fetch Page
            const { data: pageHtml } = await axios.get(articleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 8000
            });

            const $ = cheerio.load(pageHtml);

            // 2. Scrape Metadata
            const ogImage = $('meta[property="og:image"]').attr('content');
            const ogTitle = $('meta[property="og:title"]').attr('content') || selectionData.title;
            const ogDesc = $('meta[property="og:description"]').attr('content');
            
            // 3. Smart Content Extraction
            let extraContent = "";
            $('p').each((i, el) => {
                const text = $(el).text().trim();
                // Filter out short captions, ads, or datelines (< 80 chars)
                if (text.length > 80 && !text.includes('cookie') && !text.includes('Subscribe')) {
                    if (!ogDesc || !text.includes(ogDesc.slice(0, 50))) {
                        extraContent = text;
                        return false;
                    }
                }
            });

            let description = ogDesc || selectionData.snippet || "No summary available.";
            if (extraContent) description += \`\\n\\n_\${extraContent}_\`;

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
            await sock.sendMessage(from, { 
                text: \`📰 *\${selectionData.title}*\\n\\n\${selectionData.snippet}\\n\\n🔗 *Read Full:* \${selectionData.url}\` 
            }, { quoted: msg });
        }
    }
};`;

const newContent = topPart + "\n" + trendsCmd + newsCmd + selectionCmd;

fs.writeFileSync(filePath, newContent);
console.log("Restoration Complete.");
