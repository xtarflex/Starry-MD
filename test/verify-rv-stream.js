
const axios = require('axios');
const { PassThrough } = require('stream');

async function testStream() {
    // Known working video URL from Realbooru (from previous test logs or a search)
    // We'll search for one dynamically to be safe.
    console.log("1. Finding a video...");
    // ... Copying search logic from test-realbooru.js ...
    const cheerio = require('cheerio');
    let videoUrl = "";

    try {
        const { data } = await axios.get('https://realbooru.com/index.php?page=post&s=list&tags=video', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        let id = null;

        $('a[href*="s=view"]').each((i, el) => {
            const h = $(el).attr('href');
            const m = h && h.match(/id=([0-9]+)/);
            if (m) {
                id = m[1];
                return false;
            }
        });

        if (!id) throw new Error("No video posts found in search results.");

        const postData = await axios.get(`https://realbooru.com/index.php?page=post&s=view&id=${id}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $p = cheerio.load(postData.data);
        videoUrl = $p('video source').attr('src');
        if (!videoUrl) throw new Error("No video source in post " + id);
        if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;

        console.log(`2. Target URL: ${videoUrl}`);

        // TEST STREAM LOGIC
        console.log("3. Starting Stream Request...");
        const response = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'Referer': 'https://realbooru.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        console.log(`[SUCCESS] Stream Status: ${response.status}`);
        const totalLength = response.headers['content-length'];
        console.log(`Content-Length: ${totalLength}`);

        if (!totalLength) console.warn("Warning: No Content-Length header.");

        const tracker = new PassThrough();
        let loaded = 0;
        let lastPercent = 0;
        let updateCount = 0;

        // Mock sock
        const sock = {
            sendMessage: async (jid, content) => {
                if (content.video && content.video.stream) {
                    console.log("[MOCK] sock.sendMessage received stream for video!");
                    return { key: { id: 'mock_msg_id' } };
                }
            }
        };

        response.data.on('data', (chunk) => {
            loaded += chunk.length;
            if (tracker.write(chunk)) { }

            if (totalLength) {
                const percent = Math.round((loaded / totalLength) * 100);
                if (percent !== lastPercent && percent % 10 === 0) {
                    lastPercent = percent;
                    updateCount++;
                    process.stdout.write(`\rProgress: ${percent}%`);
                }
            }
        });

        response.data.on('end', () => {
            console.log("\n[SUCCESS] Stream ended.");
            tracker.end();
        });

        // Simulate "sending" by consuming the tracker
        tracker.on('data', () => { }); // Drain it
        tracker.on('end', () => console.log("[MOCK] Tracker drained completely."));

    } catch (e) {
        console.error("Test Failed:", e.message);
        if (e.response) console.error("Response Status:", e.response.status);
    }
}

testStream();
