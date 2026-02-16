
const axios = require('axios');
const fs = require('fs');

async function debugSearch() {
    const query = 'fuck';
    const url = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`;

    try {
        console.log(`Fetching Search Page: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Cookie': 'age_verified=1'
            },
            timeout: 10000
        });

        fs.writeFileSync('ph_search_debug.html', data);
        console.log("Saved search page to ph_search_debug.html");

        // Quick regex check for common video link patterns
        const links = data.match(/\/view_video\.php\?viewkey=[a-z0-9]+/gi);
        console.log(`Found ${links ? links.length : 0} potential video links via Regex.`);
        if (links) {
            console.log("Sample link:", links[0]);
        }

    } catch (e) {
        console.error("Search Fetch Failed:", e.message);
    }
}

debugSearch();
