
const { scrapeAlbumPhotos } = require('../lib/scrapers/ph-album');
const axios = require('axios');
const fs = require('fs-extra');

async function test() {
    console.log("--- DEBUG PH ALBUM SCRAPER ---");
    const url = "https://www.pornhub.com/album/79441445"; // User provided URL
    console.log(`Target URL: ${url}`);

    try {
        console.log("Fetching and scraping...");
        const images = await scrapeAlbumPhotos(url);
        console.log(`\nFound ${images.length} images:`);
        images.forEach((img, i) => console.log(`${i + 1}. ${img}`));

        if (images.length === 0) {
            console.log("\n[!] No images found. Dumping HTML for inspection...");
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Cookie': 'age_verified=1'
                }
            });
            await fs.writeFile('ph_album_debug.html', data);
            console.log("Dumped to ph_album_debug.html");
        }
    } catch (e) {
        console.error("Test Failed:", e);
    }
}

test();
