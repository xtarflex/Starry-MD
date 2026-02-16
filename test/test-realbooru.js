
const axios = require('axios');
const cheerio = require('cheerio');

async function testRealbooruAccess() {
    try {
        console.log("1. Searching for a video...");
        const searchUrl = `https://realbooru.com/index.php?page=post&s=list&tags=video`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const $ = cheerio.load(data);
        const postIds = [];
        $('a[href*="s=view"]').each((i, el) => {
            const href = $(el).attr('href');
            const match = href.match(/id=([0-9]+)/);
            if (match) postIds.push(match[1]);
        });

        if (postIds.length === 0) {
            console.log("No videos found.");
            return;
        }

        const randomId = postIds[0]; // Just take the first one
        console.log(`2. Fetching post ${randomId}...`);
        const postUrl = `https://realbooru.com/index.php?page=post&s=view&id=${randomId}`;

        const postResponse = await axios.get(postUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $p = cheerio.load(postResponse.data);

        let videoUrl = "";
        $p('video source').each((i, el) => {
            const src = $p(el).attr('src');
            if (src) videoUrl = src;
        });

        if (!videoUrl) {
            console.log("No video source found.");
            return;
        }

        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
        console.log(`3. Testing URL: ${videoUrl}`);

        // TEST 1: No Referer (Simulating WhatsApp)
        try {
            console.log("Attempting fetch WITHOUT Referer...");
            const resNoRef = await axios.head(videoUrl, {
                timeout: 5000
            });
            console.log(`[SUCCESS] Status: ${resNoRef.status}`);
            console.log("Direct URL sending IS viable.");
        } catch (e) {
            console.log(`[FAIL] No Referer failed: ${e.message}`);
            if (e.response) console.log(`Status: ${e.response.status}`);
            console.log("Direct URL sending might FAIL.");
        }

    } catch (err) {
        console.error("Test Error:", err);
    }
}

testRealbooruAccess();
