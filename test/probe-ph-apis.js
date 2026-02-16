
const axios = require('axios');

async function probeAPIs() {
    const testUrl = 'https://www.pornhub.com/view_video.php?viewkey=ph63f8dca34b76a';
    const endpoints = [
        `https://api.agatz.xyz/api/phdownloader?url=${encodeURIComponent(testUrl)}`,
        `https://api.agatz.xyz/api/pornhub?url=${encodeURIComponent(testUrl)}`,
        `https://api.ryzendesu.vip/api/downloader/phdl?url=${encodeURIComponent(testUrl)}`,
        `https://api.ryzendesu.vip/api/downloader/pornhub?url=${encodeURIComponent(testUrl)}`,
        `https://api.dreaded.site/api/phdownloader?url=${encodeURIComponent(testUrl)}`,
        `https://api.dreaded.site/api/pornhub?url=${encodeURIComponent(testUrl)}`
    ];

    console.log("Probing API endpoints...");
    for (const url of endpoints) {
        try {
            console.log(`\nProbing: ${url}`);
            const { data } = await axios.get(url, { timeout: 5000 });
            if (data.status === 200 || data.code === 0 || data.success) {
                console.log(`[FOUND!] Data: ${JSON.stringify(data).substring(0, 200)}`);
            } else {
                console.log(`[FAILED] Status: ${data.status || data.code}`);
            }
        } catch (e) {
            console.log(`[ERROR] ${e.message}`);
        }
    }
}

probeAPIs();
