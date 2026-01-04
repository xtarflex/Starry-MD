const { downloadMediaMessage } = require('@whiskeysockets/baileys'); // Move to top
const { Innertube } = require('youtubei.js');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');

let yt;

const initYouTube = async () => {
    if (!yt) {
        // Initialize with generic location to avoid region locks
        yt = await Innertube.create({ gl: 'US' });
    }
    return yt;
};

module.exports = {
    /**
     * YouTube Search (.yts)
     */
    handleYTS: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Give me a search term!" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

        try {
            const youtube = await initYouTube();
            const results = await youtube.search(query);

            // Safety check for video results
            if (!results.videos || results.videos.length === 0) {
                return sock.sendMessage(from, { text: "❌ No videos found." }, { quoted: msg });
            }

            const videos = results.videos.slice(0, 5);
            let response = `🌠 *STARRY YOUTUBE SEARCH*\n\n`;

            videos.forEach((vid, i) => {
                response += `*${i + 1}. ${vid.title.text || "Untitled"}*\n`;
                response += `   ⏱️ ${vid.duration.text || "??"} | 👁️ ${vid.views.text || "0"}\n`;
                response += `   🔗 https://youtu.be/${vid.id}\n\n`;
            });

            response += `_Reply with .play <link> to download._`;

            await sock.sendMessage(from, { text: response }, { quoted: msg });
        } catch (err) {
            utils.log("ERROR", `YTS Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Search failed." }, { quoted: msg });
        }
    },

    /**
     * YouTube Play (.play)
     * Handles: Watch links, Short links, and Text Search
     */
    handlePlay: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Format: `.play <Song Name>` or `<Link>`" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🎧", key: msg.key } });
        const { key: loadingKey } = await sock.sendMessage(from, { text: "🚀 *Firing up the engines...*" }, { quoted: msg });

        const tempFile = path.join(__dirname, '../temp', `play_${Date.now()}.mp3`);

        try {
            const youtube = await initYouTube();
            let videoId = null;

            // 1. Check for URL (Standard, Shortened, or Shorts)
            const urlPatterns = [
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]{11})/,
                /(?:https?:\/\/)?youtu\.be\/([\w-]{11})/,
                /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([\w-]{11})/
            ];

            for (const pattern of urlPatterns) {
                const match = query.match(pattern);
                if (match) {
                    videoId = match[1];
                    break;
                }
            }

            // 2. If no ID found, perform a search
            if (!videoId) {
                const searchRes = await youtube.search(query);
                // Filter to ensure we get a VIDEO, not a channel or playlist
                const firstVideo = searchRes.videos[0];
                if (!firstVideo) throw new Error("No video found for that query.");
                videoId = firstVideo.id;
            }

            // 3. Get Video Info
            const info = await youtube.getBasicInfo(videoId);
            const title = info.basic_info.title?.replace(/[^\w\s]/gi, '') || "Audio"; // Sanitize title
            const durationSec = info.basic_info.duration || 0;

            // 🛑 LIMIT: Reject videos longer than 30 minutes to save CPU/Server
            if (durationSec > 1800) {
                return sock.sendMessage(from, { text: "❌ Video is too long! Limit is 30 minutes.", edit: loadingKey });
            }

            await sock.sendMessage(from, { text: `🎵 *Downloading:* ${title}...`, edit: loadingKey });

            // 4. Download & Convert
            const format = info.chooseFormat({ type: 'audio', quality: 'best' });
            if (!format) throw new Error("No suitable audio found.");

            const stream = await info.download(format.itag);
            // Convert 'youtubei.js' stream to Node Readable for FFmpeg
            const nodeStream = require('stream').Readable.from(stream);

            await new Promise((resolve, reject) => {
                ffmpeg(nodeStream)
                    .audioBitrate(128)
                    .save(tempFile)
                    .on('end', resolve)
                    .on('error', reject);
            });

            // 5. Send
            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempFile),
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3` // fileName is important for some WA versions
            }, { quoted: msg });

            await sock.sendMessage(from, { text: "✅ *Sent.*", edit: loadingKey });

        } catch (err) {
            utils.log("ERROR", `Play Error: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}`, edit: loadingKey });
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    },

    /**
     * Convert to Voice Note (.tovn)
     * Optimized for WhatsApp PTT format (Opus)
     */
    handleToVN: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || msg.message;

        if (!mediaMsg.audioMessage && !mediaMsg.videoMessage) {
            return sock.sendMessage(from, { text: "❌ Quote audio/video to make it a VN!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎤", key: msg.key } });

        const tempIn = path.join(__dirname, '../temp', `vn_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `vn_out_${Date.now()}.ogg`); // .ogg is standard for WA PTT

        try {
            const buffer = await downloadMediaMessage(
                { message: mediaMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);

            await new Promise((resolve, reject) => {
                ffmpeg(tempIn)
                    .audioCodec('libopus')
                    .audioBitrate('64k') // Lower bitrate for voice notes is standard
                    .format('ogg')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(tempOut);
            });

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempOut),
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true // This makes it appear as a waveform/voice note
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `ToVN Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Conversion failed." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    },

    /**
     * Speed Control (.fast / .slow)
     */
    handleSpeed: async (msg, sock, botState, type) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        // Check specifically for audioMessage in quoted
        if (!quoted || !quoted.audioMessage) {
            return sock.sendMessage(from, { text: "❌ Quote an audio to change speed!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

        const tempIn = path.join(__dirname, '../temp', `spd_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `spd_out_${Date.now()}.mp3`);

        // Filter logic: Fast = 1.5x, Slow = 0.65x
        const filter = type === 'fast' ? 'atempo=1.5' : 'atempo=0.65';

        try {
            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);

            await new Promise((resolve, reject) => {
                ffmpeg(tempIn)
                    .audioFilters(filter)
                    .on('end', resolve)
                    .on('error', reject)
                    .save(tempOut);
            });

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempOut),
                mimetype: 'audio/mpeg',
                ptt: quoted.audioMessage.ptt // Preserve PTT status if original was PTT
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Speed Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to change speed." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    }
};
