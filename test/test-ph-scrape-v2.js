
const axios = require('axios');
const cheerio = require('cheerio');

async function testSearchScrape() {
    const query = 'funny';
    const searchUrl = `https://www.pornhub.com/video/search?search=${encodeURIComponent(query)}`;

    try {
        console.log(`Searching Pornhub for: ${query}...`);
        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': 'age_verified=1'
            }
        });

        const $ = cheerio.load(data);
        console.log("Parsing search results...");

        const results = [];
        $('.videoURL').each((i, el) => {
            const link = $(el).attr('href');
            const title = $(el).text().trim();
            if (link && !results.some(r => r.link === link)) {
                results.push({
                    title: title,
                    link: `https://www.pornhub.com${link}`,
                    viewkey: link.split('viewkey=')[1]
                });
            }
        });

        console.log(`Found ${results.length} search results.`);
        if (results.length > 0) {
            const first = results[0];
            console.log(`First Result: ${first.title} (${first.link})`);

            // Now try to scrape the first video's page
            console.log(`\nFetching video page: ${first.link}...`);
            const videoPage = await axios.get(first.link, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Cookie': 'age_verified=1'
                }
            });

            const $vid = cheerio.load(videoPage.data);
            console.log("Searching for flashvars in video page...");

            let foundFlashvars = false;
            $vid('script').each((i, el) => {
                const content = $vid(el).html();
                if (content.includes('flashvars_')) {
                    console.log("Found flashvars script tag!");
                    foundFlashvars = true;
                    // Extract duration or other meta if needed
                    const durationMatch = content.match(/"video_duration":"(\d+)"/);
                    if (durationMatch) {
                        console.log(`Duration from script: ${durationMatch[1]} seconds`);
                    }
                }
            });

            if (!foundFlashvars) {
                console.log("flashvars not found. Checking for mediaDefinitions in plain text...");
                if (videoPage.data.includes('mediaDefinitions')) {
                    console.log("mediaDefinitions keyword found in HTML source.");
                }
            }

        } else {
            console.log("No search results found. Site might be blocking or structure changed.");
        }

    } catch (err) {
        console.error("Scrape Error:", err.message);
    }
}

testSearchScrape();
