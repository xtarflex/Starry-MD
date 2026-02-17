/* 
 * Economy Stock Module
 * Handles Stock Market (Investments, Dividends, Lower Volatility)
 */

import economy from './economy.js';
import utils from '../core/utils.js';

// Stock Tickers
const STOCKS = {
    TECH: { name: "Cyber Systems", base: 120, trend: 0.05 },
    MINE: { name: "Deep Space Mining", base: 45, trend: 0.02 },
    VOID: { name: "Void Energy", base: 300, trend: 0.15 },
    BANK: { name: "Galactic Bank", base: 80, trend: 0.01 },
    FOOD: { name: "Orbital Organics", base: 25, trend: 0.03 },
    TSLA: { name: "Tesla Inc", base: 220, trend: 0.08 },
    AMZN: { name: "Amazon", base: 180, trend: 0.06 },
    SPCE: { name: "Virgin Galactic", base: 15, trend: 0.25 },
    NVDA: { name: "Nvidia", base: 900, trend: 0.10 },
    AAPL: { name: "Apple", base: 175, trend: 0.04 }
};

/* 
 * Get Current Stock Prices
 * Updates every 30 minutes
 */
export function getStockPrices() {
    const timeBlock = Math.floor(Date.now() / 1800000); // 30 Minute blocks (1,800,000 ms)
    const prices = {};

    for (const [ticker, stock] of Object.entries(STOCKS)) {
        const seed = timeBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const random = seededRandom(seed);

        // Slower movement, trend based
        // Combine a daily trend (timeBlock) with some random noise
        const dayTrend = Math.sin(timeBlock / 24) * stock.trend; // Cyclic trends
        const noise = (random * 2 - 1) * (stock.trend / 2); // Random noise

        const change = dayTrend + noise;
        let price = stock.base * (1 + change);

        if (price < 1) price = 1;

        prices[ticker] = price;
    }
    return prices;
}

function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/* 
 * Display Stock Market
 */
async function handleStock(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);
    const market = getStockPrices();

    // Init Logic
    if (!user.portfolio) user.portfolio = { crypto: {}, stocks: {} };
    if (!user.portfolio.stocks) user.portfolio.stocks = {};

    // Timer Logic
    const now = Date.now();
    const timeBlock = Math.floor(now / 1800000);
    const nextUpdate = (timeBlock + 1) * 1800000;
    const timeLeft = Math.max(0, nextUpdate - now);
    const secondsLeft = Math.floor((timeLeft / 1000) % 60);
    const minutesLeft = Math.floor((timeLeft / 1000 / 60));

    let text = `📈 *STAR-STREET STOCK MARKET*\n`;
    text += `_Next Update: ${minutesLeft}m ${secondsLeft}s (Interval: 30m)_\n\n`;

    // 1. Market List
    text += `*📊 Tickers:*\n`;
    for (const [ticker, price] of Object.entries(market)) {
        let priceFmt = price.toFixed(2);
        const name = STOCKS[ticker].name;
        // Direction
        const prevBlock = Math.floor(Date.now() / 1800000) - 1;
        const seed = prevBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const prevPrice = STOCKS[ticker].base * (1 + (Math.sin(prevBlock / 24) * STOCKS[ticker].trend + (seededRandom(seed) * 2 - 1) * (STOCKS[ticker].trend / 2)));
        const arrow = price >= prevPrice ? "🔼" : "🔽";

        text += `${arrow} *${ticker}* (${name}): $${priceFmt}\n`;
    }

    // 2. User Portfolio (With P/L Tracking)
    text += `\n💼 *Your Investments:*\n`;
    let hasStocks = false;
    let totalValue = 0;
    let totalInvested = 0;

    for (const [ticker, data] of Object.entries(user.portfolio.stocks)) {
        // MIGRATION: Convert legacy number to object
        let qty = 0;
        let avgParams_Buy = 0;

        if (typeof data === 'number') {
            // Legacy: Assume bought at CURRENT price to avoid instant P/L spikes
            qty = data;
            if (qty > 0) {
                user.portfolio.stocks[ticker] = {
                    quantity: qty,
                    average_buy_price: market[ticker],
                    total_invested: qty * market[ticker]
                };
                // Re-read
                qty = user.portfolio.stocks[ticker].quantity;
                avgParams_Buy = user.portfolio.stocks[ticker].average_buy_price;
            } else {
                delete user.portfolio.stocks[ticker];
                continue;
            }
        } else {
            qty = data.quantity;
            avgParams_Buy = data.average_buy_price;
        }

        if (qty > 0) {
            hasStocks = true;
            const currentPrice = market[ticker];
            const currentValue = qty * currentPrice;
            const invested = data.total_invested;

            // Calculate P/L
            const plValue = currentValue - invested;
            const plPercent = ((plValue / invested) * 100).toFixed(2);
            const plIcon = plValue >= 0 ? "📈" : "📉";
            const plSign = plValue >= 0 ? "+" : "";

            text += `- *${ticker}:* ${qty} shares\n`;
            text += `  Item Value: $${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
            text += `  Avg Buy: $${avgParams_Buy.toFixed(2)} | Curr: $${currentPrice.toFixed(2)}\n`;
            text += `  P/L: ${plIcon} ${plSign}$${plValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${plSign}${plPercent}%)\n`;

            totalValue += currentValue;
            totalInvested += invested;
        }
    }

    if (!hasStocks) {
        text += `_No active investments._\n`;
    } else {
        const totalPL = totalValue - totalInvested;
        const totalPLSign = totalPL >= 0 ? "+" : "";
        text += `\n💰 Total Equity: *$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`;
        text += `📊 Total P/L: *${totalPLSign}$${totalPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}*`;
    }

    text += `\n\n_Use .buystock <ticker> <shares>_\n_Use .sellstock <ticker> <shares>_`;

    await economy.saveDB(); // Save potential migrations
    await sock.sendMessage(from, { text }, { quoted: msg });
}

/* 
 * Buy Stock
 */
async function handleBuy(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: .buystock <ticker> <shares> [payment_crypto]\nExample: .buystock TECH 10\nExample: .buystock TECH 10 BTC" }, { quoted: msg });
    }

    const ticker = args[0].toUpperCase();
    const shares = utils.parseNumber(args[1]);

    if (!STOCKS[ticker]) {
        return sock.sendMessage(from, { text: "❌ Unknown ticker." }, { quoted: msg });
    }
    if (isNaN(shares) || shares <= 0) {
        return sock.sendMessage(from, { text: "❌ Invalid number of shares." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getStockPrices();
    const price = market[ticker];
    const cost = price * shares;

    // Check Payment Method (Crypto Check)
    const cryptoPayment = args[2] ? args[2].toUpperCase() : null;
    let cryptoMarket = {};

    // Dynamic import handling for crypto market prices to avoid top-level circular dependency issues if any
    // Although in ESM top level is fine if well structured, here we safely import locally or assume structure.
    // Ideally we import at top. Let's fix this properly. 
    // economy-stock doesn't depend on crypto except here.
    // We will use dynamic import for economy-crypto here.

    try {
        const cryptoModule = await import('./economy-crypto.js');
        if (cryptoModule.getMarketPrices) {
            cryptoMarket = cryptoModule.getMarketPrices();
        }
    } catch (e) {
        // Ignore if fails (module might not be converted yet in this atomic step, but it will be)
    }

    if (cryptoPayment) {
        if (!cryptoMarket[cryptoPayment]) {
            return sock.sendMessage(from, { text: `❌ Unknown crypto coin: ${cryptoPayment}` }, { quoted: msg });
        }

        // Crypto Transaction
        if (!user.portfolio?.crypto || !user.portfolio.crypto[cryptoPayment]) {
            return sock.sendMessage(from, { text: `❌ You don't own any ${cryptoPayment}.` }, { quoted: msg });
        }

        let cryptoHolding = user.portfolio.crypto[cryptoPayment];
        if (typeof cryptoHolding === 'number') {
            cryptoHolding = { quantity: cryptoHolding, average_buy_price: cryptoMarket[cryptoPayment], total_invested: cryptoHolding * cryptoMarket[cryptoPayment] };
        }

        const cryptoPrice = cryptoMarket[cryptoPayment];
        const cryptoNeeded = cost / cryptoPrice;

        if (cryptoHolding.quantity < cryptoNeeded) {
            return sock.sendMessage(from, { text: `❌ Insufficient ${cryptoPayment}!\nNeeded: ${cryptoNeeded.toFixed(6)}\nOwned: ${cryptoHolding.quantity.toFixed(6)}` }, { quoted: msg });
        }

        // Deduct Crypto
        cryptoHolding.quantity -= cryptoNeeded;
        cryptoHolding.total_invested -= (cryptoHolding.average_buy_price * cryptoNeeded);

        if (cryptoHolding.quantity <= 0.00000001) {
            delete user.portfolio.crypto[cryptoPayment];
        } else {
            user.portfolio.crypto[cryptoPayment] = cryptoHolding;
        }

    } else {
        // Fiat Transaction (Existing Logic)
        const hasBankCard = (user.inventory.debit_card || 0) > 0;
        const totalBalance = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

        if (cost > totalBalance) {
            return sock.sendMessage(from, { text: `❌ Insufficient funds!\nCost: $${cost.toLocaleString()}\nBalance: $${totalBalance.toLocaleString()}` }, { quoted: msg });
        }

        if (hasBankCard && user.financials.wallet < cost) {
            const remainder = cost - user.financials.wallet;
            user.financials.wallet = 0;
            user.financials.bank -= remainder;
        } else {
            user.financials.wallet -= cost;
        }
    }

    // Commission (2%)
    const fee = cost * 0.02;
    await economy.updateHouseBalance(fee);

    // Initialise Portfolio
    if (!user.portfolio) user.portfolio = { crypto: {}, stocks: {} };
    if (!user.portfolio.stocks) user.portfolio.stocks = {};

    // Get Existing Holding (Handle Migration)
    let currentHolding = user.portfolio.stocks[ticker];
    if (typeof currentHolding === 'number') {
        currentHolding = {
            quantity: currentHolding,
            average_buy_price: price,
            total_invested: currentHolding * price
        };
    } else if (!currentHolding) {
        currentHolding = { quantity: 0, average_buy_price: 0, total_invested: 0 };
    }

    // Update Average Buy Price
    const newTotalInvested = currentHolding.total_invested + cost;
    const newQuantity = currentHolding.quantity + shares;
    const newAverage = newTotalInvested / newQuantity;

    user.portfolio.stocks[ticker] = {
        quantity: newQuantity,
        average_buy_price: newAverage,
        total_invested: newTotalInvested
    };

    await economy.saveDB();

    const paymentText = cryptoPayment ? `Paid with: *${cryptoPayment}*` : `Cost: *$${cost.toLocaleString()}*`;

    await sock.sendMessage(from, {
        text: `✅ *SHARES ACQUIRED*\n\n` +
            `Bought: *${shares}x ${ticker}*\n` +
            `${paymentText}\n` +
            `New Avg Price: *$${newAverage.toFixed(2)}*`
    }, { quoted: msg });
}

/* 
 * Sell Stock
 */
async function handleSell(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: .sellstock <ticker> <shares>" }, { quoted: msg });
    }

    const ticker = args[0].toUpperCase();

    if (!STOCKS[ticker]) {
        return sock.sendMessage(from, { text: "❌ Unknown ticker." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getStockPrices();
    const price = market[ticker];

    if (!user.portfolio?.stocks || !user.portfolio.stocks[ticker]) {
        return sock.sendMessage(from, { text: `❌ You don't own any ${ticker} stocks.` }, { quoted: msg });
    }

    // Handle Migration/Type Check
    let holding = user.portfolio.stocks[ticker];
    if (typeof holding === 'number') {
        // Migration on Sell: Assume bought at CURRENT price (0 profit)
        holding = {
            quantity: holding,
            average_buy_price: price,
            total_invested: holding * price
        };
        user.portfolio.stocks[ticker] = holding;
    }

    let shares = 0;
    const currentOwned = holding.quantity;

    if (args[1].toLowerCase() === 'all') {
        shares = currentOwned;
    } else {
        shares = utils.parseNumber(args[1]);
    }

    if (isNaN(shares) || shares <= 0) {
        return sock.sendMessage(from, { text: "❌ Invalid share amount." }, { quoted: msg });
    }

    if (shares > currentOwned) {
        return sock.sendMessage(from, { text: `❌ You only own ${currentOwned} shares.` }, { quoted: msg });
    }

    const payout = shares * price;

    // Calculate Realized P/L for this sale
    const avgBuy = holding.average_buy_price;
    const investedPortion = shares * avgBuy;
    const realizedPL = payout - investedPortion;

    // Deduct
    holding.quantity -= shares;
    holding.total_invested -= investedPortion;

    if (holding.quantity <= 0) {
        delete user.portfolio.stocks[ticker];
    }

    // Update User Stats (Realized Gains)
    if (!user.stats.realized_gains) user.stats.realized_gains = 0;
    user.stats.realized_gains += realizedPL;

    // Pay User
    const hasBankCard = (user.inventory.debit_card || 0) > 0;
    if (hasBankCard) {
        user.financials.bank += payout;
        // Cap Check
        if (user.financials.bank > user.financials.bank_capacity) {
            const overflow = user.financials.bank - user.financials.bank_capacity;
            user.financials.bank = user.financials.bank_capacity;
            user.financials.wallet += overflow;
        }
    } else {
        user.financials.wallet += payout;
    }

    await economy.saveDB();

    const plSign = realizedPL >= 0 ? "+" : "";
    await sock.sendMessage(from, {
        text: `💵 *SHARES SOLD*\n\n` +
            `Sold: *${shares}x ${ticker}*\n` +
            `Payout: *$${payout.toLocaleString()}*\n` +
            `Realized P/L: *${plSign}$${realizedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}*`
    }, { quoted: msg });
}

export default {
    handleStock,
    handleBuy,
    handleSell,
    getStockPrices
};


