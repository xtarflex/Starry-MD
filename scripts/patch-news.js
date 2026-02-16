const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/info-zone.js');
let content = fs.readFileSync(filePath, 'utf8');

console.log("Reading info-zone.js...");

// 1. Replace URL Construction & Topic Map
const googleUrlBlock = `            // Bing News RSS
            let url = 'https://www.bing.com/news/search?q=top+stories&format=rss'; // Top stories

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
            }`;

// We already successfully replaced the "let url" part in Step 271. 
// So searching for "let url = 'https://news.google.com/rss';" will FAIL.
// We need to look for what IS there now.

// Step 271 changed:
// let url = 'https://news.google.com/rss'; -> let url = 'https://www.bing.com/news/search?q=top+stories&format=rss';

// Step 286 changed topicMap... Wait, Step 286 SUCCEEDED in the tool call but then I got an error in Step 287? No Step 286 output says "tool call completed". Step 287 was "error executing cascade".
// Ah, Step 286 was `replace_file_content`. Did it succeed? 
// Step 286 said "tool call completed".
// Step 287 was an error. 
// Step 274 SHOWS the `replace_file_content` output for Step 273.
// IT DID CHANGE!
// So lines 413-434 ARE changed to Bing logic.

// So, logic for URL and TopicMap is ALREADY DONE?
// Let's verify with the Loop.
// I failed to replace the LOOP.

// 2. Replace the Loop
// Original (Google) loop structure:
// $('item').each((i, el) => { ... const link = $(el).find('link').text(); ... displayList += ... });

const loopRegex = /\$\('item'\)\.each\(\(i, el\) => \{[\s\S]*?displayList \+= \`[\s\S]*?\n\s*\}\);/m;

const bingLoop = `$('item').each((i, el) => {
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
            });`;

if (loopRegex.test(content)) {
    console.log("Found Loop Block. Replacing...");
    content = content.replace(loopRegex, bingLoop);
} else {
    console.log("❌ Loop Block NOT Found (regex mismatch).");
    // Print a snippet to see what's there
    const match = content.match(/\$\('item'\)\.each/);
    if (match) {
        console.log("Context near item loop:\n", content.slice(match.index, match.index + 200));
    }
}

// 3. Replace handleNewsSelection (Google Redirect Logic)
// Look for "Resolve Google Redirect"
const googleRedirectRegex = /\/\/ 1\. Resolve Google Redirect[\s\S]*?const \$ = cheerio\.load\(pageHtml\);/m;

const simpleFetch = `// 1. Fetch Page
            const { data: pageHtml } = await axios.get(articleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 8000
            });

            const $ = cheerio.load(pageHtml);`;

if (googleRedirectRegex.test(content)) {
    console.log("Found Google Redirect Block. Replacing...");
    content = content.replace(googleRedirectRegex, simpleFetch);
} else {
    console.log("❌ Google Redirect Block NOT Found.");
}

// 4. Update Header "GOOGLE NEWS" -> "NEWS"
content = content.replace("📰 *GOOGLE NEWS", "📰 *NEWS");

fs.writeFileSync(filePath, content);
console.log("Patch applied.");
