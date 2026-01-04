const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const Jimp = require('jimp');
const axios = require('axios');
const FormData = require('form-data');
const utils = require('./utils');

/**
 * Image Tools - Visual Effects & Hosting
 */

/**
 * Smart Font Scaler
 * Picks the best Jimp font based on image width
 * @param {number} width - Image width
 * @returns {Promise<any>} Loaded font
 */
const getBestFont = async (width) => {
    if (width <= 320) return await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    if (width <= 720) return await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    if (width <= 1280) return await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    return await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
};

module.exports = {
    /**
     * Meme Generator (.meme)
     */
    handleMeme: async (msg, sock, botState, text) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || msg.message;

        if (!mediaMsg.imageMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote or send an *Image* to create a meme!" }, { quoted: msg });
        }

        if (!text || !text.includes('|')) {
            return sock.sendMessage(from, { text: "❌ Invalid format. Use: `.meme top text | bottom text`" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });

        const [topText, bottomText] = text.split('|').map(t => t.trim().toUpperCase());
        const tempIn = path.join(__dirname, '../temp', `meme_in_${Date.now()}.jpg`);
        const tempOut = path.join(__dirname, '../temp', `meme_out_${Date.now()}.jpg`);

        try {
            const buffer = await downloadMediaMessage(
                { message: mediaMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            await fs.writeFile(tempIn, buffer);
            const image = await Jimp.read(tempIn);

            // 🚀 SMART FONT SCALING
            const font = await getBestFont(image.bitmap.width);

            const w = image.bitmap.width;
            const h = image.bitmap.height;

            // Top Text
            image.print(
                font,
                0,
                20,
                {
                    text: topText,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_TOP
                },
                w,
                h
            );

            // Bottom Text
            image.print(
                font,
                0,
                -20,
                {
                    text: bottomText,
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM
                },
                w,
                h
            );

            await image.writeAsync(tempOut);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tempOut),
                caption: "🌠 *STARRY MEME FORGE* 🎨"
            }, { quoted: msg });

            utils.log("MEDIA", "Meme generated successfully.");
        } catch (err) {
            utils.log("ERROR", `Meme Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to generate meme. Try a clearer image." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        }
    },

    /**
     * GTA Wasted Effect (.wasted)
     * Optimized local processing
     */
    handleWasted: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || msg.message;

        if (!mediaMsg.imageMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote or send an *Image* for the Wasted effect!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "💀", key: msg.key } });

        const tempFile = path.join(__dirname, '../temp', `wasted_${Date.now()}.jpg`);

        try {
            const buffer = await downloadMediaMessage(
                { message: mediaMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            const image = await Jimp.read(buffer);

            // 1. Greyscale the image
            image.greyscale();

            // 2. Add subtle blur to make text pop
            image.blur(2);

            // 3. Contrast adjustment for that gritty GTA feel
            image.contrast(0.2);

            // 4. Load font
            const font = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);

            // 5. Print "WASTED" across the center
            image.print(
                font,
                0,
                0,
                {
                    text: "WASTED",
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                },
                image.bitmap.width,
                image.bitmap.height
            );

            // 6. Apply Red Tint
            image.color([{ apply: 'red', params: [50] }]);

            await image.writeAsync(tempFile);

            await sock.sendMessage(from, {
                image: fs.readFileSync(tempFile),
                caption: "💀 *WASTED*"
            }, { quoted: msg });

            utils.log("MEDIA", "Wasted effect applied locally.");
        } catch (err) {
            utils.log("ERROR", `Wasted Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to process image locally." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    },

    /**
     * Upload to URL (.tourl)
     * With 5MB protection limit
     */
    handleToURL: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || msg.message;

        if (!mediaMsg.imageMessage && !mediaMsg.videoMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote an *Image* or *Video* to upload!" }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "☁️", key: msg.key } });

        const tempFile = path.join(__dirname, '../temp', `upload_${Date.now()}`);

        try {
            const buffer = await downloadMediaMessage(
                { message: mediaMsg },
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );

            // 🛑 Telegra.ph 5MB Limit Check
            if (buffer.length > 5 * 1024 * 1024) {
                return sock.sendMessage(from, { text: "❌ File is too large! Telegra.ph limit is 5MB." }, { quoted: msg });
            }

            await fs.writeFile(tempFile, buffer);

            // Upload to Telegra.ph
            const form = new FormData();
            form.append('file', fs.createReadStream(tempFile));

            const { data } = await axios.post('https://telegra.ph/upload', form, {
                headers: { ...form.getHeaders() }
            });

            if (!data || !data[0] || !data[0].src) throw new Error("Telegra.ph upload failed");

            const url = `https://telegra.ph${data[0].src}`;

            await sock.sendMessage(from, {
                text: `☁️ *MEDIA HOSTED*\n\n🔗 *Link:* ${url}\n\n_Note: This link is public and permanent._`
            }, { quoted: msg });

            utils.log("MEDIA", `Uploaded to Telegra.ph: ${url}`);
        } catch (err) {
            utils.log("ERROR", `ToURL Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Upload failed. Media might be too large or provider is down." }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    }
};
