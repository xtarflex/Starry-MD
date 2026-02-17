import axios from 'axios';
import utils from '../core/utils.js';
import searchSession from './search-session.js';



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
    let input = args.join(" ");

    // --- TAG/REPLY DETECTION ---
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!input || !input.includes('tiktok.com')) {
        const qText = quoted ? (quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || "") : "";
        const ttMatch = qText.match(/https?:\/\/(?:www\.|v[mt]\.)?tiktok\.com\/[^\s]+/i);
        if (ttMatch) {
            input = ttMatch[0];
            utils.log("DEBUG", `[TikTok] Detected link from reply: ${input}`);
        }
    }

    if (!input) {
        return sock.sendMessage(from, { text: "❌ Usage:\n• .tt <link> (Download)\n• .tt <query> (Search)\n• .tt @user (Profile)\n\n💡 *Tip:* You can also reply to a TikTok link with `.tt`" }, { quoted: msg });
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
        // --- API CALL ---
        const apiUrl = 'https://www.tikwm.com/api/';
        let response;
        let queryParams = {};

        if (mode === 'url') {
            queryParams = { url: input, hd: 1 };
            response = await axios.post(apiUrl, new URLSearchParams(queryParams));
        }
        else if (mode === 'search') {
            response = await axios.post('https://www.tikwm.com/api/feed/search', new URLSearchParams({ keywords: input, count: 10 }));
        }
        else if (mode === 'user') {
            response = await axios.post('https://www.tikwm.com/api/user/info', new URLSearchParams({ unique_id: input }));
        }

        const data = response.data;

        // --- ERROR HANDLING ---
        if (!data || data.code !== 0) {
            throw new Error(data?.msg || "API request failed");
        }

        // --- HANDLER: DOWNLOAD VIDEO ---
        if (mode === 'url') {
            const video = data.data;
            await utils.updateStatus(sock, from, "⬇️ *Downloading Media...*", statusKey);

            // 1. Send Video
            await sock.sendMessage(from, {
                video: { url: video.play },
                caption: `🎬 *${video.title || "TikTok Video"}*\n👤 *User:* ${video.author.nickname}\n❤️ *Likes:* ${utils.formatNumber(video.digg_count)}\n\n_Downloaded by Starry MD_`
            }, { quoted: msg });

            await utils.updateStatus(sock, from, "✅ *Done!*", statusKey);
        }

        // --- HANDLER: SEARCH RESULTS (Interactive) ---
        else if (mode === 'search') {
            const videos = data.data.videos;
            if (!videos || videos.length === 0) throw new Error("No videos found.");

            // Convert to standardized format
            const searchResults = videos.map(v => ({
                url: `https://www.tiktok.com/@${v.author.unique_id}/video/${v.video_id}`,
                title: v.title,
                duration: v.duration,
                author: v.author.nickname,
                cover: v.cover
            }));

            // Save session
            const sender = msg.key.participant || from;
            // FIXED: searchSession is default import, access directly
            searchSession.saveSession(sender, searchResults, 'tiktok');

            // Build List Message
            let listText = `🎥 *TIKTOK SEARCH RESULTS*\n\nQuery: *${input}*\n\n`;
            searchResults.forEach((v, i) => {
                listText += `*${i + 1}.* ${v.title.slice(0, 50)}...\n👤 ${v.author} | ⏱️ ${v.duration}s\n\n`;
            });

            listText += `_Reply with a number (1-10) to download._`;

            await utils.updateStatus(sock, from, "✅ *Results Found*", statusKey);
            await sock.sendMessage(from, { text: listText }, { quoted: msg });
        }

        // --- HANDLER: USER PROFILE ---
        else if (mode === 'user') {
            const user = data.data.user;
            await utils.updateStatus(sock, from, "📸 *Sending Profile...*", statusKey);

            const caption = `👤 *TIKTOK PROFILE*\n\n` +
                `📛 *Name:* ${user.nickname} (@${user.unique_id})\n` +
                `👥 *Followers:* ${utils.formatNumber(user.follower_count)}\n` +
                `❤️ *Hearts:* ${utils.formatNumber(user.total_favorited)}\n` +
                `📝 *Bio:* ${user.signature}\n` +
                `🔗 *Link:* https://www.tiktok.com/@${user.unique_id}`;

            await sock.sendMessage(from, {
                image: { url: user.avatar_larger },
                caption: caption
            }, { quoted: msg });
        }

    } catch (err) {
        utils.log("ERROR", `TikTok Failed: ${err.message}`);
        await utils.updateStatus(sock, from, `❌ Failed: ${err.message}`, statusKey);
    }
};

export default {
    handleTikTok
};
