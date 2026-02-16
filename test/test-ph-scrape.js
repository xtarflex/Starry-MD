
const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape() {
    const url = 'https://www.pornhub.com/view_video.php?viewkey=67be57a6f2eb5';
    try {
        console.log(`Fetching ${url}...`);
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': 'age_verified=1'
            }
        });

        const $ = cheerio.load(data);
        console.log("Searching for flashvars in scripts...");

        // Search for the script tag containing flashvars
        let flashvars = null;
        $('script').each((i, el) => {
            const content = $(el).html();
            if (content.includes('flashvars_')) {
                console.log("Found flashvars script tag!");
                // Extract the JSON-like part
                const match = content.match(/flashvars_\d+\s*=\s*({.*?});/s);
                if (match) {
                    try {
                        flashvars = JSON.parse(match[1]);
                        console.log("Successfully parsed flashvars JSON.");
                    } catch (e) {
                        console.log("Found match but failed to parse JSON.");
                    }
                }
            }
        });

        if (flashvars) {
            console.log("Metadata keys:", Object.keys(flashvars));
            console.log("Video Title:", flashvars.video_title);
            console.log("Duration (seconds):", flashvars.video_duration);

            // Search for direct video URLs in mediaDefinitions
            if (flashvars.mediaDefinitions) {
                console.log("Direct URLs found in mediaDefinitions!");
                flashvars.mediaDefinitions.forEach(def => {
                    if (def.videoUrl) {
                        console.log(`- Format: ${def.format}, Quality: ${def.quality}, URL: ${def.videoUrl.substring(0, 50)}...`);
                    }
                });
            }
        } else {
            console.log("Flashvars not found in script tags.");
            // Fallback: check if it's in a different variable
            if (data.includes('mediaDefinitions')) {
                console.log("Keyword 'mediaDefinitions' found in HTML, but flashvars parsing failed.");
            }
        }

    } catch (err) {
        console.error("Scrape Error:", err.message);
    }
}

testScrape();
