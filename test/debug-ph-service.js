import phService from '../lib/services/ph-service.js';
import fs from 'fs-extra';
import axios from 'axios';
import path from 'path';

async function test() {
    console.log("Testing PH Serivce...");
    try {
        const results = await phService.scrapeSearch("dog");
        console.log(`Found ${results.length} results.`);

        if (results.length > 0) {
            console.log(`\n--- Testing Video 1: ${results[0].title} ---`);
            const url = results[0].link;

            /*
            // Manual fetch with cookies to look at HTML
            console.log("Fetching HTML...");
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Cookie': 'age_verified=1; accessAgeDisclaimerPH=2'
                }
            });

            const dumpPath = path.join(process.cwd(), 'debug_dump.html');
            await fs.writeFile(dumpPath, data);
            console.log(`Saved HTML to ${dumpPath}`);
            */

            // Also run the service scrape to compare
            const video = await phService.scrapeVideo(url);
            console.log("Video Data:", video);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
