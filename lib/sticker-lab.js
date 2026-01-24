const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const utils = require('./utils');

/* 
 * Sticker Lab - Advanced Sticker Manipulation
 */
module.exports = {
    /* 
     * Convert Sticker to Image (.toimg)
     */
    handleToImg: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.stickerMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote a *sticker* to convert it to an image!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🖼️", key: msg.key } });
        await fs.ensureDir(path.join(__dirname, '../temp'));

        const tempWebP = path.join(__dirname, '../temp', `temp_${Date.now()}.webp`);
        const tempJPG = path.join(__dirname, '../temp', `temp_${Date.now()}.jpg`);

        try {
            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempWebP, buffer);

            // Convert WebP to JPG using FFmpeg (extracting first frame for animated stickers)
            await new Promise((resolve, reject) => {
                ffmpeg(tempWebP)
                    .frames(1) // Single frame
                    .output(tempJPG)
                    .on('end', resolve)
                    .on('error', (err) => {
                        utils.log("ERROR", `ToImg FFmpeg Error: ${err.message}`);
                        reject(err);
                    })
                    .run();
            });

            await sock.sendMessage(from, {
                image: fs.readFileSync(tempJPG),
                caption: "🌠 *STARRY TO-IMAGE* 📸"
            }, { quoted: msg });

            utils.log("MEDIA", "Sticker converted to image successfully.");
        } catch (err) {
            utils.log("ERROR", `ToImg Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to convert sticker to image. Ensure the sticker is valid." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempWebP)) fs.unlinkSync(tempWebP);
            if (fs.existsSync(tempJPG)) fs.unlinkSync(tempJPG);
        }
    },

    /* 
     * Convert Animated Sticker to Video (.tovideo / .mp4)
     */
    handleToVideo: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.stickerMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote an *animated sticker* to convert it to a video!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎞️", key: msg.key } });
        await fs.ensureDir(path.join(__dirname, '../temp'));

        const tempWebP = path.join(__dirname, '../temp', `temp_${Date.now()}.webp`);
        const tempMP4 = path.join(__dirname, '../temp', `temp_${Date.now()}.mp4`);

        try {
            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempWebP, buffer);

            // Check if sticker is animated
            const isAnimated = quoted.stickerMessage.isAnimated;

            // Convert WebP to MP4 using FFmpeg
            await new Promise((resolve, reject) => {
                let command = ffmpeg(tempWebP);

                if (!isAnimated) {
                    // 🖼️ Static: Loop image for 3 seconds
                    command.inputOptions(['-loop 1', '-t 3'])
                        .outputOptions([
                            '-c:v libx264',
                            '-pix_fmt yuv420p',
                            '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure even dimensions
                            '-preset fast'
                        ]);
                } else {
                    // 🎞️ Animated: Convert directly
                    command.outputOptions([
                        '-c:v libx264',
                        '-pix_fmt yuv420p',
                        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
                        '-crf 23',
                        '-preset slow'
                    ]);
                }

                command
                    .output(tempMP4)
                    .on('end', resolve)
                    .on('error', (err) => {
                        utils.log("ERROR", `ToVideo FFmpeg Error: ${err.message}`);
                        reject(err);
                    })
                    .run();
            });

            await sock.sendMessage(from, {
                video: fs.readFileSync(tempMP4),
                caption: "🌠 *STARRY TO-VIDEO* 🎞️",
                gifPlayback: true
            }, { quoted: msg });

            utils.log("MEDIA", "Animated sticker converted to video successfully.");
        } catch (err) {
            utils.log("ERROR", `ToVideo Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to convert animated sticker. Ensure it's a valid animated sticker." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempWebP)) fs.unlinkSync(tempWebP);
            if (fs.existsSync(tempMP4)) fs.unlinkSync(tempMP4);
        }
    },

    /* 
     * Random Animal Stickers (.doge / .cat)
     */
    handleAnimal: async (msg, sock, botState, type) => {
        const from = msg.key.remoteJid;

        await sock.sendMessage(from, { react: { text: type === 'doge' ? '🐶' : '🐱', key: msg.key } });

        const netAlert = await utils.getNetworkAlert();
        const statusKey = await utils.updateStatus(sock, from, (type === 'doge' ? "🐶 *Fetching Doge...*" : "🐱 *Summoning Cat...*") + netAlert);

        try {
            let imageUrl;
            if (type === 'doge') {
                const res = await utils.withNetworkTimeout(
                    axios.get('https://dog.ceo/api/breeds/image/random'),
                    10000,
                    "Doge API Timed Out"
                );
                imageUrl = res.data.message;
            } else {
                const res = await utils.withNetworkTimeout(
                    axios.get('https://api.thecatapi.com/v1/images/search'),
                    10000,
                    "Cat API Timed Out"
                );
                imageUrl = res.data[0].url;
            }

            const sticker = new Sticker(imageUrl, {
                pack: 'Starry Animals',
                author: 'Starry MD',
                type: StickerTypes.CROPPED,
                quality: 60
            });

            const buffer = await sticker.toBuffer();
            await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
            await utils.updateStatus(sock, from, "✅ *Sent.*", statusKey);

            utils.log("MEDIA", `Random ${type} sticker sent.`);
        } catch (err) {
            utils.log("ERROR", `Animal Sticker Failed: ${err.message}`);
            const netStats = await utils.getNetworkStats();
            await utils.updateStatus(sock, from, "❌ *Failed.*", statusKey);
            await sock.sendMessage(from, { text: `❌ Failed to fetch ${type} image.\n${netStats.text}` }, { quoted: msg });
        }
    },

    /* 
     * Search and send a sticker by keyword
     */
    handleStickerSearch: async (msg, sock, botState, query, targetJid) => {
        const from = targetJid || msg?.key.remoteJid;
        if (!query) return;

        const netAlert = await utils.getNetworkAlert();
        const statusKey = msg ? await utils.updateStatus(sock, from, `🔎 *Searching Sticker: ${query}...*${netAlert}`) : null;

        try {
            // Tenor API (Public Anonymous Key)
            // Fallback to random if search fails
            const url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=8`;
            const res = await utils.withNetworkTimeout(
                axios.get(url),
                10000,
                "Tenor Search Timed Out"
            );

            const results = res.data.results;
            if (results.length === 0) {
                if (msg) await sock.sendMessage(from, { text: "❌ No stickers found for that keyword." }, { quoted: msg });
                return;
            }

            // Pick a random one from top 8 to keep it fresh
            const randomResult = results[Math.floor(Math.random() * results.length)];
            // Tenor provides GIFs. We need to convert GIF URL to Sticker.

            const gifUrl = randomResult.media[0].gif.url;

            const response = await axios.get(gifUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');

            const sticker = new Sticker(buffer, {
                pack: 'Starry Search',
                author: 'Tenor',
                type: StickerTypes.FULL,
                quality: 40 // Low quality for speed on animations
            });

            const stickerBuffer = await sticker.toBuffer();
            await sock.sendMessage(from, { sticker: stickerBuffer }, msg ? { quoted: msg } : {});
            if (statusKey) await utils.updateStatus(sock, from, "✅ *Found.*", statusKey);

            utils.log("MEDIA", `Sticker search sent for '${query}'`);

        } catch (e) {
            utils.log("ERROR", `Sticker search failed: ${e.message}`);

            const netStats = await utils.getNetworkStats();
            if (statusKey) await utils.updateStatus(sock, from, "❌ *Failed.*", statusKey);
            if (msg) await sock.sendMessage(from, { text: `❌ Failed to search sticker.\n${netStats.text}` }, { quoted: msg });
        }
    },

    /* 
     * Universal Sticker Forge (.sticker / .s)
     * Handles images and videos with automatic 5s trimming
     */
    handleSticker: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const pushName = msg.pushName || 'User';
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
        const messageToDownload = quoted || msg.message;

        const isImage = messageToDownload.imageMessage;
        const isVideo = messageToDownload.videoMessage;
        const isDocument = messageToDownload.documentMessage;

        let mime = '';
        if (isImage) mime = 'image';
        else if (isVideo) mime = 'video';
        else if (isDocument) mime = messageToDownload.documentMessage.mimetype;

        if (!isImage && !isVideo && (!isDocument || (!mime.startsWith('image/') && !mime.startsWith('video/')))) {
            return sock.sendMessage(from, { text: "❌ Please quote or send an *Image*, *Video*, or *GIF File* to create a sticker!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });
        await fs.ensureDir(path.join(__dirname, '../temp'));

        // Determine extension for ffmpeg compatibility
        let ext = '.bin';
        if (mime.includes('video') || mime === 'video') ext = '.mp4';
        else if (mime.includes('gif')) ext = '.gif';
        else if (mime.includes('image') || mime === 'image') ext = '.png';
        if (isDocument && mime.includes('webp')) ext = '.webp';

        const tempIn = path.join(__dirname, '../temp', `sticker_in_${Date.now()}${ext}`);
        const tempOut = path.join(__dirname, '../temp', `sticker_trimmed_${Date.now()}.mp4`);

        try {
            utils.log("MEDIA", `Sticker Processing: downloading media (${mime})...`);

            let buffer;
            try {
                buffer = await downloadMediaMessage(
                    { message: messageToDownload },
                    'buffer',
                    {},
                    { reuploadRequest: sock.updateMediaMessage }
                );
            } catch (dlErr) {
                throw new Error(`Download Failed: ${dlErr.message}`);
            }

            if (!buffer || buffer.length === 0) {
                throw new Error("Downloaded media buffer is empty.");
            }

            // 🎞️ VIDEO/GIF AUTO-TRIM (5 SECONDS MAX)
            // Reducing to 5s to ensure file size stays under WhatsApp's strict 500KB limit for animated stickers
            const isInputVideo = mime.startsWith('video') || mime.includes('gif');

            if (isInputVideo) {
                utils.log("MEDIA", "Trimming video/gif to 5s for sticker compatibility...");
                await fs.writeFile(tempIn, buffer);

                if (!fs.existsSync(tempIn)) {
                    throw new Error("Failed to write input file to temp storage.");
                }

                await new Promise((resolve, reject) => {
                    ffmpeg(tempIn)
                        .setStartTime(0)
                        .setDuration(5) // Reduced from 8s to 5s to prevent "Retry" errors (size limit)
                        .outputOptions([
                            '-c:v libx264',      // Standard H.264
                            '-crf 32',           // Lower quality for size
                            '-preset veryfast',
                            '-an',               // Strip audio
                            '-pix_fmt yuv420p',  // Standard pixel format for WA
                            '-r 15',             // Limit FPS
                            '-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000', // Scale to fit inside 512x512 with padding 
                            '-vf scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15'
                        ])
                        .output(tempOut)
                        .on('end', resolve)
                        .on('error', (err) => {
                            utils.log("ERROR", `FFmpeg Trim Failed: ${err.message}`);
                            reject(err);
                        })
                        .run();
                });

                // Robust file reading with retries
                let retries = 0;
                while (!fs.existsSync(tempOut) && retries < 5) {
                    await new Promise(r => setTimeout(r, 200));
                    retries++;
                }

                if (!fs.existsSync(tempOut)) {
                    throw new Error("Processed video file not found in internal storage (FFmpeg output missing).");
                }

                // Check file size. If > 700KB (buffer for conversion), it might fail.
                const stats = fs.statSync(tempOut);
                if (stats.size === 0) throw new Error("Processed video file is empty.");

                buffer = await fs.readFile(tempOut);
            }

            // Parse metadata
            let packName = 'Starry Stickers';
            let authorName = 'Starry MD';
            if (args && args.includes('|')) {
                const parts = args.split('|');
                packName = parts[0].trim() || packName;
                authorName = parts[1].trim() || authorName;
            }

            const sticker = new Sticker(buffer, {
                pack: packName,
                author: authorName,
                type: StickerTypes.CROPPED,
                quality: isInputVideo ? 10 : 60 // drastically reduce quality for videos to ensure success
            });

            const stickerBuffer = await sticker.toBuffer();

            if (!stickerBuffer || stickerBuffer.length === 0) {
                throw new Error("Sticker conversion produced empty buffer.");
            }

            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
            utils.log("MEDIA", `Sticker forged for ${pushName} (Type: ${isInputVideo ? 'Video/GIF' : 'Image'})`);

        } catch (err) {
            utils.log("ERROR", `Sticker Forge Failed: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Failed to forge sticker.\nReason: ${err.message}` }, { quoted: msg });
        } finally {
            // Cleanup with error supression
            try {
                if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
            } catch (cleanErr) {
                console.error("Cleanup Error:", cleanErr);
            }
        }
    }
};
