import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
const { ensureDir, writeFile, readFileSync, existsSync, unlinkSync, statSync, readFile } = fs;
import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
const { get } = axios;
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import utils, { ui, log, simulateTyping, getNetworkAlert, updateStatus, withNetworkTimeout, getNetworkStats } from '../core/utils.js';

/* 
 * Sticker Lab - Advanced Sticker Manipulation
 */
export async function handleToImg(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted || !quoted.stickerMessage) {
        return sock.sendMessage(from, { text: ui.error("Please quote a *sticker* to convert it to an image!") }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "🖼️", key: msg.key } });
    await ensureDir(join(__dirname, '../temp'));

    const tempWebP = join(__dirname, '../temp', `temp_${Date.now()}.webp`);
    const tempJPG = join(__dirname, '../temp', `temp_${Date.now()}.jpg`);

    try {
        const buffer = await downloadMediaMessage(
            { message: quoted },
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );

        await writeFile(tempWebP, buffer);

        // Convert WebP to JPG using FFmpeg (extracting first frame for animated stickers)
        await new Promise((resolve, reject) => {
            ffmpeg(tempWebP)
                .frames(1) // Single frame
                .output(tempJPG)
                .on('end', resolve)
                .on('error', (err) => {
                    log("ERROR", `ToImg FFmpeg Error: ${err.message}`);
                    reject(err);
                })
                .run();
        });

        await simulateTyping(sock, from, 2000); // converting...
        await sock.sendMessage(from, {
            image: readFileSync(tempJPG),
            caption: "🌠 *STARRY TO-IMAGE* 📸"
        }, { quoted: msg });

        log("MEDIA", "Sticker converted to image successfully.");
    } catch (err) {
        log("ERROR", `ToImg Failed: ${err.message}`);
        await sock.sendMessage(from, { text: ui.error("Failed to convert sticker to image. Ensure the sticker is valid.") }, { quoted: msg });
    } finally {
        if (existsSync(tempWebP)) unlinkSync(tempWebP);
        if (existsSync(tempJPG)) unlinkSync(tempJPG);
    }
}
export async function handleAnimal(msg, sock, botState, type) {
    const from = msg.key.remoteJid;

    await sock.sendMessage(from, { react: { text: type === 'doge' ? '🐶' : '🐱', key: msg.key } });

    const netAlert = await getNetworkAlert();
    const statusKey = await updateStatus(sock, from, (type === 'doge' ? "🐶 *Fetching Doge...*" : "🐱 *Summoning Cat...*") + netAlert);

    try {
        let imageUrl;
        if (type === 'doge') {
            const res = await withNetworkTimeout(
                get('https://dog.ceo/api/breeds/image/random'),
                10000,
                "Doge API Timed Out"
            );
            imageUrl = res.data.message;
        } else {
            const res = await withNetworkTimeout(
                get('https://api.thecatapi.com/v1/images/search'),
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
        await simulateTyping(sock, from, 1500); // sending sticker...
        await sock.sendMessage(from, { sticker: buffer }, { quoted: msg });
        await updateStatus(sock, from, "✅ *Sent.*", statusKey);

        log("MEDIA", `Random ${type} sticker sent.`);
    } catch (err) {
        log("ERROR", `Animal Sticker Failed: ${err.message}`);
        const netStats = await getNetworkStats();
        await updateStatus(sock, from, ui.error("Failed."), statusKey);
        await sock.sendMessage(from, { text: ui.error(`Failed to fetch ${type} image.\n${netStats.text}`) }, { quoted: msg });
    }
}
export async function handleStickerSearch(msg, sock, botState, query, targetJid) {
    const from = targetJid || msg?.key.remoteJid;
    if (!query) return;

    const netAlert = await getNetworkAlert();
    const statusKey = msg ? await updateStatus(sock, from, `🔎 *Searching Sticker: ${query}...*${netAlert}`) : null;

    try {
        // Tenor API (Public Anonymous Key)
        // Fallback to random if search fails
        const url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=LIVDSRZULELA&limit=8`;
        const res = await withNetworkTimeout(
            get(url),
            10000,
            "Tenor Search Timed Out"
        );

        const results = res.data.results;
        if (results.length === 0) {
            if (msg) await sock.sendMessage(from, { text: ui.error("No stickers found for that keyword.") }, { quoted: msg });
            return;
        }

        // Pick a random one from top 8 to keep it fresh
        const randomResult = results[Math.floor(Math.random() * results.length)];
        // Tenor provides GIFs. We need to convert GIF URL to Sticker.
        const gifUrl = randomResult.media[0].gif.url;

        const response = await get(gifUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        const sticker = new Sticker(buffer, {
            pack: 'Starry Search',
            author: 'Tenor',
            type: StickerTypes.FULL,
            quality: 40 // Low quality for speed on animations
        });

        const stickerBuffer = await sticker.toBuffer();
        await simulateTyping(sock, from, 1500); // sending sticker...
        await sock.sendMessage(from, { sticker: stickerBuffer }, msg ? { quoted: msg } : {});
        if (statusKey) await updateStatus(sock, from, "✅ *Found.*", statusKey);

        log("MEDIA", `Sticker search sent for '${query}'`);

    } catch (e) {
        log("ERROR", `Sticker search failed: ${e.message}`);

        const netStats = await getNetworkStats();
        if (statusKey) await updateStatus(sock, from, ui.error("Failed."), statusKey);
        if (msg) await sock.sendMessage(from, { text: ui.error(`Failed to search sticker.\n${netStats.text}`) }, { quoted: msg });
    }
}
export async function handleSticker(msg, sock, botState, args) {
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
        return sock.sendMessage(from, { text: ui.error("Please quote or send an *Image*, *Video*, or *GIF File* to create a sticker!") }, { quoted: msg });
    }

    await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });
    await ensureDir(join(__dirname, '../temp'));

    // Determine extension for ffmpeg compatibility
    let ext = '.bin';
    if (mime.includes('video') || mime === 'video') ext = '.mp4';
    else if (mime.includes('gif')) ext = '.gif';
    else if (mime.includes('image') || mime === 'image') ext = '.png';
    if (isDocument && mime.includes('webp')) ext = '.webp';

    const tempIn = join(__dirname, '../temp', `sticker_in_${Date.now()}${ext}`);
    const tempOut = join(__dirname, '../temp', `sticker_trimmed_${Date.now()}.mp4`);

    try {
        log("MEDIA", `Sticker Processing: downloading media (${mime})...`);

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
            log("MEDIA", "Trimming video/gif to 5s for sticker compatibility...");
            await writeFile(tempIn, buffer);

            if (!existsSync(tempIn)) {
                throw new Error("Failed to write input file to temp storage.");
            }

            await new Promise((resolve, reject) => {
                ffmpeg(tempIn)
                    .setStartTime(0)
                    .setDuration(5) // Reduced from 8s to 5s to prevent "Retry" errors (size limit)
                    .outputOptions([
                        '-c:v libx264', // Standard H.264
                        '-crf 30', // Middle ground (was 26, originally 32)
                        '-preset veryfast',
                        '-an', // Strip audio
                        '-pix_fmt yuv420p', // Standard pixel format for WA
                        '-r 15', // Limit FPS
                        '-vf scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000', // Scale to fit inside 512x512 with padding 
                        '-vf scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15'
                    ])
                    .output(tempOut)
                    .on('end', resolve)
                    .on('error', (err) => {
                        log("ERROR", `FFmpeg Trim Failed: ${err.message}`);
                        reject(err);
                    })
                    .run();
            });

            // Robust file reading with retries
            let retries = 0;
            while (!existsSync(tempOut) && retries < 5) {
                await new Promise(r => setTimeout(r, 200));
                retries++;
            }

            if (!existsSync(tempOut)) {
                throw new Error("Processed video file not found in internal storage (FFmpeg output missing).");
            }

            // Check file size. If > 700KB (buffer for conversion), it might fail.
            const stats = statSync(tempOut);
            if (stats.size === 0) throw new Error("Processed video file is empty.");

            buffer = await readFile(tempOut);
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
            quality: isInputVideo ? 25 : 60 // Balanced quality (was 40, originally 10)
        });

        const stickerBuffer = await sticker.toBuffer();

        if (!stickerBuffer || stickerBuffer.length === 0) {
            throw new Error("Sticker conversion produced empty buffer.");
        }

        await simulateTyping(sock, from, 2500); // Forging sticker...
        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
        log("MEDIA", `Sticker forged for ${pushName} (Type: ${isInputVideo ? 'Video/GIF' : 'Image'})`);

    } catch (err) {
        log("ERROR", `Sticker Forge Failed: ${err.message}`);
        await sock.sendMessage(from, { text: ui.error(`Failed to forge sticker.\nReason: ${err.message}`) }, { quoted: msg });
    } finally {
        // Cleanup with error supression
        try {
            if (existsSync(tempIn)) unlinkSync(tempIn);
            if (existsSync(tempOut)) unlinkSync(tempOut);
        } catch (cleanErr) {
            console.error("Cleanup Error:", cleanErr);
        }
    }
}
