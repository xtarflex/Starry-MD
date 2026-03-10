/* 
 * Economy Crypto Module
 * Handles Cryptocurrency Market (High Volatility)
 */

import economy from './economy.js';
import utils from '../core/utils.js';

// Base Prices (USD)
const CRYPTO_COINS = {
    BTC: { name: "Bitcoin", base: 65000, volatility: 0.10 }, // +/- 10%
    ETH: { name: "Ethereum", base: 3500, volatility: 0.15 }, // +/- 15%
    SOL: { name: "Solana", base: 140, volatility: 0.20 },    // +/- 20%
    DOGE: { name: "Dogecoin", base: 0.15, volatility: 0.30 }, // +/- 30%
    XRP: { name: "Ripple", base: 0.60, volatility: 0.25 },
    ADA: { name: "Cardano", base: 0.45, volatility: 0.25 },
    DOT: { name: "Polkadot", base: 7.00, volatility: 0.30 },
    LINK: { name: "Chainlink", base: 15.00, volatility: 0.25 },
    BNB: { name: "Binance Coin", base: 600, volatility: 0.15 },
    STR: { name: "StarryCoin", base: 1.00, volatility: 0.50 } // +/- 50% (Wild!)
};

// --- SIMULATION ENGINE ---
// Prices update every 5 minutes and are stored in standard economy.json under "system.crypto_market"

async function getMarketData() {
    const sys = await economy.getSystemData();
    const now = Date.now();
    const UPDATE_INTERVAL = 5 * 60 * 1000;

    let market = sys.crypto_market || {};
    if (!market.last_update || now - market.last_update > UPDATE_INTERVAL) {
        // Update Prices
        market.last_update = now;
        market.coins = {};

        for (const [symbol, data] of Object.entries(CRYPTO_COINS)) {
            const change = (Math.random() * data.volatility * 2) - data.volatility;
            const newPrice = data.base * (1 + change);
            market.coins[symbol] = {
                price: parseFloat(newPrice.toFixed(2)),
                change24h: parseFloat((change * 100).toFixed(2))
            };
        }
        sys.crypto_market = market;
        await economy.saveDB(); // Save new prices
    }
    return market.coins;
}

// --- COMMANDS ---

async function handleConvert(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args || args.length === 0) {
        // Show Market
        const coins = await getMarketData();
        let txt = `📈 *CRYPTO MARKET*\n\n`;
        txt += Object.entries(coins).map(([sym, data]) => {
            const icon = data.change24h >= 0 ? '🟢' : '🔴';
            return `${icon} *${sym}:* $${data.price.toLocaleString()} (${data.change24h}%)`;
        }).join('\n') + '\n';
        txt += `\n_Usage: .convert buy <coin> <amount> | .convert sell <coin> <amount>_`;
        return sock.sendMessage(from, { text: txt }, { quoted: msg });
    }

    const action = args[0].toLowerCase();
    const symbol = args[1]?.toUpperCase();
    const amountStr = args[2];

    if (!['buy', 'sell'].includes(action)) {
        return sock.sendMessage(from, { text: "❌ Usage: `.convert buy/sell <coin> <amount>`" }, { quoted: msg });
    }

    if (!CRYPTO_COINS[symbol]) {
        return sock.sendMessage(from, { text: "❌ Unknown coin! Check list with `.convert`" }, { quoted: msg });
    }

    const market = await getMarketData();
    const price = market[symbol].price;

    if (action === 'buy') {
        let amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount!" }, { quoted: msg });

        const cost = price * amount;
        const balance = await economy.getBalance(sender, 'bank');

        if (balance < cost) {
            return sock.sendMessage(from, { text: `❌ Insufficient bank funds! Cost: $${cost.toLocaleString()}` }, { quoted: msg });
        }

        await economy.updateBalance(sender, -cost, 'bank');
        await economy.updateInventory(sender, symbol, amount); // Store crypto in inventory (simple)

        return sock.sendMessage(from, {
            text: `✅ *BOUGHT*\n\n${amount} ${symbol} for $${cost.toLocaleString()}\nRate: $${price.toLocaleString()}`
        }, { quoted: msg });
    }

    if (action === 'sell') {
        let amount = parseFloat(amountStr);
        const inv = await economy.getInventory(sender);
        const owned = inv[symbol] || 0;

        // Handle 'all'
        if (amountStr === 'all') amount = owned;

        if (owned < amount || amount <= 0) {
            return sock.sendMessage(from, { text: `❌ You only have ${owned} ${symbol}!` }, { quoted: msg });
        }

        const value = price * amount;
        await economy.updateInventory(sender, symbol, -amount);
        await economy.updateBalance(sender, value, 'bank');

        return sock.sendMessage(from, {
            text: `✅ *SOLD*\n\n${amount} ${symbol} for $${value.toLocaleString()}\nRate: $${price.toLocaleString()}`
        }, { quoted: msg });
    }
}

export default {
    handleConvert,
    getMarketData
};
