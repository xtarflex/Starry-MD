const socialLab = require('../../services/social-lab');

/**
 * Social Media Downloader commands
 * Ported from monolithic handler.js
 */
module.exports = [
    {
        name: 'tiktok',
        aliases: ['tt'],
        category: 'social',
        description: 'Download TikTok videos, search, or fetch profiles.',
        execute: async (msg, sock, args, botState) => {
            return socialLab.handleTikTok(msg, sock, botState, args);
        }
    },
    {
        name: 'instagram',
        aliases: ['ig', 'insta'],
        category: 'social',
        description: 'Download Instagram media (Reels, Posts).',
        execute: async (msg, sock, args, botState) => {
            return socialLab.handleInstagram(msg, sock, botState, args);
        }
    },
    {
        name: 'pinterest',
        aliases: ['pint'],
        category: 'social',
        description: 'Download Pinterest media or search for ideas.',
        execute: async (msg, sock, args, botState) => {
            return socialLab.handlePinterest(msg, sock, botState, args);
        }
    }
];
