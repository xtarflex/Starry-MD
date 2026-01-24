const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const searchSession = require('./search-session');
const utils = require('./utils');

/* 
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
    /* 
     * YouTube Search (.yts)
     */
    handleYTS: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;
        if (!query) return sock.sendMessage(from, { text: "❌ Give me a search term!" }, { quoted: msg });

        await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } });

        try {
            const results = await ytSearch(query);

            // Safety check for video results
            if (!results.videos || results.videos.length === 0) {
                return sock.sendMessage(from, { text: "❌ No videos found." }, { quoted: msg });
            }

            const videos = results.videos.slice(0, 5);

            // Save context for interactive reply
            searchSession.saveSession(msg.key.participant || from, videos, 'youtube');

            let response = `🌠 *STARRY YOUTUBE SEARCH*\n\n`;

            videos.forEach((vid, i) => {
                response += `*${i + 1}. ${vid.title}*\n`;
                response += `   ⏱️ ${vid.timestamp} | 👁️ ${vid.views}\n`;
                response += `   🔗 ${vid.url}\n\n`;
            });

            response += `_Reply with_ \`1-5\` _to download._`;

            await sock.sendMessage(from, { text: response }, { quoted: msg });
        } catch (err) {
            utils.log("ERROR", `YTS Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Search failed." }, { quoted: msg });
        }
    },

    /* 
     * YouTube Play (.play)
     * Handles: Watch links, Short links, and Text Search
     */
    handlePlay: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;

        // Ensure query is a string and safe to use
        if (!query || typeof query !== 'string') {
            if (Array.isArray(query)) query = query.join(' ');
            else if (typeof query === 'object') return sock.sendMessage(from, { text: "❌ Invalid query format." }, { quoted: msg });

            if (!query) return sock.sendMessage(from, { text: "❌ Format: `.play <Song Name>` or `<Link>`" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎧", key: msg.key } });
        // 🌟 PROGRESSIVE STATUS START
        let statusKey = await utils.updateStatus(sock, from, "🔎 *Searching...*", null);

        const tempFile = path.join(__dirname, '../temp', `play_${Date.now()}.mp3`);
        utils.log("DEBUG", `[Play] Temp file path: ${tempFile}`);

        // Ensure temp directory exists
        await fs.ensureDir(path.join(__dirname, '../temp'));

        // Custom Request Options to avoid 403
        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        };

        try {
            let videoUrl = null;
            let title = "Audio";

            utils.log("DEBUG", `[Play] Processing query: ${query}`);

            // 1. Valid URL check
            if (ytdl.validateURL(query)) {
                videoUrl = query;
                await utils.updateStatus(sock, from, "🔎 *Identified URL...*", statusKey);
            } else {
                // 2. Smart Search (Heuristic)
                const isVideoIntent = /video|mv|official video|cinematic|movie/i.test(query);
                const isUrl = /https?:\/\//.test(query);

                let searchQuery = query;
                if (!isUrl && !isVideoIntent) {
                    searchQuery = `${query} official audio`;
                }

                const searchRes = await ytSearch(searchQuery);
                const firstVideo = searchRes.videos[0];
                if (!firstVideo) throw new Error("No video found for that query.");
                videoUrl = firstVideo.url;
                title = firstVideo.title;

                await utils.updateStatus(sock, from, `🔎 *Found:* ${title}`, statusKey);
            }

            // 3. Get Info (to check duration and get clean title if from URL)
            // 3. Get Info (to check duration and get clean title if from URL)
            const info = await utils.withNetworkTimeout(
                ytdl.getInfo(videoUrl, { requestOptions }),
                30000,
                "YouTube Info Fetch Timed Out"
            );

            title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
            const durationSec = parseInt(info.videoDetails.lengthSeconds);

            // 🛑 LIMIT: Reject videos longer than 30 minutes
            if (durationSec > 1800) {
                return sock.sendMessage(from, { text: "❌ Video is too long! Limit is 30 minutes.", edit: statusKey });
            }

            await utils.updateStatus(sock, from, `⬇️ *Downloading:* ${title}...`, statusKey);

            // 4. Download Stream to Temp File (Using Video Container Strategy for Stability)
            utils.log("DEBUG", `[Play] Starting stream download (audioandvideo)...`);
            const tempRawFile = path.join(__dirname, '../temp', `raw_${Date.now()}.mp4`);

            const stream = ytdl(videoUrl, {
                filter: 'audioandvideo',
                quality: 'lowest', // Prefer smaller video since we only want audio
                highWaterMark: 1 << 62,
                dlChunkSize: 0,
                requestOptions: requestOptions
            });

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    stream.destroy();
                    reject(new Error("Download timed out (3 mins)."));
                }, 180000); // 3 mins internal stream timeout

                // Double protection with global wrapper managed below if needed, 
                // but stream events are best handled here.

                let lastPercent = 0;
                stream.on('progress', (chunkLength, downloaded, total) => {
                    const percent = (downloaded / total * 100).toFixed(0);
                    // Minimal logging to avoid spamming console/status
                    if (percent - lastPercent >= 20 || percent == 100) {
                        utils.log("DEBUG", `[Play] Download Progress: ${percent}%`);
                        lastPercent = percent;
                    }
                    if (downloaded >= total) clearTimeout(timeout);
                });

                stream
                    .pipe(fs.createWriteStream(tempRawFile))
                    .on('finish', () => {
                        clearTimeout(timeout);
                        resolve();
                    })
                    .on('error', (err) => {
                        clearTimeout(timeout);
                        reject(err);
                    });
            });

            await utils.updateStatus(sock, from, "♻️ *Processing Audio...*", statusKey);

            // 5. Convert to MP3
            await ffmpegProcess(tempRawFile, tempFile, { isPTT: false });

            const netAlert = await utils.getNetworkAlert();
            await utils.updateStatus(sock, from, `⬆️ *Uploading...*${netAlert}`, statusKey);

            // 6. Send
            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempFile),
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
                ppt: false,
                contextInfo: {
                    externalAdReply: {
                        title: title,
                        body: "Starry MD",
                        // Sort thumbnails by width (highest quality last) and pick the best one
                        thumbnailUrl: info.videoDetails.thumbnails.sort((a, b) => a.width - b.width).pop().url,
                        sourceUrl: videoUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

            // Final success update
            await sock.sendMessage(from, { text: "✅ *Sent.*", edit: statusKey });

            // Cleanup raw file
            if (fs.existsSync(tempRawFile)) fs.unlinkSync(tempRawFile);

        } catch (err) {
            utils.log("ERROR", `Play Error: ${err.message}`);
            // Use statusKey if available to update the loading message
            if (statusKey) {
                await sock.sendMessage(from, { text: `❌ Error: ${err.message}`, edit: statusKey });
            } else {
                await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
            }
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    },

    /* 
     * YouTube Video (.video / .ytv)
     * Downloads 360p video (Tag 18) for speed and WhatsApp limits
     */
    handleVideo: async (msg, sock, botState, query) => {
        const from = msg.key.remoteJid;

        if (!query || typeof query !== 'string') {
            if (Array.isArray(query)) query = query.join(' ');
            else if (typeof query === 'object') return sock.sendMessage(from, { text: "❌ Invalid query format." }, { quoted: msg });

            if (!query) return sock.sendMessage(from, { text: "❌ Format: `.video <Name>` or `<Link>`" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎬", key: msg.key } });
        const { key: loadingKey } = await sock.sendMessage(from, { text: "📽️ *Fetching video...*" }, { quoted: msg });

        const tempFile = path.join(__dirname, '../temp', `video_${Date.now()}.mp4`);

        // Ensure temp directory exists
        await fs.ensureDir(path.join(__dirname, '../temp'));

        // Custom Request Options to avoid 403
        const requestOptions = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        };

        try {
            let videoUrl = null;
            let title = "Video";

            // 1. Valid URL check
            if (ytdl.validateURL(query)) {
                videoUrl = query;
            } else {
                // 2. Search
                const searchRes = await ytSearch(query);
                const firstVideo = searchRes.videos[0];
                if (!firstVideo) throw new Error("No video found.");
                videoUrl = firstVideo.url;
                title = firstVideo.title;
            }

            // 3. Get Info
            // 3. Get Info
            const info = await utils.withNetworkTimeout(
                ytdl.getInfo(videoUrl, { requestOptions }),
                30000,
                "YouTube Info Fetch Timed Out"
            );
            title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
            const durationSec = parseInt(info.videoDetails.lengthSeconds);

            if (durationSec > 1800) {
                return sock.sendMessage(from, { text: "❌ Video too long! Limit is 30 mins.", edit: loadingKey });
            }

            const netAlert = await utils.getNetworkAlert();
            await sock.sendMessage(from, { text: `⬇️ *Downloading:* ${title}...${netAlert}`, edit: loadingKey });

            // 4. Download Video (Any Audio+Video format)
            const stream = ytdl(videoUrl, {
                filter: 'audioandvideo',
                quality: 'lowest', // Prefer smaller files for WA, but ensure A+V
                highWaterMark: 1 << 62,
                liveBuffer: 20000,
                dlChunkSize: 0,
                requestOptions: requestOptions
            });

            await new Promise((resolve, reject) => {
                stream
                    .pipe(fs.createWriteStream(tempFile))
                    .on('finish', resolve)
                    .on('error', reject);
            });

            // 5. Send
            await sock.sendMessage(from, {
                video: fs.readFileSync(tempFile),
                caption: `🎬 *${title}*\n⏱️ ${info.videoDetails.lengthSeconds}s`,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(from, { text: "✅ *Sent.*", edit: loadingKey });

        } catch (err) {
            utils.log("ERROR", `Video Error: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}`, edit: loadingKey });
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    },

    /* 
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

    /* 
     * Convert to MP3 Audio (.tomp3)
     */
    handleToAudio: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || msg.message;

        if (!mediaMsg.audioMessage && !mediaMsg.videoMessage) {
            return sock.sendMessage(from, { text: "❌ Quote audio/video to convert to MP3!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎵", key: msg.key } });

        const tempIn = path.join(__dirname, '../temp', `mp3_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `mp3_out_${Date.now()}.mp3`);

        try {
            const buffer = await downloadMediaMessage(
                { message: mediaMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);

            await ffmpegProcess(tempIn, tempOut, { isPTT: false });

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempOut),
                mimetype: 'audio/mpeg',
                fileName: `converted_${Date.now()}.mp3`
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `ToMP3 Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Conversion failed." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    },

    /* 
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

    /* 
     * Custom Speed Control (.speed <value>)
     */
    handleCustomSpeed: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || (!quoted.audioMessage && !quoted.videoMessage)) {
            return sock.sendMessage(from, { text: "❌ Quote an audio or video to change speed!" }, { quoted: msg });
        }

        // Parse speed value from args
        if (!args || args.length === 0) {
            return sock.sendMessage(from, {
                text: "❌ *Usage:* `.speed <value>`\n\n*Examples:*\n• `.speed 2` - Double speed\n• `.speed 0.5` - Half speed\n• `.speed 1.5` - 1.5x speed\n\n*Range:* 0.5 - 4.0"
            }, { quoted: msg });
        }

        const speedInput = args[0].trim().toLowerCase().replace('x', '');
        const speed = parseFloat(speedInput);

        if (!speedInput || isNaN(speed)) {
            return sock.sendMessage(from, {
                text: "❌ *Usage:* `.speed <value>`\n\n*Examples:*\n• `.speed 2` - Double speed\n• `.speed 0.5` - Half speed\n• `.speed 1.5` - 1.5x speed\n\n*Range:* 0.5 - 4.0"
            }, { quoted: msg });
        }

        // Validate range (0.5x to 4x for quality and safety)
        if (speed < 0.5 || speed > 4.0) {
            return sock.sendMessage(from, { text: "❌ Speed must be between *0.5* and *4.0*!" }, { quoted: msg });
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
            const secondFactor = speed / 2.0;
            filter = `atempo=2.0,atempo=${secondFactor}`;
        }

        try {
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
            await sock.sendMessage(from, { text: "❌ Failed to change speed. FFmpeg error." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    },

    /*
     * Audio Filters (.bass / .deep)
     */
    handleFilter: async (msg, sock, botState, type, args) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || (!quoted.audioMessage && !quoted.videoMessage)) {
            return sock.sendMessage(from, { text: `❌ Quote an audio/video to apply ${type} filter!` }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎛️", key: msg.key } });

        const isPTT = quoted.audioMessage?.ptt || false;
        const tempIn = path.join(__dirname, '../temp', `filter_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `filter_out_${Date.now()}${isPTT ? '.ogg' : '.mp3'}`);

        let filter = '';
        let intensity = 0;

        // --- FILTER LOGIC ---
        if (type === 'bass') {
            // Bass Boost: 1-50 (Default 20)
            const input = args && args[0] ? parseInt(args[0]) : 20;
            intensity = isNaN(input) ? 20 : Math.max(1, Math.min(input, 50));
            filter = `equalizer=f=50:width_type=h:width=50:g=${intensity}`;

        } else if (type === 'deep') {
            // Deep/Pitch Shift Low: 0.5-0.9 (Default 0.75) - "Slowed & Reverb" style base
            const input = args && args[0] ? parseFloat(args[0]) : 0.75;
            intensity = isNaN(input) ? 0.75 : Math.max(0.5, Math.min(input, 0.95));
            filter = `asetrate=44100*${intensity},atempo=1`; // Keep it simple: lower sample rate = slower + deeper

        } else if (type === 'high' || type === 'nightcore') {
            // Nightcore/Pitch Shift High: 1.1-1.5 (Default 1.25)
            const input = args && args[0] ? parseFloat(args[0]) : 1.25;
            intensity = isNaN(input) ? 1.25 : Math.max(1.1, Math.min(input, 2.0));
            // Nightcore = higher sample rate = faster + higher pitch
            filter = `asetrate=44100*${intensity},atempo=1`;

        } else if (type === 'blown' || type === 'earrape') {
            // Blown/Distortion: Volume gain + Clipping
            intensity = "Extreme"; // Text only
            // Volume 30dB + acrusher for grit
            filter = `volume=20dB,acrusher=level_in=8:level_out=18:bits=8:mode=log:aa=1`;

        } else if (type === 'reverse') {
            // Reverse Audio
            intensity = "Rewind";
            filter = `areverse`;

        } else if (type === 'echo') {
            // Echo/Delay
            intensity = "Hallway";
            // Delays: 1000ms is standard echo
            filter = `aecho=0.8:0.9:1000:0.3`;

        } else if (type === 'tremolo') {
            // Tremolo (Rapid volume oscillation)
            intensity = "Wobbly";
            filter = `tremolo=5:0.5`;
        }

        try {
            await fs.ensureDir(path.join(__dirname, '../temp'));

            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);
            await ffmpegProcess(tempIn, tempOut, { filter, isPTT });

            // Generate caption based on type
            let caption = "";
            switch (type) {
                case 'bass': caption = `🔊 *Bass Boost applied!* (Gain: ${intensity}dB)`; break;
                case 'deep': caption = `📉 *Pitch Shifted Low!* (Factor: ${intensity})`; break;
                case 'high':
                case 'nightcore': caption = `🐿️ *Nightcore Mode!* (Speed: ${intensity}x)`; break;
                case 'blown':
                case 'earrape': caption = `🤯 *Audio Blown!* (RIP Headphone users)`; break;
                case 'reverse': caption = `⏪ *Audio Reversed!*`; break;
                case 'echo': caption = `📢 *Echo Added!*`; break;
                case 'tremolo': caption = `〰️ *Tremolo Applied!*`; break;
                default: caption = `✅ *Filter Applied!*`;
            }

            await sock.sendMessage(from, {
                audio: fs.readFileSync(tempOut),
                mimetype: isPTT ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
                ptt: isPTT,
                caption: caption
            }, { quoted: msg });

            utils.log("MEDIA", `Applied ${type} filter with intensity ${intensity}`);

        } catch (err) {
            utils.log("ERROR", `Filter ${type} Failed: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Failed to apply ${type} filter.` }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    }
};
