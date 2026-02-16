const axios = require('axios');
const cheerio = require('cheerio');

async function checkBingRSS() {
    console.log("Fetching Bing News RSS...");
    try {
        // Bing News RSS format
        const url = "https://www.bing.com/news/search?q=technology&format=rss";
        const { data } = await axios.get(url);
        const $ = cheerio.load(data, { xmlMode: true });

        $('item').each((i, el) => {
            if (i >= 3) return false;
            const title = $(el).find('title').text();
            const link = $(el).find('link').text();
            const desc = $(el).find('description').text();

            console.log(`\n--- Item ${i + 1} ---`);
            console.log(`Title: ${title}`);
            console.log(`Link: ${link}`);
            // Check if link is a redirect or direct
            if (link.includes('bing.com/news/apiclick')) {
                console.log("IS REDIRECT. Testing resolution...");
            } else {
                console.log("IS DIRECT LINK (Great!)");
            }
        });
    } catch (err) {
        console.error("Bing RSS Failed:", err.message);
    }
}

checkBingRSS();
