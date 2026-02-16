const funZone = require('../../games/fun-zone');

/**
 * Fun & Games commands
 * Ported from monolithic handler.js
 */
module.exports = [
    {
        name: 'ship',
        category: 'fun',
        description: 'Ship two people together.',
        execute: async (msg, sock, args, botState) => {
            return funZone.handleShip(msg, sock, botState);
        }
    },
    {
        name: 'match',
        category: 'fun',
        description: 'Check your match with someone.',
        execute: async (msg, sock, args, botState) => {
            return funZone.handleMatch(msg, sock, botState);
        }
    },
    {
        name: 'gaycheck',
        aliases: ['gay'],
        category: 'fun',
        description: 'Check how gay someone is.',
        execute: async (msg, sock, args, botState) => {
            return funZone.handleGayCheck(msg, sock, botState);
        }
    },
    {
        name: 'truth',
        category: 'fun',
        description: 'Get a truth question.',
        execute: async (msg, sock, args, botState) => {
            return funZone.handleTruth(msg, sock, botState);
        }
    },
    {
        name: 'dare',
        category: 'fun',
        description: 'Get a dare challenge.',
        execute: async (msg, sock, args, botState) => {
            return funZone.handleDare(msg, sock, botState);
        }
    },
    {
        name: '8ball',
        category: 'fun',
        description: 'Ask the magic 8-ball a question.',
        execute: async (msg, sock, args, botState) => {
            return funZone.handle8Ball(msg, sock, botState, args);
        }
    }
];
