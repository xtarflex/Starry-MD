import economyBasic from '../../systems/economy-basic.js';
import economyActivities from '../../systems/economy-activities.js';
import economyShop from '../../systems/economy-shop.js';
import economyTasks from '../../systems/economy-tasks.js';
import economyCrypto from '../../systems/economy-crypto.js';
import economyStock from '../../systems/economy-stock.js';
import economySocial from '../../systems/economy-social.js';
import economyGame from '../../systems/economy-game.js';
import utils from '../utils.js';
import config from '../../../config.js';

// Dynamic Import Helper for cyclic dependencies or heavy modules
// const economyWorld = await import('../../systems/economy-world.js');
// const economyAdvisor = await import('../../systems/economy-advisor.js');


/**
 * Economy System Commands
 * Ported from monolithic handler.js
 */
export default [
    // Basic Economy
    {
        name: 'balance',
        aliases: ['bal'],
        category: 'economy',
        description: 'Check your wallet and bank balance.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleBalance(msg, sock, botState);
        }
    },
    {
        name: 'spawn',
        category: 'economy',
        description: 'Spawn in the economy world.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleSpawn(msg, sock, botState, args);
        }
    },
    {
        name: 'guide',
        aliases: ['rules'],
        category: 'economy',
        description: 'View economy guide and rules.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleGuide(msg, sock, botState, args);
        }
    },
    {
        name: 'map',
        category: 'economy',
        description: 'View the economy world map.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleMap(msg, sock, botState);
        }
    },
    {
        name: 'travel',
        category: 'economy',
        description: 'Travel to a different location.',
        execute: async (msg, sock, args, botState) => {
            const economyWorld = (await import('../../systems/economy-world.js')).default;
            return economyWorld.handleTravel(msg, sock, botState, args);
        }
    },
    {
        name: 'update',
        category: 'economy',
        description: 'Check for economy updates.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleUpdateAlert(msg, sock, botState);
        }
    },
    {
        name: 'loan',
        category: 'economy',
        description: 'Take a loan from the bank.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleLoan(msg, sock, botState);
        }
    },
    {
        name: 'diamond',
        category: 'economy',
        description: 'Claim your daily diamond reward.',
        execute: async (msg, sock, args, botState) => {
            return economyGame.claimDiamond(msg, sock, botState);
        }
    },
    {
        name: 'purge',
        category: 'owner',
        description: 'Start a 60-minute economy purge (Owner Only).',
        execute: async (msg, sock, args, botState) => {
            const from = msg.key.remoteJid;
            const sender = utils.decodeJid(msg.key.participant || from);
            const isOwner = config.OWNER_ID.toString().split(',').some(id => id.trim() + '@s.whatsapp.net' === sender);

            if (!isOwner) return sock.sendMessage(from, { text: "❌ This command is restricted to the bot owner." }, { quoted: msg });

            economyGame.startPurge(60);
            return sock.sendMessage(from, { text: `🚨 *THE PURGE HAS BEGUN* 🚨\n\nAll crime laws are suspended for 60 minutes.\nRobbery defense multipliers are NULLIFIED.` });
        }
    },
    {
        name: 'daily',
        category: 'economy',
        description: 'Claim your daily reward.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleDaily(msg, sock, botState);
        }
    },
    {
        name: 'work',
        category: 'economy',
        description: 'Work to earn money.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleWork(msg, sock, botState);
        }
    },
    {
        name: 'deposit',
        aliases: ['dep'],
        category: 'economy',
        description: 'Deposit money into your bank.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleDeposit(msg, sock, botState);
        }
    },
    {
        name: 'withdraw',
        aliases: ['with'],
        category: 'economy',
        description: 'Withdraw money from your bank.',
        execute: async (msg, sock, args, botState) => {
            return economyBasic.handleWithdraw(msg, sock, botState);
        }
    },

    // Economy Activities
    {
        name: 'fish',
        category: 'activities',
        description: 'Go fishing.',
        execute: async (msg, sock, args, botState) => {
            return economyActivities.handleFish(msg, sock, botState);
        }
    },
    {
        name: 'mine',
        aliases: ['dig'],
        category: 'activities',
        description: 'Go mining.',
        execute: async (msg, sock, args, botState) => {
            return economyActivities.handleMine(msg, sock, botState);
        }
    },
    {
        name: 'hunt',
        category: 'activities',
        description: 'Go hunting for animals.',
        execute: async (msg, sock, args, botState) => {
            return economyActivities.handleHunt(msg, sock, botState);
        }
    },
    {
        name: 'rob',
        category: 'activities',
        description: 'Rob or steal from another user.',
        execute: async (msg, sock, args, botState) => {
            return economyActivities.handleRob(msg, sock, botState, args);
        }
    },
    {
        name: 'drone',
        aliases: ['remote'],
        category: 'activities',
        description: 'Use a drone for a remote robbery.',
        execute: async (msg, sock, args, botState) => {
            return economyActivities.handleDroneRob(msg, sock, botState);
        }
    },

    // Shop & Inventory
    {
        name: 'shop',
        category: 'economy',
        description: 'View the items available in the shop.',
        execute: async (msg, sock, args, botState) => {
            return economyShop.handleShop(msg, sock, botState);
        }
    },
    {
        name: 'buy',
        category: 'economy',
        description: 'Buy an item from the shop.',
        execute: async (msg, sock, args, botState) => {
            return economyShop.handleBuy(msg, sock, botState, args);
        }
    },
    {
        name: 'sell',
        category: 'economy',
        description: 'Sell your items.',
        execute: async (msg, sock, args, botState) => {
            return economyShop.handleSell(msg, sock, botState, args);
        }
    },
    {
        name: 'inventory',
        aliases: ['inv'],
        category: 'economy',
        description: 'View your item inventory.',
        execute: async (msg, sock, args, botState) => {
            return economyShop.handleInventory(msg, sock, botState);
        }
    },
    {
        name: 'use',
        category: 'economy',
        description: 'Use an item from your inventory.',
        execute: async (msg, sock, args, botState) => {
            return economyShop.handleUse(msg, sock, botState, args);
        }
    },
    {
        name: 'heal',
        category: 'economy',
        description: 'Heal yourself.',
        execute: async (msg, sock, args, botState) => {
            return economyShop.handleHeal(msg, sock, botState);
        }
    },

    // Tasks & Missions
    {
        name: 'tasks',
        aliases: ['mission', 'goals'],
        category: 'economy',
        description: 'View your active tasks and missions.',
        execute: async (msg, sock, args, botState) => {
            return economyTasks.handleTasks(msg, sock, botState);
        }
    },
    {
        name: 'claim',
        category: 'economy',
        description: 'Claim rewards for completed tasks.',
        execute: async (msg, sock, args, botState) => {
            return economyTasks.handleClaim(msg, sock, botState, args);
        }
    },

    // Crypto & Investing
    {
        name: 'crypto',
        category: 'investment',
        description: 'Check crypto market and your holdings.',
        execute: async (msg, sock, args, botState) => {
            return economyCrypto.handleCrypto(msg, sock, botState);
        }
    },
    {
        name: 'buycrypto',
        category: 'investment',
        description: 'Buy cryptocurrency.',
        execute: async (msg, sock, args, botState) => {
            return economyCrypto.handleBuy(msg, sock, botState, args);
        }
    },
    {
        name: 'sellcrypto',
        category: 'investment',
        description: 'Sell cryptocurrency.',
        execute: async (msg, sock, args, botState) => {
            return economyCrypto.handleSell(msg, sock, botState, args);
        }
    },
    {
        name: 'convert',
        category: 'investment',
        description: 'Convert between crypto and currency.',
        execute: async (msg, sock, args, botState) => {
            return economyCrypto.handleConvert(msg, sock, botState, args);
        }
    },
    {
        name: 'stock',
        aliases: ['stocks', 'invest'],
        category: 'investment',
        description: 'Check stock market and your portfolio.',
        execute: async (msg, sock, args, botState) => {
            return economyStock.handleStock(msg, sock, botState);
        }
    },
    {
        name: 'buystock',
        category: 'investment',
        description: 'Buy stocks.',
        execute: async (msg, sock, args, botState) => {
            return economyStock.handleBuy(msg, sock, botState, args);
        }
    },
    {
        name: 'sellstock',
        category: 'investment',
        description: 'Sell stocks.',
        execute: async (msg, sock, args, botState) => {
            return economyStock.handleSell(msg, sock, botState, args);
        }
    },
    {
        name: 'advisor',
        aliases: ['forecast'],
        category: 'investment',
        description: 'Get AI-powered financial advice.',
        execute: async (msg, sock, args, botState) => {
            const economyAdvisor = (await import('../../systems/economy-advisor.js')).default;
            return economyAdvisor.handleAdvisor(msg, sock, botState, args);
        }
    },

    // Social & Profiles
    {
        name: 'profile',
        category: 'social',
        description: 'View your or another user\'s profile.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleProfile(msg, sock, botState, args);
        }
    },
    {
        name: 'gift',
        category: 'social',
        description: 'Send money as a gift to another user.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleGift(msg, sock, botState, args);
        }
    },
    {
        name: 'leaderboard',
        aliases: ['lb'],
        category: 'social',
        description: 'View the economy leaderboard.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleLeaderboard(msg, sock, botState);
        }
    },
    {
        name: 'setbio',
        aliases: ['bio'],
        category: 'social',
        description: 'Set your profile bio.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleSetBio(msg, sock, botState, args);
        }
    },
    {
        name: 'setname',
        aliases: ['name', 'regname'],
        category: 'social',
        description: 'Set your profile name.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleSetName(msg, sock, botState, args);
        }
    },
    {
        name: 'rich',
        aliases: ['richlist', 'elite'],
        category: 'social',
        description: 'View the richest users.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleRichList(msg, sock, botState);
        }
    },
    {
        name: 'investors',
        aliases: ['protrader'],
        category: 'social',
        description: 'View the top investors leaderboard.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleInvestorLeaderboard(msg, sock, botState);
        }
    },
    {
        name: 'census',
        aliases: ['users', 'players'],
        category: 'social',
        description: 'View economy population stats.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleCensus(msg, sock, botState);
        }
    },
    {
        name: 'titles',
        aliases: ['title'],
        category: 'social',
        description: 'View and manage your titles.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleTitles(msg, sock, botState);
        }
    },
    {
        name: 'equip',
        category: 'social',
        description: 'Equip an item or title.',
        execute: async (msg, sock, args, botState) => {
            return economySocial.handleEquip(msg, sock, botState, args);
        }
    }
];
