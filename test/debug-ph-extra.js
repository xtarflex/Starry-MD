
const axios = require('axios');
const fs = require('fs');

async function debugExtra() {
    const queries = {
        gif: 'https://www.pornhub.com/gifs/search?search=funny',
        star: 'https://www.pornhub.com/pornstars/search?search=sasha'
    };

    for (const [key, url] of Object.entries(queries)) {
        try {
            console.log(`Fetching ${key} Page: ${url}`);
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Cookie': 'age_verified=1'
                },
                timeout: 10000
            });

            fs.writeFileSync(`ph_${key}_debug.html`, data);
            console.log(`Saved ${key} page to ph_${key}_debug.html`);
        } catch (e) {
            console.error(`${key} Fetch Failed:`, e.message);
        }
    }
}

debugExtra();
