
const axios = require('axios');

async function probeFinal() {
    const testUrl = 'https://www.pornhub.com/view_video.php?viewkey=67be57a6f2eb5';
    const endpoints = [
        `https://api.shizuhub.xyz/api/download/pornhub?url=${encodeURIComponent(testUrl)}`,
        `https://skizo.tech/api/pornhub?url=${encodeURIComponent(testUrl)}&apikey=free`,
        `https://api.agatz.xyz/api/phdownloader?url=${encodeURIComponent(testUrl)}`, // Test again just in case
        `https://api.betabotz.eu.org/api/download/pornhub?url=${encodeURIComponent(testUrl)}&apikey=free`
    ];

    console.log("Probing final potential API endpoints...");
    for (const url of endpoints) {
        try {
            console.log(`\nProbing: ${url}`);
            const { data } = await axios.get(url, { timeout: 10000 });
            console.log(`[SUCCESS?] Data: ${JSON.stringify(data).substring(0, 500)}`);
        } catch (e) {
            console.log(`[ERROR] ${e.message}`);
        }
    }
}

probeFinal();
