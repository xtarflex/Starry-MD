import utils from '../utils.js';

export default [
    {
        name: 'testalbum',
        aliases: ['testmedia'],
        category: 'media',
        description: 'Send a test album.',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;

            await sock.sendMessage(from, { text: "📸 *Sending Album...*" }, { quoted: msg });
            const sampleImages = [
                { url: 'https://files.catbox.moe/p9t9u8.jpeg', caption: 'Image 1' },
                { url: 'https://files.catbox.moe/8381c0.jpeg', caption: 'Image 2' },
                { url: 'https://files.catbox.moe/3p0g1h.jpg', caption: 'Image 3' }
            ];
            await utils.sendAlbum(sock, from, sampleImages, { quoted: msg });
        }
    },
    {
        name: 'songinfo',
        description: 'Fetch detailed information about a song.',
        category: 'media',
        execute: async (msg, sock, args, botState) => {
            // Placeholder: audio-lab might not be converted or present.
            // Converting require check to import if possible, or try/catch.
            // Assuming audio-lab.js exists in correct location
            try {
                const audioLab = (await import('../audio-lab.js')).default;
                return audioLab.handleSongInfo(msg, sock, botState, args);
            } catch (e) {
                return sock.sendMessage(msg.key.remoteJid, { text: "⚠️ Audio Lab module not available." });
            }
        }
    }
];
