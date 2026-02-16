
const axios = require('axios');

async function testFinalScraper() {
    const url = 'https://www.pornhub.com/view_video.php?viewkey=ph63f8dca34b76a';
    try {
        console.log(`Attempting to scrape ${url} with high-fidelity headers...`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cookie': 'age_verified=1'
            },
            timeout: 10000
        });

        console.log("Got response. Searching for mediaDefinitions via Regex...");

        // Look for flashvars or mediaDefinitions
        const mediaMatch = data.match(/mediaDefinitions\s*:\s*(\[.*?\]),/s);
        if (mediaMatch) {
            console.log("Found mediaDefinitions array in script!");
            try {
                // Trying to parse as JSON (might need cleaning)
                let jsonStr = mediaMatch[1];
                // Replace some common JS-only things if needed (e.g. unquoted keys)
                const media = JSON.parse(jsonStr);
                console.log(`[SUCCESS] Extracted ${media.length} qualities.`);
                media.forEach(m => {
                    console.log(`- Quality: ${m.quality}, URL: ${m.videoUrl.substring(0, 50)}...`);
                });
            } catch (e) {
                console.log("Found array but failed to parse JSON directly. Might require manual extraction.");
                // Manual extraction of first videoUrl
                const urlMatch = mediaMatch[1].match(/"videoUrl"\s*:\s*"(.*?)"/);
                if (urlMatch) {
                    console.log(`[SUCCESS] Found videoUrl via secondary Regex: ${urlMatch[1].substring(0, 50)}...`);
                }
            }
        } else {
            console.log("mediaDefinitions not found via Regex.");
            if (data.includes('flashvars_')) {
                console.log("flashvars variable found, but mediaDefinitions extraction failed.");
            }
        }

    } catch (err) {
        console.log(`[ERROR] Scraper Failed: ${err.message}`);
        if (err.response) {
            console.log(`Status: ${err.response.status}`);
        }
    }
}

testFinalScraper();
