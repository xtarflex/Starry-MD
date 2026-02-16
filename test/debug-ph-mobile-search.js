
const axios = require('axios');
const fs = require('fs');

async function debugMobileSearch() {
    const query = 'fuck';
    const url = `https://m.pornhub.com/video/search?search=${encodeURIComponent(query)}`;

    try {
        console.log(`Fetching Mobile Search Page: ${url}`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
                'Cookie': 'age_verified=1'
            },
            timeout: 10000
        });

        fs.writeFileSync('ph_mobile_search_debug.html', data);
        console.log("Saved mobile search page to ph_mobile_search_debug.html");

    } catch (e) {
        console.error("Mobile Search Fetch Failed:", e.message);
    }
}

debugMobileSearch();
