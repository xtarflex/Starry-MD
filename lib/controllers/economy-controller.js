const economySocial = require('../economy-social');
const economyCrypto = require('../economy-crypto');
const economyForex = require('../economy-forex');
const economy = require('../economy');
const economyBilling = require('../economy-billing');
const utils = require('../utils');

const RPG_COMMANDS = [
    'work', 'daily', 'mine', 'dig', 'fish', 'hunt',
    'buy', 'shop', 'bank', 'bal',
    'balance', 'loan', 'dep', 'deposit',
    'with', 'withdraw', 'inventory', 'inv',
    'sell', 'heal', 'use', 'guide', 'map', 'rules', 'travel',
    'diamond', 'purge', 'rob', 'steal', 'arrest', 'drone', 'remote',
    'cooldowns', 'cd', 'cds', 'investors', 'wallstreet', 'stocks',
    'convert', 'exchange', 'swap', 'forex', 'fx', 'buyforex', 'buyfx',
    'sellforex', 'sellfx', 'census', 'players', 'users'
];

module.exports = {
    RPG_COMMANDS,

    handleEconomy: async (msg, sock, botState, cmd, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        // Registration Check (except for pure info commands that don't need profile? mostly strict)
        // commands like 'spawn' are handled in handler.js usually as setup, but let's check
        // handler.js checked: if (RPG_COMMANDS.includes(cmd)) { if !registered && cmd !== 'spawn' ... }

        if (cmd === 'census' || cmd === 'players' || cmd === 'users') {
            return economySocial.handleCensus(msg, sock, botState);
        }

        if (cmd === 'cooldowns' || cmd === 'cd' || cmd === 'cds') {
            return economySocial.handleCooldowns(msg, sock, botState);
        }

        if (cmd === 'investors' || cmd === 'wallstreet' || cmd === 'stocks') {
            return economySocial.handleInvestorLeaderboard(msg, sock, botState);
        }

        if (cmd === 'convert' || cmd === 'exchange' || cmd === 'swap') {
            return economyCrypto.handleConvert(msg, sock, botState, args);
        }

        if (cmd === 'forex' || cmd === 'fx') {
            return economyForex.handleForex(msg, sock, botState);
        }

        if (cmd === 'buyforex' || cmd === 'buyfx') {
            return economyForex.handleBuy(msg, sock, botState, args);
        }

        if (cmd === 'sellforex' || cmd === 'sellfx') {
            return economyForex.handleSell(msg, sock, botState, args);
        }

        return false; // Not handled here (handled by generic router or main loop)
    }
};
