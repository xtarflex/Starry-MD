import infoZone from '../../services/info-zone.js';
import utils from '../utils.js';

/**
 * Info & Tools commands
 * Ported from monolithic handler.js
 */
export default [
    {
        name: 'lyrics',
        aliases: ['ly'],
        category: 'info',
        description: 'Get lyrics for a song (supports smart reply context).',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const query = args.join(' ');

            // Smart Context Extraction logic omitted for brevity as it relied on msg structure
            // Re-implementing simplified check
            let search = query;
            if (!search) {
                const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quoted) {
                    if (quoted.conversation || quoted.extendedTextMessage?.text) {
                        const text = quoted.conversation || quoted.extendedTextMessage?.text || "";
                        const match = text.match(/lyrics for \*(.+?)\*/i);
                        if (match) search = match[1];
                    }
                }
            }

            if (!search) {
                return sock.sendMessage(from, { text: "❌ Please provide a song name! Example: `.lyrics Bohemian Rhapsody`" }, { quoted: msg });
            }

            await sock.sendMessage(from, { react: { text: "🎤", key: msg.key } });
            const songLyrics = await lyricsHelper.getLyrics(search);
            if (songLyrics) {
                return sock.sendMessage(from, { text: `🎤 *Lyrics for ${search}*\n\n${songLyrics}` }, { quoted: msg });
            } else {
                return sock.sendMessage(from, { text: "❌ Lyrics not found." }, { quoted: msg });
            }
        }
    },
    {
        name: 'lyricspref',
        category: 'info',
        description: 'Set lyrics preference (always/ask).',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const settings = (await import('../settings-manager.js')).default;
            const subCmd = args[0]?.toLowerCase();

            if (!['always', 'ask'].includes(subCmd)) {
                const current = settings.get(sender, 'lyrics_pref', 'ask');
                return sock.sendMessage(from, {
                    text: `⚙️ *LYRICS SETTINGS*\n\n*Current Mode:* ${current.toUpperCase()}\n\n*Available Modes:*\n• \`.lyricspref always\` - Always send lyrics with .play\n• \`.lyricspref ask\` - Show hint "Reply .lyrics"`
                }, { quoted: msg });
            }

            await settings.set(sender, 'lyrics_pref', subCmd);
            return sock.sendMessage(from, { text: `✅ Lyrics preference set to: *${subCmd.toUpperCase()}*` }, { quoted: msg });
        }
    },
    {
        name: 'trends',
        aliases: ['trending'],
        category: 'info',
        description: 'Get trending topics.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleTrends(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'news',
        category: 'info',
        description: 'Get latest news.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleNews(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'wiki',
        aliases: ['wikipedia'],
        category: 'info',
        description: 'Search Wikipedia.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleWiki(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'weather',
        category: 'info',
        description: 'Get weather info.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleWeather(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'define',
        aliases: ['dict', 'dictionary'],
        category: 'info',
        description: 'Define a word.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleDefine(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'google',
        aliases: ['search'],
        category: 'info',
        description: 'Google search.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleGoogle(msg, sock, botState, args.join(' '));
        }
    },
    {
        name: 'shorten',
        category: 'info',
        description: 'Shorten a URL.',
        execute: async (msg, sock, args, botState) => {
            return infoZone.handleShorten(msg, sock, botState, args.join(' '));
        }
    }
];
