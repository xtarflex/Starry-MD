const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Innertube, Platform } = require('youtubei.js');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');
const vm = require('vm');

let yt;

// Shim the evaluator for URL deciphering (required in Node.js)
Platform.shim.eval = (code, variables) => {
    return vm.runInNewContext(code, variables || {});
};

const initYouTube = async () => {
    if (!yt) {
        yt = await Innertube.create({
            gl: 'US'
        });
    }
    return yt;
};

/**
 * Reusable FFmpeg processor to ensure consistent output quality and prevent corruption
 */
const ffmpegProcess = (input, outputPath, options = {}) => {
    return new Promise((resolve, reject) => {
        let command = ffmpeg(input).noVideo();

        if (options.filter) {
            command = command.audioFilters(options.filter);
        }

        if (options.isPTT) {
            command = command
                .audioCodec('libopus')
                .audioChannels(1)
                .audioFrequency(16000) // 16kHz is robust for WA
                .format('ogg');
        } else {
            command = command
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .format('mp3');
        }

        command
            .on('start', (cmd) => utils.log("DEBUG", `FFmpeg Started: ${cmd}`))
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
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

            await ffmpegProcess(nodeStream, tempFile, { isPTT: false });

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

            await ffmpegProcess(tempIn, tempOut, { isPTT: true });

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

        const isPTT = quoted.audioMessage?.ptt || false;
        const tempIn = path.join(__dirname, '../temp', `spd_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `spd_out_${Date.now()}${isPTT ? '.ogg' : '.mp3'}`);

        // Filter logic: Fast = 1.5x, Slow = 0.65x
        const filter = type === 'fast' ? 'atempo=1.5' : 'atempo=0.65';

        try {
            // Ensure temp directory exists
            await fs.ensureDir(path.join(__dirname, '../temp'));

            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);

            await ffmpegProcess(tempIn, tempOut, { filter, isPTT });

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempOut),
                mimetype: isPTT ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
                ptt: isPTT
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Speed Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to change speed." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    },

    /**
     * Custom Speed Control (.speed <value>)
     */
    handleCustomSpeed: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.audioMessage) {
            return sock.sendMessage(from, { text: "❌ Quote an audio to change speed!" }, { quoted: msg });
        }

        // Parse speed value from args
        const speedInput = args.trim();
        if (!speedInput) {
            return sock.sendMessage(from, {
                text: "❌ *Usage:* `.speed <value>`\n\n*Examples:*\n• `.speed 2x` - Double speed\n• `.speed 0.5x` - Half speed\n• `.speed 1.5` - 1.5x speed\n\n*Range:* 0.5x to 4x"
            }, { quoted: msg });
        }

        // Extract number from input (supports "2x", "2.5", "0.5x", etc.)
        const speedMatch = speedInput.match(/([0-9.]+)/);
        if (!speedMatch) {
            return sock.sendMessage(from, { text: "❌ Invalid speed format! Use numbers like `2x`, `1.5`, `0.5x`" }, { quoted: msg });
        }

        const speed = parseFloat(speedMatch[1]);

        // Validate range (0.5x to 4x for quality and safety)
        if (isNaN(speed) || speed < 0.5 || speed > 4) {
            return sock.sendMessage(from, { text: "❌ Speed must be between **0.5x** and **4x**!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

        const isPTT = quoted.audioMessage?.ptt || false;
        const tempIn = path.join(__dirname, '../temp', `spd_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `spd_out_${Date.now()}${isPTT ? '.ogg' : '.mp3'}`);

        // Build atempo filter (ffmpeg atempo supports 0.5-2.0, so chain if needed)
        let filter = '';
        if (speed >= 0.5 && speed <= 2.0) {
            filter = `atempo=${speed}`;
        } else if (speed > 2.0 && speed <= 4.0) {
            // Chain two atempo filters for speeds > 2x
            const firstMult = 2.0;
            const secondMult = speed / firstMult;
            filter = `atempo=${firstMult},atempo=${secondMult}`;
        }

        try {
            // Ensure temp directory exists
            await fs.ensureDir(path.join(__dirname, '../temp'));

            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);

            await ffmpegProcess(tempIn, tempOut, { filter, isPTT });

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempOut),
                mimetype: isPTT ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
                ptt: isPTT
            }, { quoted: msg });

            utils.log("MEDIA", `Audio speed changed to ${speed}x`);
        } catch (err) {
            utils.log("ERROR", `Custom Speed Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to change speed." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    }
};
