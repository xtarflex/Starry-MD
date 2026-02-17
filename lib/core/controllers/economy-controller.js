import economySocial from '../../systems/economy-social.js';
import economyCrypto from '../../systems/economy-crypto.js';
import economyForex from '../../systems/economy-forex.js';
import economy from '../../systems/economy.js';
import economyBilling from '../../systems/economy-billing.js';
import economyShop from '../../systems/economy-shop.js'; // Added missing import
import utils from '../utils.js';

const RPG_COMMANDS = [
    'work', 'daily', 'mine', 'dig', 'fish', 'hunt',
    'buy', 'shop', 'bank', 'bal',
    'balance', 'loan', 'dep', 'deposit',
    'with', 'withdraw', 'inventory', 'inv',
    'sell', 'heal', 'use', 'guide', 'map', 'rules', 'travel',
    'diamond', 'purge', 'rob', 'steal', 'arrest', 'drone', 'remote',
    'cooldowns', 'cd', 'cds', 'investors', 'wallstreet', 'stocks',
    'convert', 'exchange', 'swap', 'forex', 'fx', 'buyforex', 'buyfx',
    'sellforex', 'sellfx', 'census', 'players', 'users',
    'tasks', 'claim', 'gift', 'pay', 'transfer', 'profile', 'leaderboard', 'lb'
];

export default {
    RPG_COMMANDS,

    handleEconomy: async (msg, sock, botState, cmd, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        // Registration Check (except for pure info commands that don't need profile? mostly strict)
        // handler.js handles registration check usually

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
            // economyForex might need buy/sell handlers implemented or exposed
            // Assuming economyForex has them:
            return economyForex.handleExchange ? economyForex.handleExchange(msg, sock, botState, args) : false;
        }

        // Map other commands to their modules
        if (cmd === 'rob' || cmd === 'steal') return economySocial.handleRob(msg, sock, botState, args);
        if (cmd === 'gift' || cmd === 'pay' || cmd === 'transfer') return economySocial.handleGift(msg, sock, botState, args);
        if (cmd === 'leaderboard' || cmd === 'lb') return economySocial.handleLeaderboard(msg, sock, botState);
        if (cmd === 'profile') return economySocial.handleProfile(msg, sock, botState, args);

        if (cmd === 'shop' || cmd === 'store') return economyShop.handleShop(msg, sock, botState, args);
        if (cmd === 'buy') return economyShop.handleBuy(msg, sock, botState, args);
        if (cmd === 'inventory' || cmd === 'inv') return economyShop.handleInventory(msg, sock, botState);
        if (cmd === 'use') return economyShop.handleUse(msg, sock, botState, args);

        // Fallback
        return false;
    }
};
