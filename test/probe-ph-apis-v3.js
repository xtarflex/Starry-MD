
const axios = require('axios');

async function probeEnhanced() {
    const testUrl = 'https://www.pornhub.com/view_video.php?viewkey=ph63f8dca34b76a';
    const endpoints = [
        `https://api.agatz.xyz/api/phdownloader?url=${encodeURIComponent(testUrl)}`,
        `https://api.agatz.xyz/api/phsearch?query=petite`,
        `https://api.vreden.my.id/api/phdownloader?url=${encodeURIComponent(testUrl)}`
    ];

    console.log("Probing with enhanced headers...");
    for (const url of endpoints) {
        try {
            console.log(`\nProbing: ${url}`);
            const { data } = await axios.get(url, {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
                    'Referer': 'https://api.agatz.xyz/'
                }
            });
            console.log(`[SUCCESS?] Data: ${JSON.stringify(data).substring(0, 500)}`);
        } catch (e) {
            console.log(`[ERROR] ${e.message}`);
            if (e.response) {
                console.log(`Response Code: ${e.response.status}`);
                console.log(`Response Data: ${JSON.stringify(e.response.data).substring(0, 200)}`);
            }
        }
    }
}

probeEnhanced();
