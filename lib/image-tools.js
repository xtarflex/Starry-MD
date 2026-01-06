const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const { Jimp, loadFont, HorizontalAlign, VerticalAlign } = require('jimp');
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
    const baseUrl = "https://unpkg.com/jimp@0.22.12/fonts/open-sans/";
    if (width <= 320) return await utils.getFont(`${baseUrl}open-sans-16-white/open-sans-16-white.fnt`, loadFont);
    if (width <= 512) return await utils.getFont(`${baseUrl}open-sans-32-white/open-sans-32-white.fnt`, loadFont);
    if (width <= 1280) return await utils.getFont(`${baseUrl}open-sans-64-white/open-sans-64-white.fnt`, loadFont);
    return await utils.getFont(`${baseUrl}open-sans-128-white/open-sans-128-white.fnt`, loadFont);
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
            image.print({
                font,
                x: 0,
                y: 20,
                text: {
                    text: topText,
                    alignmentX: HorizontalAlign.CENTER,
                    alignmentY: VerticalAlign.TOP
                },
                maxWidth: w,
                maxHeight: h
            });

            // Bottom Text
            image.print({
                font,
                x: 0,
                y: -20,
                text: {
                    text: bottomText,
                    alignmentX: HorizontalAlign.CENTER,
                    alignmentY: VerticalAlign.BOTTOM
                },
                maxWidth: w,
                maxHeight: h
            });

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

            // 1. Grayscale the image
            image.grayscale();

            // 2. Add subtle blur to make text pop
            image.blur(2);

            // 3. Contrast adjustment for that gritty GTA feel (Higher for Wasted)
            image.contrast(0.4);

            // 4. Load font (Ensure open-sans-128-black is used)
            const font = await utils.getFont("https://unpkg.com/jimp@0.22.12/fonts/open-sans/open-sans-128-black/open-sans-128-black.fnt", loadFont);

            // 5. Print "WASTED" across the center
            image.print({
                font,
                x: 0,
                y: 0,
                text: {
                    text: "WASTED",
                    alignmentX: HorizontalAlign.CENTER,
                    alignmentY: VerticalAlign.MIDDLE
                },
                maxWidth: image.bitmap.width,
                maxHeight: image.bitmap.height
            });

            // 6. Apply Red Tint (GTA Wasted style)
            // Manual tint if color() plugin is finicky in v1
            try {
                image.color([{ apply: 'red', params: [60] }]);
            } catch (e) {
                utils.log("DEBUG", "Jimp color plugin failed, skipping red tint.");
            }

            await image.write(tempFile);

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

            // --- PROVIDER 1: Telegra.ph (Fast, Default) ---
            try {
                const form = new FormData();
                form.append('file', fs.createReadStream(tempFile));

                const { data } = await axios.post('https://telegra.ph/upload', form, {
                    headers: { ...form.getHeaders() },
                    timeout: 10000
                });

                if (data && data[0] && data[0].src) {
                    const url = `https://telegra.ph${data[0].src}`;
                    await sock.sendMessage(from, {
                        text: `☁️ *MEDIA HOSTED (Telegra.ph)*\n\n🔗 *Link:* ${url}\n\n_Note: This link is public and permanent._`
                    }, { quoted: msg });
                    utils.log("MEDIA", `Uploaded to Telegra.ph: ${url}`);
                    return;
                }
            } catch (e) {
                utils.log("DEBUG", `Telegra.ph failed, trying Catbox... (${e.message})`);
            }

            // --- PROVIDER 2: Catbox.moe (Robust Fallback) ---
            const formCat = new FormData();
            formCat.append('reqtype', 'fileupload');
            formCat.append('fileToUpload', fs.createReadStream(tempFile));

            const { data: catUrl } = await axios.post('https://catbox.moe/user/api.php', formCat, {
                headers: { ...formCat.getHeaders() }
            });

            if (catUrl && catUrl.startsWith('http')) {
                await sock.sendMessage(from, {
                    text: `☁️ *MEDIA HOSTED (Catbox)*\n\n🔗 *Link:* ${catUrl}\n\n_Note: Catbox is permanent for small files._`
                }, { quoted: msg });
                utils.log("MEDIA", `Uploaded to Catbox: ${catUrl}`);
            } else {
                throw new Error("All upload providers failed.");
            }
        } catch (err) {
            utils.log("ERROR", `ToURL Failed: ${err.message}`);
            await sock.sendMessage(from, { text: `❌ Upload failed. Reason: ${err.message}` }, { quoted: msg });
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }
    }
};
