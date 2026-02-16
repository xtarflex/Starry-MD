const axios = require('axios');
const utils = require('../utils');
const { PassThrough } = require('stream');
const { Sticker } = require('wa-sticker-formatter');
const phService = require('../../services/ph-service'); // Updated Service
const { scrapeAlbumPhotos } = require('../scrapers/ph-album');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

/**
 * Optimize GIF/Video for sticker conversion
 */
async function optimizeGifForSticker(buffer) {
    const tmpInput = path.join(process.cwd(), 'tmp', `input_${Date.now()}.gif`);
    const tmpOutput = path.join(process.cwd(), 'tmp', `output_${Date.now()}.webp`);
    await fs.ensureDir(path.join(process.cwd(), 'tmp'));
    await fs.writeFile(tmpInput, buffer);

    return new Promise((resolve, reject) => {
        ffmpeg(tmpInput)
            .inputOptions(['-t 6'])
            .outputOptions([
                '-vcodec libwebp',
                '-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
                '-lossless 0',
                '-compression_level 4',
                '-q:v 40',
                '-loop 0',
                '-preset default',
                '-an',
                '-vsync 0'
            ])
            .toFormat('webp')
            .on('error', (err) => {
                fs.remove(tmpInput).catch(() => { });
                fs.remove(tmpOutput).catch(() => { });
                reject(err);
            })
            .on('end', async () => {
                const optimized = await fs.readFile(tmpOutput);
                await fs.remove(tmpInput);
                await fs.remove(tmpOutput);
                resolve(optimized);
            })
            .save(tmpOutput);
    });
}

/**
 * Handle the actual video streaming/download process
 */
async function startVideoDownload(sock, from, videoData, statusKey, msg) {
    try {
        await utils.updateStatus(sock, from, "🚀 *Initializing Stream...*", statusKey);
        const response = await axios({ method: 'get', url: videoData.videoUrl, responseType: 'stream', headers: { 'Range': 'bytes=0-' } });
        const totalSize = parseInt(response.headers['content-length']);
        let downloadedSize = 0;
        let lastUpdate = 0;
        let streamEnded = false;

        const stream = new PassThrough();

        const updateProgress = async (percent) => {
            const bar = "█".repeat(Math.floor(percent / 10)) + "░".repeat(10 - Math.floor(percent / 10));
            try {
                await utils.updateStatus(sock, from, `🚀 *Streaming Video...*\n\n[${bar}] ${percent}%`, statusKey);
            } catch (e) { }
        };

        response.data.on('data', (chunk) => {
            if (streamEnded) return;
            downloadedSize += chunk.length;
            const now = Date.now();
            if (now - lastUpdate > 4000) {
                const percent = Math.floor((downloadedSize / totalSize) * 100);
                updateProgress(percent);
                lastUpdate = now;
            }
            if (!stream.push(chunk)) {
                response.data.pause();
            }
        });

        stream.on('drain', () => {
            response.data.resume();
        });

        response.data.on('end', () => {
            if (!streamEnded) {
                streamEnded = true;
                stream.push(null);
            }
        });

        response.data.on('error', (err) => {
            if (!streamEnded) {
                streamEnded = true;
                stream.emit('error', err);
            }
        });

        await sock.sendMessage(from, {
            video: { stream },
            caption: `🔞 *${videoData.title}*\n⏱️ ${Math.floor(videoData.duration / 60)}m ${videoData.duration % 60}s | 👤 ${videoData.author}\n\n_Starry Downloader_`,
            mimetype: 'video/mp4'
        }, { quoted: msg });

        await utils.updateStatus(sock, from, "✅ *Sent.*", statusKey);
    } catch (e) {
        throw e;
    }
}

module.exports = {
    name: 'ph',
    aliases: ['pornhub', 'phub'],
    category: 'nsfw',
    description: 'Download or search from Pornhub. Modes: info, star, gif, sticker, random, search, photo.',
    execute: async (msg, sock, args, botState) => {
        const from = msg.key.remoteJid;
        let mode = 'video';
        let queryArgs = args;
        const MAX_LIMIT = 60 * 60; // 60 minutes
        const DEFAULT_LIMIT = 10 * 60; // 10 minutes default

        if (!botState.pendingPH) botState.pendingPH = {};
        const body = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim().toLowerCase();
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (quoted && (body === 'yes' || body === 'no' || /^\d+$/.test(body))) {
            const pending = botState.pendingPH[from];
            if (pending && Date.now() - pending.timestamp < 300000) {
                if (body === 'no') {
                    delete botState.pendingPH[from];
                    return sock.sendMessage(from, { text: "✅ *Action cancelled.*" }, { quoted: msg });
                }
                let limit = /^\d+$/.test(body) ? parseInt(body) : null;
                const statusKey = await utils.updateStatus(sock, from, "🚀 *Starting requested task...*");
                try {
                    if (pending.type === 'video') {
                        await startVideoDownload(sock, from, pending.data, statusKey, msg);
                    } else if (pending.type === 'photo') {
                        let images = await scrapeAlbumPhotos(pending.data.link);
                        if (images.length === 0) throw new Error("Could not extract images.");
                        if (limit && limit > 0) images = images.slice(0, limit);
                        await utils.updateStatus(sock, from, `📸 *Downloading ${images.length} photos...*`, statusKey);
                        for (let i = 0; i < images.length; i++) {
                            await sock.sendMessage(from, { image: { url: images[i] }, caption: `🖼️ Photo ${i + 1}/${images.length}` });
                            await utils.delay(1000);
                        }
                        await utils.updateStatus(sock, from, "✅ *Photos sent.*", statusKey);
                    }
                    delete botState.pendingPH[from];
                    return;
                } catch (err) {
                    return utils.updateStatus(sock, from, `❌ *Task Failed:* ${err.message}`, statusKey);
                }
            }
        }

        if (args.length > 0) {
            const first = args[0].toLowerCase();
            const validModes = ['info', 'star', 'gif', 'sticker', 'random', 'search', 'photo'];
            if (validModes.includes(first)) {
                mode = first;
                queryArgs = args.slice(1);
            }
        }

        let input = queryArgs.join(' ');
        if (!input && mode !== 'random') {
            const qText = quoted ? (quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || quoted.videoMessage?.caption || "") : "";
            const phMatch = qText.match(/https?:\/\/(?:www\.)?pornhub\.com\/view_video\.php\?viewkey=[^\s]+/i);
            if (phMatch) input = phMatch[0];
        }

        let customLimit = DEFAULT_LIMIT;
        const durationMatch = input.match(/<(\d+)/);
        if (durationMatch) {
            customLimit = parseInt(durationMatch[1]) * 60;
            input = input.replace(/<(\d+)/, '').trim();
        }

        if (!input && mode !== 'random') {
            return sock.sendMessage(from, {
                text: "❌ *Usage:*\n• .ph <search/link>\n• .ph info <link>\n• .ph star <name>\n• .ph gif/sticker <query>\n• .ph photo <query>\n• .ph search <query>\n• .ph random"
            }, { quoted: msg });
        }

        const statusKey = await utils.updateStatus(sock, from, `🔎 *Pornhub: ${mode.toUpperCase()} mode...*`);

        try {
            if (mode === 'search') {
                const results = await phService.scrapeSearch(input);
                if (results.length === 0) throw new Error("No results found.");
                let txt = `🔎 *Search Results:* "${input}"\n\n`;
                results.slice(0, 10).forEach((r, i) => { txt += `${i + 1}. *${r.title}*\n   Link: ${r.link}\n   Duration: ${r.duration || 'N/A'}\n\n`; });
                return utils.updateStatus(sock, from, txt, statusKey);
            }

            if (mode === 'star') {
                const stars = await phService.scrapePornstars(input);
                if (stars.length === 0) throw new Error("No pornstars found.");
                const star = stars[0];
                let txt = `👤 *Pornstar Info: ${star.name}*\n\n🏆 *Rank:* ${star.rank || 'N/A'}\n🎥 *Videos:* ${star.videos || '0'}\n👁️ *Total Views:* ${star.views || '0'}\n🔗 *Profile:* ${star.link}`;
                return utils.updateStatus(sock, from, txt, statusKey);
            }

            if (mode === 'photo') {
                const albums = await phService.scrapePhotos(input);
                if (albums.length === 0) throw new Error("No photo albums found.");
                const album = albums[0];
                let txt = `📸 *Photo Album: ${album.title}*\n\n🖼️ *Photos:* ${album.count || 'N/A'}\n⭐ *Rating:* ${album.rating || 'N/A'}\n🔗 *Link:* ${album.link}\n\n_Download all photos? reply yes, no, or a quantity (e.g. 5)_`;
                botState.pendingPH[from] = { type: 'photo', data: album, timestamp: Date.now() };
                if (album.cover) {
                    await sock.sendMessage(from, { image: { url: album.cover }, caption: txt }, { quoted: msg });
                    return utils.updateStatus(sock, from, "✅ *Album Summary Sent.*", statusKey);
                } else return utils.updateStatus(sock, from, txt, statusKey);
            }

            if (mode === 'gif' || mode === 'sticker') {
                const gifs = await phService.scrapeGifs(input);
                if (gifs.length === 0) throw new Error("No GIFs found.");
                const gif = gifs[0];
                if (mode === 'sticker') {
                    await utils.updateStatus(sock, from, "🎨 *Optimizing and Converting GIF to Sticker...*", statusKey);
                    const { data: buffer } = await axios.get(gif.link, { responseType: 'arraybuffer' });
                    const optimizedBuffer = await optimizeGifForSticker(buffer);
                    const sticker = new Sticker(optimizedBuffer, { pack: 'Pornhub Stickers', author: 'Starry MD', type: 'full' });
                    const stickerBuffer = await sticker.toBuffer();
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
                    return utils.updateStatus(sock, from, "✅ *Sticker Sent.*", statusKey);
                } else {
                    await sock.sendMessage(from, { video: { url: gif.link }, caption: `🔞 *${gif.title}*`, gifPlayback: true }, { quoted: msg });
                    return utils.updateStatus(sock, from, "✅ *GIF Sent.*", statusKey);
                }
            }

            if (mode === 'random') input = "https://www.pornhub.com/video/random";
            const isUrl = input.includes('pornhub.com/view_video.php') || mode === 'random';
            let videoData = null;

            if (isUrl) {
                videoData = await phService.scrapeVideo(input);
            } else {
                const searchResults = await phService.scrapeSearch(input);
                for (const res of searchResults) {
                    const potentialVideo = await phService.scrapeVideo(res.link);
                    if (potentialVideo && (potentialVideo.duration <= customLimit || (customLimit === DEFAULT_LIMIT && potentialVideo.duration <= MAX_LIMIT))) {
                        videoData = potentialVideo;
                        break;
                    }
                }
            }

            if (!videoData) throw new Error(`Could not find a valid video under ${Math.ceil(customLimit / 60)} minutes.`);

            if (mode === 'info') {
                let info = `🔞 *Video Info Card*\n\n🎬 *Title:* ${videoData.title}\n⏱️ *Duration:* ${Math.floor(videoData.duration / 60)}:${(videoData.duration % 60).toString().padStart(2, '0')}\n🏢 *Author:* ${videoData.author || 'Pornhub'}\n🔗 *URL:* ${input}`;
                return utils.updateStatus(sock, from, info, statusKey);
            }

            if (videoData.duration > customLimit) {
                let warn = `⚠️ *Large Video Detected*\n\n🎬 *Title:* ${videoData.title}\n⏱️ *Duration:* ${Math.floor(videoData.duration / 60)}m ${videoData.duration % 60}s\n\n_Download size exceeds default duration. Download anyways? reply yes or no_`;
                botState.pendingPH[from] = { type: 'video', data: videoData, timestamp: Date.now() };
                return utils.updateStatus(sock, from, warn, statusKey);
            }

            await startVideoDownload(sock, from, videoData, statusKey, msg);
        } catch (e) {
            utils.log("ERROR", `Pornhub Command Failed: ${e.message}`);
            utils.updateStatus(sock, from, `❌ *Error:* ${e.message}`, statusKey);
        }
    }
};
