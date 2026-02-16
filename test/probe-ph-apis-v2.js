
const axios = require('axios');

async function probeNewAPIs() {
    const testUrl = 'https://www.pornhub.com/view_video.php?viewkey=ph63f8dca34b76a';
    const endpoints = [
        `https://api.betabotz.eu.org/api/download/pornhub?url=${encodeURIComponent(testUrl)}&apikey=free`,
        `https://api.botcahx.eu.org/api/dowloader/pornhub?url=${encodeURIComponent(testUrl)}&apikey=free`,
        `https://api.vreden.my.id/api/phdl?url=${encodeURIComponent(testUrl)}`,
        `https://api.agatz.xyz/api/phdownloader?url=${encodeURIComponent(testUrl)}`,
        `https://api.ryzendesu.vip/api/downloader/pornhub?url=${encodeURIComponent(testUrl)}`
    ];

    console.log("Probing new API endpoints...");
    for (const url of endpoints) {
        try {
            console.log(`\nProbing: ${url}`);
            const { data } = await axios.get(url, { timeout: 10000 });
            if (data.status === true || data.status === 200 || data.code === 200 || data.result) {
                console.log(`[FOUND!] Data: ${JSON.stringify(data).substring(0, 500)}`);
            } else {
                console.log(`[FAILED] Status: ${data.status || data.code || 'unknown'}`);
                console.log(`Response: ${JSON.stringify(data).substring(0, 100)}`);
            }
        } catch (e) {
            console.log(`[ERROR] ${e.message}`);
        }
    }
}

probeNewAPIs();
