
const axios = require('axios');

async function testPHLogic() {
    const testQueries = ['petite', 'https://www.pornhub.com/view_video.php?viewkey=ph63f8dca34b76a']; // Sample viewkey (might be expired, but tests extraction logic)

    console.log("--- STARTING .PH LOGIC TEST ---");

    for (const input of testQueries) {
        console.log(`\nTesting Input: ${input}`);
        const isUrl = input.includes('pornhub.com/view_video.php');

        try {
            if (isUrl) {
                console.log("Mode: URL Extraction");
                const { data } = await axios.get(`https://api.agatz.xyz/api/phdownloader?url=${encodeURIComponent(input)}`);
                if (data.status && data.data) {
                    console.log(`[SUCCESS] Title: ${data.data.title}`);
                    console.log(`[SUCCESS] Duration: ${data.data.duration}`);
                    console.log(`[SUCCESS] URL Found: ${!!(data.data.url || data.data.video)}`);
                } else {
                    console.log("[FAIL] Agatz API failed to extract.");
                }
            } else {
                console.log("Mode: Search + Duration Filter");
                const { data } = await axios.get(`https://api.agatz.xyz/api/phsearch?query=${encodeURIComponent(input)}`);
                if (data.status && data.data) {
                    console.log(`Total Search Results: ${data.data.length}`);

                    const filtered = data.data.filter(v => {
                        if (!v.duration) return true;
                        const parts = v.duration.split(':').map(Number);
                        let secs = 0;
                        if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
                        return secs <= 600;
                    });

                    console.log(`Results under 10m: ${filtered.length}`);
                    if (filtered.length > 0) {
                        console.log(`[SUCCESS] Selected: ${filtered[0].title} (${filtered[0].duration})`);
                    } else {
                        console.log("[FAIL] No results under 10m found.");
                    }
                } else {
                    console.log("[FAIL] Agatz API search failed.");
                }
            }
        } catch (err) {
            console.log(`[ERROR] Test Failed: ${err.message}`);
        }
    }
}

testPHLogic();
