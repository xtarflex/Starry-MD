const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const utils = require('./utils');

/**
 * Sticker Lab - Advanced Sticker Manipulation
 */
module.exports = {
    /**
     * Convert Sticker to Image (.toimg)
     */
    handleToImg: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.stickerMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote a *sticker* to convert it to an image!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🖼️", key: msg.key } });

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

    /**
     * Convert Animated Sticker to Video (.tovideo / .mp4)
     */
    handleToVideo: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted || !quoted.stickerMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote an *animated sticker* to convert it to a video!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎞️", key: msg.key } });

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

            // Convert WebP (Animation) to MP4 using FFmpeg
            // We use specific flags for compatibility with WhatsApp video player
            await new Promise((resolve, reject) => {
                ffmpeg(tempWebP)
                    .outputOptions([
                        '-pix_fmt yuv420p',
                        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2,setpts=4*PTS', // Slower playback for short stickers
                        '-vcodec libx264',
                        '-crf 20',
                        '-preset slow'
                    ])
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

    /**
     * Random Animal Stickers (.doge / .cat)
     */
    handleAnimal: async (msg, sock, botState, type) => {
        const from = msg.key.remoteJid;

        await sock.sendMessage(from, { react: { text: type === 'doge' ? '🐶' : '🐱', key: msg.key } });

        try {
            let imageUrl;
            if (type === 'doge') {
                const res = await axios.get('https://dog.ceo/api/breeds/image/random');
                imageUrl = res.data.message;
            } else {
                const res = await axios.get('https://api.thecatapi.com/v1/images/search');
                imageUrl = res.data[0].url;
            }

            const sticker = new Sticker(imageUrl, {
                pack: 'Starry Animals',
                author: 'Starry MD',
                type: StickerTypes.FULL,
                quality: 60
            });

            const buffer = await sticker.toBuffer();
            await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });

            utils.log("MEDIA", `Random ${type} sticker sent.`);
        } catch (err) {
            utils.log("ERROR", `Animal Sticker Failed: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Failed to fetch ${type} image.` }, { quoted: msg });
        }
    },

    /**
     * Search and send a sticker by keyword
     */
    handleStickerSearch: async (msg, sock, botState, query, targetJid) => {
        const from = targetJid || msg?.key.remoteJid;
        if (!query) return;

        try {
            // Using a simple image search API or fallback to animal for demo
            // In a real scenario, use a specific sticker API
            const res = await axios.get(`https://api.thecatapi.com/v1/images/search?limit=1&size=small`);
            const imageUrl = res.data[0].url;

            const sticker = new Sticker(imageUrl, {
                pack: 'Starry AI',
                author: 'Starry MD',
                type: StickerTypes.FULL,
                quality: 50
            });

            const buffer = await sticker.toBuffer();
            await sock.sendMessage(from, { sticker: buffer }, msg ? { quoted: msg } : {});
        } catch (e) {
            utils.log("DEBUG", `Sticker search failed: ${e.message}`);
        }
    },

    /**
     * Universal Sticker Forge (.sticker / .s)
     * Handles images and videos with automatic 8s trimming
     */
    handleSticker: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const pushName = msg.pushName || 'User';
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
        const messageToDownload = quoted || msg.message;

        const isImage = messageToDownload.imageMessage;
        const isVideo = messageToDownload.videoMessage;

        if (!isImage && !isVideo) {
            return sock.sendMessage(from, { text: "❌ Please quote or send an *Image* or *Video* to create a sticker!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });

        const tempIn = path.join(__dirname, '../temp', `sticker_in_${Date.now()}`);
        const tempOut = path.join(__dirname, '../temp', `sticker_trimmed_${Date.now()}.mp4`);

        try {
            let buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            // 🎞️ VIDEO AUTO-TRIM (8 SECONDS MAX)
            if (isVideo) {
                utils.log("MEDIA", "Trimming video to 8s for sticker compatibility...");
                await fs.writeFile(tempIn, buffer);

                await new Promise((resolve, reject) => {
                    ffmpeg(tempIn)
                        .setStartTime(0)
                        .setDuration(8)
                        .outputOptions([
                            '-vcodec libx264',
                            '-crf 30',
                            '-preset fast',
                            '-pix_fmt yuv420p',
                            '-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black'
                        ])
                        .output(tempOut)
                        .on('end', async () => {
                            buffer = await fs.readFile(tempOut);
                            resolve();
                        })
                        .on('error', (err) => {
                            utils.log("ERROR", `FFmpeg Trim Failed: ${err.message}`);
                            reject(err);
                        })
                        .run();
                });
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
                type: isVideo ? StickerTypes.FULL : StickerTypes.CROPPED,
                quality: isVideo ? 40 : 60
            });

            const stickerBuffer = await sticker.toBuffer();
            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
            utils.log("MEDIA", `Sticker forged for ${pushName} (Type: ${isVideo ? 'Video' : 'Image'})`);

        } catch (err) {
            utils.log("ERROR", `Sticker Forge Failed: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Failed to forge sticker. Error: ${err.message}` }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    }
};
