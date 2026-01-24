const axios = require('axios');
const utils = require('./utils');
const searchSession = require('./search-session');

/* 
 * Social Lab - Handling Social Media Downloads
 * Supports: TikTok, Instagram (Planned)
 */

/*
 * TikTok Downloader (.tt / .tiktok)
 * Uses TikWM API for No-Watermark downloads
 * Supports: Links, Search Terms, User Profiles
 */
const handleTikTok = async (msg, sock, botState, args) => {
    const from = msg.key.remoteJid;
    let input = args.join(" "); // Changed to 'let' because input might be modified

    if (!input) {
        return sock.sendMessage(from, { text: "❌ Usage:\n• .tt <link> (Download)\n• .tt <query> (Search)\n• .tt @user (Profile)" }, { quoted: msg });
    }

    // Determine Mode: 'url', 'search', 'user', 'user_search_list'
    let mode = 'url';
    if (input.startsWith('@')) mode = 'user';
    else if (args[0].toLowerCase() === 'users' || args[0].toLowerCase() === 'profiles') {
        mode = 'user_search_list';
        input = args.slice(1).join(" "); // Remove 'users' keyword
    }
    else if (!input.includes('tiktok.com')) mode = 'search';

    // Progressive Status Initial Message
    const statusText = mode === 'user' ? "👤 *Fetching Profile...*" :
        mode === 'user_search_list' ? `👥 *Finding Users: ${input}...*` :
            mode === 'search' ? `🔎 *Searching: ${input}...*` :
                "🔎 *Fetching Video...*";

    let statusKey = await utils.updateStatus(sock, from, statusText);

    try {
        utils.log("DEBUG", `[TikTok] Mode: ${mode} | Input: ${input}`);

        utils.log("DEBUG", `[TikTok] Mode: ${mode} | Input: ${input}`);

        let data = null;

        // --- STRATEGY: MULTI-PROVIDER FOR URL MODE ---
        if (mode === 'url') {
            const providers = [
                // 1. TikWM (Official)
                { url: `https://www.tikwm.com/api/?url=${encodeURIComponent(input)}?hd=1` },
                // 2. Agatz
                { url: `https://api.agatz.xyz/api/tiktok?url=${encodeURIComponent(input)}` },
                // 3. Dreaded
                { url: `https://api.dreaded.site/api/tiktok?url=${encodeURIComponent(input)}` },
                // 4. Ryzendesu
                { url: `https://api.ryzendesu.vip/api/downloader/ttdl?url=${encodeURIComponent(input)}&type=video` }
            ];

            for (const provider of providers) {
                try {
                    const res = await axios.get(provider.url, {
                        timeout: 8000,
                        headers: {
                            'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        }
                    });

                    // Normalizing Data Structure to match TikWM format
                    if (res.data && (res.data.code === 0 || res.data.status === 200 || res.data.success)) {
                        const d = res.data.data || res.data.result || res.data;

                        // Map fields to standard TikWM format
                        data = {
                            code: 0,
                            data: {
                                play: d.play || d.url || (Array.isArray(d) ? d[0]?.url : null),
                                title: d.title || d.description || "TikTok Video",
                                author: { nickname: d.author?.nickname || "Unknown" },
                                play_count: d.play_count || 0,
                                duration: d.duration || 0
                            }
                        };
                        if (data.data.play) break; // Success
                    }
                } catch (e) {
                    utils.log("WARN", `TikTok Provider failed: ${e.message}`);
                }
            }
        }

        // --- STRATEGY: TIKWM ONLY FOR SEARCH/USER (No better public alternatives) ---
        else {
            let apiUrl;
            if (mode === 'search' || mode === 'user_search_list') {
                apiUrl = `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(input)}`;
            } else if (mode === 'user') {
                apiUrl = `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(input.replace('@', ''))}`;
            }

            try {
                const res = await axios.get(apiUrl, {
                    headers: {
                        'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                });
                data = res.data;
            } catch (err) {
                // Specific handling for 403 (Block)
                if (err.response && err.response.status === 403) {
                    await utils.updateStatus(sock, from, "❌ *API Busy.*", statusKey);
                    return sock.sendMessage(from, {
                        text: "⚠️ *TikTok Search/Profile Unavailable*\n\nThe public API is currently blocking these requests (403). \n✅ *Direct Link Downloads still work!*"
                    }, { quoted: msg });
                }
                throw err;
            }
        }

        if (!data || (data.code !== 0 && !data.data)) {
            throw new Error(data?.msg || "All TikTok APIs failed. Please try again later.");
        }

        // --- HANDLE USER SEARCH LIST (Workaround via Video Search) ---
        if (mode === 'user_search_list') {
            if (!data.data.videos) throw new Error("No users found.");

            // Extract Authors from Videos
            const authors = [];
            const seenIds = new Set();

            data.data.videos.forEach(vid => {
                if (vid.author && !seenIds.has(vid.author.unique_id)) {
                    seenIds.add(vid.author.unique_id);
                    authors.push({
                        unique_id: vid.author.unique_id,
                        nickname: vid.author.nickname,
                        avatar: vid.author.avatar
                    });
                }
            });

            const topAuthors = authors.slice(0, 5);
            if (topAuthors.length === 0) throw new Error("No users found.");

            // Save Session (Provider: tiktok-user)
            // We store the full author object so handler can access .unique_id
            searchSession.saveSession(msg.key.participant || from, topAuthors, 'tiktok-user');

            let response = `👥 *TIKTOK USERS FOUND*\n\n`;
            topAuthors.forEach((auth, i) => {
                response += `*${i + 1}. ${auth.nickname}* (@${auth.unique_id})\n`;
            });
            response += `\n_Reply with_ \`1-5\` _to view profile._`;

            await sock.sendMessage(from, { text: response }, { quoted: msg });
            await utils.updateStatus(sock, from, "✅ *Users found.*", statusKey);
            return;
        }

        // --- HANDLE USER PROFILE & VIDEOS ---
        if (mode === 'user') {
            const user = data.data.user;
            const stats = data.data.stats;

            // Fix possible property names
            const followers = stats.followerCount || stats.follower_count || 0;
            const hearts = stats.heartCount || stats.heart_count || 0;
            const videosCount = stats.videoCount || stats.video_count || 0;

            // Detect Sort Mode
            const sortMode = args.some(a => ['popular', 'top', 'views', 'viewed'].includes(a.toLowerCase())) ? 'popular' : 'recent';

            let caption = `👤 *${user.nickname}* (@${user.uniqueId})\n\n` +
                `📝 ${user.signature}\n\n` +
                `👥 Followers: ${utils.parseNumber(followers)}\n` +
                `❤️ Hearts: ${utils.parseNumber(hearts)}\n` +
                `🎥 Videos: ${utils.parseNumber(videosCount)}\n\n`;

            // Fetch User Videos (Posts) - Fetch 30 to sort
            const fetchCount = sortMode === 'popular' ? 30 : 10;
            const postsUrl = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(input.replace('@', '').split(' ')[0])}&count=${fetchCount}`;

            const { data: postsData } = await axios.get(postsUrl);

            if (postsData && postsData.code === 0 && postsData.data.videos) {
                let videos = postsData.data.videos;

                // Sort if Popular
                if (sortMode === 'popular') {
                    videos.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
                    caption += `━━━━━━━━━━━━━━━━━\n*🔥 MOST POPULAR (${videos.length > 10 ? 'Top 10' : 'All'}):*\n`;
                } else {
                    caption += `━━━━━━━━━━━━━━━━━\n*🆕 RECENT VIDEOS:*\n`;
                }

                // Slice Top 10
                videos = videos.slice(0, 10);

                // Save to session
                searchSession.saveSession(msg.key.participant || from, videos, 'tiktok');

                videos.forEach((vid, i) => {
                    caption += `\n*${i + 1}. ${vid.title.substring(0, 40)}...*`;
                    caption += `\n   👁️ ${utils.parseNumber(vid.play_count)} | ⏱️ ${utils.formatTime(vid.duration * 1000)}`;
                });
                caption += `\n\n_Reply with_ \`1-10\` _to download._`;
            } else {
                caption += `\n_(No videos found or API private)_`;
            }

            caption += `\n\n_Starry Social_`;

            await sock.sendMessage(from, {
                image: { url: user.avatarLarger },
                caption: caption
            }, { quoted: msg });

            await utils.updateStatus(sock, from, "✅ *Profile Loaded.*", statusKey);
            return;
        }

        // --- HANDLE SEARCH (Interactive List) ---
        if (mode === 'search') {
            if (!data.data.videos || data.data.videos.length === 0) throw new Error("No videos found.");

            const videos = data.data.videos.slice(0, 5);

            // Save to session (Provider: 'tiktok')
            searchSession.saveSession(msg.key.participant || from, videos, 'tiktok');

            let response = `🎵 *TIKTOK SEARCH*\n\n`;
            videos.forEach((vid, i) => {
                response += `*${i + 1}. ${vid.title.substring(0, 50)}...*\n`;
                response += `   ⏱️ ${utils.formatTime(vid.duration * 1000)} | 👤 ${vid.author.nickname}\n\n`;
            });
            response += `_Reply with_ \`1-5\` _to download._`;

            await sock.sendMessage(from, { text: response }, { quoted: msg });
            await utils.updateStatus(sock, from, "✅ *Results found.*", statusKey);
            return;
        }

        // --- HANDLE DIRECT LINK ---
        let videoData = data.data;
        await utils.updateStatus(sock, from, "⬇️ *Downloading Video...*", statusKey);

        await sendTikTokVideo(msg, sock, videoData, statusKey);

    } catch (err) {
        utils.log("ERROR", `TikTok Failed: ${err.message}`);

        // Smart Error Diagnostics
        const netStats = await utils.getNetworkStats();
        const errorText = `❌ *Download Failed*\n\nReason: ${err.message}\n${netStats.text}\n\n_System Diagnostic Initiated_`;

        // If statusKey exists, edit it. Else send new message.
        if (statusKey) {
            await sock.sendMessage(from, { text: errorText, edit: statusKey });
        } else {
            await sock.sendMessage(from, { text: errorText }, { quoted: msg });
        }
    }
};

/*
 * Send TikTok Video Helper
 * Used by handleTikTok and Interactive Handler
 */
const sendTikTokVideo = async (msg, sock, videoData, statusKey = null) => {
    const from = msg.key.remoteJid;
    const videoUrl = videoData.play;
    const title = videoData.title || "TikTok Video";
    const author = videoData.author?.nickname || "Unknown";
    const views = videoData.play_count || 0;

    if (statusKey) {
        await utils.updateStatus(sock, from, "⬆️ *Uploading Video...*", statusKey);
    }

    await sock.sendMessage(from, {
        video: { url: videoUrl },
        caption: `🎵 *${title}*\n👤 ${author} | 👁️ ${utils.parseNumber(views)}\n\n_Starry Downloader_`,
        mimetype: 'video/mp4'
    }, { quoted: msg });

    if (statusKey) {
        await utils.updateStatus(sock, from, "✅ *Sent.*", statusKey);
    }
};

/*
 * Instagram Downloader (.ig / .insta)
 * Strategy: Multi-API Fallback (Public APIs are unstable, so we try multiple)
 */
const handleInstagram = async (msg, sock, botState, args) => {
    const from = msg.key.remoteJid;
    const input = args[0];

    if (!input || !input.includes('instagram.com')) {
        return sock.sendMessage(from, { text: "❌ Usage: .ig <instagram_url>" }, { quoted: msg });
    }

    let statusKey = await utils.updateStatus(sock, from, "🔎 *Looking for Instagram Media...*");

    // List of Public APIs to try sequentially
    // These rotate frequently, so having multiple is safer.
    const apiProviders = [
        // Provider 1: Ryzendesu (Often reliable)
        {
            url: (link) => `https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(link)}`,
            parser: (data) => data.data ? (Array.isArray(data.data) ? data.data[0].url : data.data.url) : null
        },
        // Provider 2: Dreaded
        {
            url: (link) => `https://api.dreaded.site/api/igdl?url=${encodeURIComponent(link)}`,
            parser: (data) => data.result ? (Array.isArray(data.result) ? data.result[0].url : data.result.url) : null
        },
        // Provider 3: Agatz
        {
            url: (link) => `https://api.agatz.xyz/api/igdl?url=${encodeURIComponent(link)}`,
            parser: (data) => data.data ? data.data[0].url : null
        },
        // Provider 4: Widipe
        {
            url: (link) => `https://widipe.com/igdl?url=${encodeURIComponent(link)}`,
            parser: (data) => data.result ? data.result[0].url : null
        }
    ];

    let mediaUrl = null;
    let providerName = "";

    try {
        for (const provider of apiProviders) {
            try {
                const { data } = await axios.get(provider.url(input), { timeout: 5000 }); // 5s timeout per API
                const result = provider.parser(data);

                if (result) {
                    mediaUrl = result;
                    providerName = new URL(provider.url("")).hostname;
                    break; // Success!
                }
            } catch (apiErr) {
                // Continue to next provider
                utils.log("WARN", `IG Provider failed: ${apiErr.message}`);
            }
        }

        if (!mediaUrl) {
            throw new Error("All public APIs failed. Instagram might be blocking requests.");
        }

        await utils.updateStatus(sock, from, "⬇️ *Downloading Media...*", statusKey);

        // Determine type (Image or Video)
        // Simple heuristic: check extension or assume video for Reels
        const isImage = mediaUrl.includes('.jpg') || mediaUrl.includes('.webp');

        if (isImage) {
            await utils.updateStatus(sock, from, "⬆️ *Uploading Image...*", statusKey);
            await sock.sendMessage(from, {
                image: { url: mediaUrl },
                caption: `📸 *Instagram Image*\n_Source: ${providerName}_\n\n_Starry Downloader_`
            }, { quoted: msg });
        } else {
            await utils.updateStatus(sock, from, "⬆️ *Uploading Video...*", statusKey);
            await sock.sendMessage(from, {
                video: { url: mediaUrl },
                caption: `📹 *Instagram Reel/Video*\n_Source: ${providerName}_\n\n_Starry Downloader_`,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        }

        await utils.updateStatus(sock, from, "✅ *Sent.*", statusKey);

    } catch (err) {
        utils.log("ERROR", `Instagram Failed: ${err.message}`);

        const netStats = await utils.getNetworkStats();
        await utils.updateStatus(sock, from, "❌ *Failed.*", statusKey);

        await sock.sendMessage(from, {
            text: `❌ *Download Failed*\n\nReason: ${err.message}\n${netStats.text}\n\n_Try again later or use a different link._`
        }, { quoted: msg });
    }
};

module.exports = {
    handleTikTok,
    handleInstagram,
    sendTikTokVideo,

    /*
     * Pinterest Downloader (.pint)
     * Strategy: Scrape -> Fallback to Google Image Search (GIS) Interactive
     */
    handlePinterest: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const input = args.join(" ");

        if (!input) {
            return sock.sendMessage(from, { text: "❌ Usage: .pint <search_term>" }, { quoted: msg });
        }

        let statusKey = await utils.updateStatus(sock, from, "📌 *Searching Pinterest...*");

        try {
            // PROVIDER 1: Pinterest API (e.g. Ryzendesu or similar, or specific scraper)
            // For now, let's assuming we try a search API first. 
            // If explicit Pinterest URL, we dl specifically. 
            // But command is .pint usually for search? User said "implement Pinterest downloader for the pint command".
            // Usually .pint is "Pinterest Search" in many bots, but "downloader" implies URL.
            // User says: "try implementing Pinterest downloader for the pint command... keep gis for back up"
            // GIS is "Google Image Search". So .pint probably is Search.

            // Let's assume .pint <query> -> Search Pinterest

            const pintUrl = `https://api.ryzendesu.vip/api/search/pinterest?query=${encodeURIComponent(input)}`;
            const { data } = await axios.get(pintUrl);

            if (data && (data.results || data.data) && (data.results?.length > 0 || data.data?.length > 0)) {
                // Success
                const images = data.results || data.data; // Array of URLs
                const topImages = images.slice(0, 5).map(url => ({ url })); // Take top 5

                await utils.updateStatus(sock, from, "📸 *Sending Album...*", statusKey);
                await utils.sendAlbum(sock, from, topImages, { caption: `📌 *Pinterest:* ${input}`, quoted: msg });
                await utils.updateStatus(sock, from, "✅ *Sent.*", statusKey);
                return;
            } else {
                throw new Error("No results found on Pinterest.");
            }

        } catch (err) {
            utils.log("WARN", `Pinterest Search Failed: ${err.message}`);

            // FALLBACK PROMPT
            // "failed to access type 1 to continue type 2 to cancel"
            await utils.updateStatus(sock, from, "⚠️ *Pinterest Failed.*", statusKey);

            // Save Session for 1/2 response
            // We use 'pinterest-fallback' provider to catch the "1" or "2"
            searchSession.saveSession(msg.key.participant || from, { query: input }, 'pinterest-fallback');

            await sock.sendMessage(from, {
                text: `⚠️ *Pinterest Connection Failed*\n\nReason: ${err.message}\n\n*Type 1* to continue with backup (Google Images)\n*Type 2* to cancel.`
            }, { quoted: msg });
        }
    },

    /*
     * Pinterest Fallback Handler (Triggered by "1")
     */
    handlePinterestFallback: async (msg, sock, botState, sessionData) => {
        const from = msg.key.remoteJid;
        const query = sessionData.query;

        await sock.sendMessage(from, { text: "🔍 *Switching to Google Images...*" }, { quoted: msg });

        // Call GIS (Google Image Search) - assuming module exists or we use API
        // If GIS function exists in this file or image-tools, call it.
        // If not, we implement simple GIS here.

        try {
            const gisUrl = `https://api.ryzendesu.vip/api/search/google-image?query=${encodeURIComponent(query)}`;
            const { data } = await axios.get(gisUrl);

            // Parser might differ based on API
            // Assuming data is array of strings or objects
            if (data) { // adjust check based on actual API result
                // Ryzen usually returns array
                // Let's try to map generic
                const results = Array.isArray(data) ? data : (data.results || data.data || []);
                const validResults = results.filter(r => typeof r === 'string' || r.url);

                if (validResults.length === 0) throw new Error("No Google Images found.");

                const topImages = validResults.slice(0, 5).map(r => ({ url: typeof r === 'string' ? r : r.url }));

                await utils.sendAlbum(sock, from, topImages, { caption: `🔍 *Google Images:* ${query}`, quoted: msg });
                return;
            }
            throw new Error("Invalid API response.");

        } catch (e) {
            await sock.sendMessage(from, { text: `❌ Backup Search Failed: ${e.message}` }, { quoted: msg });
        }
    }
};
