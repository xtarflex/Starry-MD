const stickerLab = require('../../services/sticker-lab');
const utils = require('../utils');
const config = require('../../../config');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker } = require('wa-sticker-formatter');

/**
 * Sticker-related commands
 * Ported from monolithic handler.js
 */
module.exports = [
    {
        name: 'toimg',
        aliases: ['toimage'],
        category: 'media',
        description: 'Convert a sticker to an image.',
        execute: async (msg, sock, args, botState) => {
            return stickerLab.handleToImg(msg, sock, botState);
        }
    },
    {
        name: 'sticker',
        aliases: ['s', 'stik'],
        category: 'media',
        description: 'Create a sticker from an image, video, or GIF.',
        execute: async (msg, sock, args, botState) => {
            return stickerLab.handleSticker(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'doge',
        aliases: ['dog'],
        category: 'fun',
        description: 'Get a random dog sticker.',
        execute: async (msg, sock, args, botState) => {
            return stickerLab.handleAnimal(msg, sock, botState, 'doge');
        }
    },
    {
        name: 'cat',
        aliases: ['kitty'],
        category: 'fun',
        description: 'Get a random cat sticker.',
        execute: async (msg, sock, args, botState) => {
            return stickerLab.handleAnimal(msg, sock, botState, 'cat');
        }
    },
    {
        name: 'stealsticker',
        aliases: ['ssteal', 'steal'],
        category: 'media',
        description: 'Steal a sticker and change its metadata.',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const quoted = contextInfo?.quotedMessage;

            if (!quoted || !quoted.stickerMessage) {
                return sock.sendMessage(from, { text: "❌ Please quote a *sticker* to steal!" }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: "🥷", key: msg.key } });

            try {
                // Download the sticker
                const buffer = await downloadMediaMessage(
                    { message: quoted },
                    'buffer',
                    {},
                    { reuploadRequest: sock.updateMediaMessage }
                );

                // Re-create sticker with YOUR metadata
                const packName = 'Stolen Stickers';
                const authorName = config.OWNER_NAME || 'Starry MD';

                const sticker = new Sticker(buffer, {
                    pack: packName,
                    author: authorName,
                    type: quoted.stickerMessage.isAnimated ? 'full' : 'cropped', // Maintain animation if possible
                    quality: 60
                });

                const stickerBuffer = await sticker.toBuffer();
                await utils.simulateTyping(sock, from, 1500);
                await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });

                utils.log("MEDIA", `Sticker stolen successfully.`);
            } catch (err) {
                utils.log("ERROR", `Steal Sticker Failed: ${err.message}`);
                await sock.sendMessage(from, { text: `❌ Failed to steal sticker: ${err.message}` }, { quoted: msg });
            }
        }
    }
];
