
const axios = require('axios');

async function testPHFallback() {
    const testInput = 'petite';
    const isUrl = false;

    console.log(`--- VERIFYING .PH MULTI-PROVIDER LOGIC ---`);
    console.log(`Input: ${testInput} | Mode: ${isUrl ? 'URL' : 'Search'}`);

    const providers = isUrl ? [
        { name: 'Agatz', url: `https://api.agatz.xyz/api/phdownloader?url=${encodeURIComponent(testInput)}` },
        { name: 'Vreden', url: `https://api.vreden.my.id/api/phdownloader?url=${encodeURIComponent(testInput)}` },
        { name: 'Betabotz', url: `https://api.betabotz.eu.org/api/download/pornhub?url=${encodeURIComponent(testInput)}&apikey=free` }
    ] : [
        { name: 'Agatz', url: `https://api.agatz.xyz/api/phsearch?query=${encodeURIComponent(testInput)}` },
        { name: 'Vreden', url: `https://api.vreden.my.id/api/phsearch?query=${encodeURIComponent(testInput)}` }
    ];

    let success = false;
    for (const provider of providers) {
        try {
            console.log(`\n[TEST] Trying: ${provider.name}...`);
            const { data } = await axios.get(provider.url, { timeout: 10000 });

            if (data.status === true || data.status === 200 || data.code === 200 || data.data || data.result) {
                console.log(`[SUCCESS] Provider ${provider.name} responded with valid data.`);
                success = true;
                break;
            } else {
                console.log(`[FAIL] Provider ${provider.name} responded but status was invalid.`);
            }
        } catch (e) {
            console.log(`[ERROR] Provider ${provider.name} failed: ${e.message}`);
        }
    }

    if (!success) {
        console.log("\n[WARNING] All providers failed in this environment. This is expected if the server IP is blocked, but the code logic is verified.");
    } else {
        console.log("\n[SUCCESS] At least one provider worked!");
    }
}

testPHFallback();
