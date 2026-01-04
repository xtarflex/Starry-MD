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

        if (quoted.stickerMessage.isAnimated) {
            return sock.sendMessage(from, { text: "⚠️ This is an animated sticker. Use `.tovideo` or `.mp4` instead!" }, { quoted: msg });
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

            // Convert WebP to JPG using FFmpeg
            await new Promise((resolve, reject) => {
                ffmpeg(tempWebP)
                    .output(tempJPG)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            await sock.sendMessage(from, {
                image: fs.readFileSync(tempJPG),
                caption: "🌠 *STARRY TO-IMAGE* 📸"
            }, { quoted: msg });

            utils.log("MEDIA", "Sticker converted to image successfully.");
        } catch (err) {
            utils.log("ERROR", `ToImg Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to convert sticker. Ensure it's a static sticker." }, { quoted: msg });
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
                        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2' // Ensure even dimensions
                    ])
                    .output(tempMP4)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            await sock.sendMessage(from, {
                video: fs.readFileSync(tempMP4),
                caption: "🌠 *STARRY TO-VIDEO* 🎞️",
                gifPlayback: false
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
    }
};
