const axios = require('axios');
const gis = require('g-i-s');
const cheerio = require('cheerio');
const utils = require('./utils');
const { PassThrough } = require('stream');

/* 
 * RESTRICTED LOGIC ($GOON MODE)
 * This file contains sensitive commands and scrapers.
 * TARGET FOR OBFUSCATION.
 */

const WAIFU_API = "https://api.waifu.pics/nsfw";

async function fetchWaifu(type) {
    try {
        const { data } = await axios.get(`${WAIFU_API}/${type}`);
        return data.url;
    } catch (e) {
        return null;
    }
}

// Helper for progress bar removed (moved to utils.ui.progress)

module.exports = async (sock, msg, from, cmd, args, botState) => {
    // strict check
    if (botState.mode !== "$goon") return false;

    switch (cmd) {
        // --- 1. UTILITIES ---
        case "scrape":
            if (!args || args.length === 0) {
                await sock.sendMessage(from, { text: "❌ Usage: .scrape <url>" });
                return true;
            }
            const url = args[0];
            await sock.sendMessage(from, { text: `🕷️ *Scraping Target:* ${url}...` });

            try {
                const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const size = (data.length / 1024).toFixed(2);
                await sock.sendMessage(from, { text: `✅ *Scrape Successful*\n📏 Size: ${size} KB` });
            } catch (e) {
                await sock.sendMessage(from, { text: `❌ Scrape Failed: ${e.message}` });
            }
            return true;

        case "exec":
        case "shell":
            if (!args) {
                await sock.sendMessage(from, { text: "💻 Shell command required." });
                return true;
            }
            require('child_process').exec(args.join(" "), (err, stdout, stderr) => {
                const output = err ? stderr : stdout;
                sock.sendMessage(from, { text: `💻 *SHELL*\n\`\`\`\n${output.slice(0, 1000)}\n\`\`\`` });
            });
            return true;

        // --- 2. THE GOON SUITE (NSFW) ---
        case "nsfw":
        case "goon": // Alias to show menu or random
            if (!args || args.length === 0) {
                await sock.sendMessage(from, {
                    text: `😈 *GOON MODE ACTIVE*\n\nAvailable Commands:\n.nsfw <waifu|neko|trap|blowjob>\n.r34 <query>\n.ass\n.boobs\n.hentai\n.trap\n.blow\n.feet`
                });
                return true;
            }
        // Fallthrough if args present

        case "waifu":
        case "neko":
        case "trap":
        case "blowjob":
            const category = cmd === 'nsfw' ? (args[0] || 'waifu') : cmd;
            const img = await fetchWaifu(category);
            if (img) {
                await sock.sendMessage(from, { image: { url: img }, caption: `🔞 *${category.toUpperCase()}*`, viewOnce: true });
            } else {
                await sock.sendMessage(from, { text: "❌ Fetch failed." });
            }
            return true;

        // Shortcuts
        case "blow":
            const bjImg = await fetchWaifu('blowjob');
            if (bjImg) await sock.sendMessage(from, { image: { url: bjImg }, caption: "🔞 *BLOWJOB*", viewOnce: true });
            return true;

        case "ass":
        case "boobs":
        case "hmanga":
        case "feet":
        case "hentai":
            // Map to waifu.pics categories where possible or use fallback
            const map = {
                'ass': 'waifu',
                'boobs': 'waifu',
                'hentai': 'waifu',
                'feet': 'waifu'
            };
            const fallbackImg = await fetchWaifu(map[cmd] || 'waifu');
            if (fallbackImg) await sock.sendMessage(from, { image: { url: fallbackImg }, caption: `🔞 *${cmd.toUpperCase()}*`, viewOnce: true });
            return true;

        // --- 3. RULE 34 SEARCH ---
        case "r34":
        case "rule34":
            if (!args || args.length === 0) {
                await sock.sendMessage(from, { text: "🔎 Usage: .r34 <tag>" });
                return true;
            }
            const tag = args.join(" ");

            // Primary Method: Google Images Search ("rule34 <tag>")
            // Reliable fallback with Retry Logic + Buffer Download (Bypasses Hotlink Protection)
            try {
                const results = await new Promise((resolve, reject) => {
                    gis(`rule34 ${tag}`, (error, results) => {
                        if (error) reject(error);
                        else resolve(results);
                    });
                });

                if (!results || results.length === 0) {
                    await sock.sendMessage(from, { text: "❌ No results found." });
                    return true;
                }

                // Shuffle results to keep it random
                const shuffled = results.sort(() => 0.5 - Math.random());
                let sent = false;

                // Try up to 5 images
                for (let i = 0; i < Math.min(5, shuffled.length); i++) {
                    const imgUrl = shuffled[i].url;
                    try {
                        // Download image as buffer first to validate and bypass hotlink protection
                        const response = await axios.get(imgUrl, {
                            responseType: 'arraybuffer',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            },
                            timeout: 5000
                        });

                        // If we got here, download was successful
                        await sock.sendMessage(from, {
                            image: response.data, // Send the buffer directly
                            caption: `🔞 *Rule34: ${tag}*\nSource: Google Images`,
                            viewOnce: true
                        });
                        sent = true;
                        break; // Success, exit loop
                    } catch (err) {
                        // Failed to download this specific image, continue to next
                        continue;
                    }
                }

                if (!sent) {
                    await sock.sendMessage(from, { text: "❌ Found images, but failed to load them (Anti-Bot protections active)." });
                }

            } catch (e) {
                await sock.sendMessage(from, { text: `❌ Search Error: ${e.message}` });
            }
            return true;

        // --- 4. REALBOORU VIDEO SEARCH ---
        case "rv":
        case "r34v":
            if (!args || args.length === 0) {
                await sock.sendMessage(from, { text: "🎬 Usage: .rv <tag>" });
                return true;
            }
            const videoTag = args.join(" ");
            await sock.sendMessage(from, { text: `🎬 Searching for Video (Realbooru): *${videoTag}*...` });

            try {
                // Realbooru Search
                const searchUrl = `https://realbooru.com/index.php?page=post&s=list&tags=${encodeURIComponent(videoTag)}+video`;
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
                    await sock.sendMessage(from, { text: "❌ No videos found for this tag." });
                    return true;
                }

                // Pick random Post
                const randomId = postIds[Math.floor(Math.random() * postIds.length)];
                const postUrl = `https://realbooru.com/index.php?page=post&s=view&id=${randomId}`;

                const postResponse = await axios.get(postUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const $p = cheerio.load(postResponse.data);

                let videoUrl = "";
                // Extract video URL from <video><source src="..."/></video>
                $p('video source').each((i, el) => {
                    const src = $p(el).attr('src');
                    if (src && (src.endsWith('.mp4') || src.endsWith('.webm'))) {
                        videoUrl = src;
                        return false;
                    }
                });

                if (videoUrl) {
                    if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;

                    try {
                        const { key: progressKey } = await sock.sendMessage(from, { text: "⏳ *Initializing Download...*" }, { quoted: msg });

                        // Stream-based download for speed + progress
                        const response = await axios({
                            method: 'GET',
                            url: videoUrl,
                            responseType: 'stream',
                            headers: {
                                'Referer': 'https://realbooru.com/',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });


                        const totalLength = response.headers['content-length'];
                        let loaded = 0;
                        let lastPercent = 0;

                        const tracker = new PassThrough();

                        // Monitoring without breaking the stream
                        response.data.on('data', (chunk) => {
                            loaded += chunk.length;
                            if (tracker.write(chunk)) {
                                // Flow control if needed, but for simple monitoring we just pass through
                            }

                            if (totalLength) {
                                const percent = Math.round((loaded / totalLength) * 100);
                                if (percent !== lastPercent && percent % 10 === 0) {
                                    lastPercent = percent;
                                    // Fire and forget status update to avoid blocking
                                    utils.updateStatus(sock, from, `⬇️ *Downloading:* ${utils.ui.progress(percent)}`, progressKey).catch(() => { });
                                }
                            }
                        });

                        response.data.on('end', () => {
                            tracker.end();
                        });

                        response.data.on('error', (err) => {
                            tracker.emit('error', err);
                        });

                        await sock.sendMessage(from, { text: "🚀 *Streaming Video...*", edit: progressKey });

                        await sock.sendMessage(from, {
                            video: { stream: tracker },
                            caption: `🔞 *Realbooru Video: ${videoTag}*\n🔗 _Source verified._`,
                            mimetype: 'video/mp4'
                        });

                        // Delete status message after a short delay
                        setTimeout(async () => {
                            try {
                                await sock.sendMessage(from, { delete: progressKey });
                            } catch (e) { }
                        }, 2000);

                    } catch (downloadErr) {
                        utils.log("WARN", `Stream download failed: ${downloadErr.message}`);
                        // Fallback to URL if stream fails
                        await sock.sendMessage(from, {
                            video: { url: videoUrl },
                            caption: `🔞 *Realbooru Video: ${videoTag}*`,
                            mimetype: 'video/mp4'
                        });
                    }
                } else {
                    await sock.sendMessage(from, { text: "❌ Failed to extract video source." });
                }
            } catch (err) {
                utils.log("ERROR", `Realbooru Command Error: ${err.message}`);
                await sock.sendMessage(from, { text: `❌ Video Search Error: ${err.message}` });
            }
            return true;

        default:
            return false;
    }
};
