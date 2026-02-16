const imageTools = require('../../services/image-tools');

/**
 * Image Manipulation & URL Tools
 * Ported from monolithic handler.js
 */
module.exports = [
    {
        name: 'meme',
        category: 'media',
        description: 'Create a meme with top/bottom text.',
        execute: async (msg, sock, args, botState) => {
            return imageTools.handleMeme(msg, sock, botState, args);
        }
    },
    {
        name: 'wasted',
        category: 'media',
        description: 'Apply GTA Wasted effect to an image.',
        execute: async (msg, sock, args, botState) => {
            return imageTools.handleWasted(msg, sock, botState);
        }
    },
    {
        name: 'tourl',
        aliases: ['imgtoURL'],
        category: 'tools',
        description: 'Convert an image/sticker to a public URL.',
        execute: async (msg, sock, args, botState) => {
            return imageTools.handleToURL(msg, sock, botState);
        }
    },
    {
        name: 'circle',
        category: 'media',
        description: 'Crop image into a circle.',
        execute: async (msg, sock, args, botState) => {
            return imageTools.handleFilter(msg, sock, botState, 'circle');
        }
    },
    {
        name: 'blur',
        category: 'media',
        description: 'Apply blur filter to an image.',
        execute: async (msg, sock, args, botState) => {
            return imageTools.handleFilter(msg, sock, botState, 'blur');
        }
    },
    {
        name: 'invert',
        category: 'media',
        description: 'Invert image colors.',
        execute: async (msg, sock, args, botState) => {
            return imageTools.handleFilter(msg, sock, botState, 'invert');
        }
    }
];
