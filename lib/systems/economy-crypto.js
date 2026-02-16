/* 
 * Economy Crypto Module
 * Handles Cryptocurrency Market (High Volatility)
 */

const economy = require('./economy');
const utils = require('../core/utils');

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

/* 
 * Get Current Market Prices
 * Prices update every 5 minutes
 */
/* 
 * Get Current Market Prices
 * Prices update every 5 minutes
 */
function getMarketPrices(timestamp = Date.now()) {
    const timeBlock = Math.floor(timestamp / 300000); // 5 min blocks
    const prices = {};

    for (const [ticker, coin] of Object.entries(CRYPTO_COINS)) {
        // Pseudo-random generator based on time + ticker
        // This ensures all users see the same price at the same time
        const seed = timeBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const random = seededRandom(seed);

        // Fluctuation: -volatility to +volatility
        const change = (random * 2 - 1) * coin.volatility;
        let price = coin.base * (1 + change);

        // Prevent negative or zero prices
        if (price < 0.00000001) price = 0.00000001;

        prices[ticker] = price;
    }
    return prices;
}

// Simple seeded random function
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/* 
 * Display Crypto Market & Portfolio
 */
async function handleCrypto(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);
    const now = Date.now();
    const market = getMarketPrices(now);
    const prevMarket = getMarketPrices(now - 300000); // 5 mins ago

    // Timer Logic
    const timeBlock = Math.floor(now / 300000);
    const nextUpdate = (timeBlock + 1) * 300000;
    const timeLeft = Math.max(0, nextUpdate - now);
    const secondsLeft = Math.floor((timeLeft / 1000) % 60);
    const minutesLeft = Math.floor((timeLeft / 1000 / 60));

    // Ensure portfolio exists
    if (!user.portfolio) user.portfolio = { crypto: {}, stocks: {} };
    if (!user.portfolio.crypto) user.portfolio.crypto = {};

    let text = `🪙 *CRYPTO MARKET*\n`;
    text += `_Next Update: ${minutesLeft}m ${secondsLeft}s_\n\n`;

    // 1. Market List
    text += `*📈 Market Prices (5m Change):*\n`;
    for (const [ticker, price] of Object.entries(market)) {
        let formattedPrice = price < 1 ? price.toFixed(4) : price.toLocaleString(undefined, { maximumFractionDigits: 2 });

        // Calculate Change
        const prevPrice = prevMarket[ticker];
        const change = price - prevPrice;
        const changePercent = (change / prevPrice) * 100;
        const sign = change >= 0 ? "+" : "";
        const indicator = change >= 0 ? "🟢" : "🔴";

        text += `${indicator} *${ticker}:* $${formattedPrice} (${sign}${changePercent.toFixed(2)}%)\n`;
    }

    // 2. User Portfolio
    text += `\n💼 *Your Portfolio:*\n`;
    let hasCrypto = false;
    let portfolioValue = 0;
    let portfolioInvested = 0;

    for (const [ticker, data] of Object.entries(user.portfolio.crypto)) {
        // MIGRATION: Convert legacy number to object
        let qty = 0;
        let avgBuy = 0;

        if (typeof data === 'number') {
            // Legacy: Migrate
            qty = data;
            if (qty > 0) {
                user.portfolio.crypto[ticker] = {
                    quantity: qty,
                    average_buy_price: market[ticker], // Assume bought now
                    total_invested: qty * market[ticker]
                };
                qty = user.portfolio.crypto[ticker].quantity;
                avgBuy = user.portfolio.crypto[ticker].average_buy_price;
            } else {
                delete user.portfolio.crypto[ticker];
                continue;
            }
        } else {
            qty = data.quantity;
            avgBuy = data.average_buy_price;
        }

        if (qty > 0) {
            hasCrypto = true;
            const currentPrice = market[ticker];
            const value = qty * currentPrice;
            const invested = data.total_invested;

            // P/L Calc
            const plValue = value - invested;
            const plPercent = invested > 0 ? ((plValue / invested) * 100).toFixed(2) : "0.00";
            const plIcon = plValue >= 0 ? "📈" : "📉";
            const plSign = plValue >= 0 ? "+" : "";

            const valFormatted = value < 1 ? value.toFixed(4) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
            const amountFormatted = qty < 0.01 ? qty.toFixed(6) : qty.toFixed(4);

            text += `- *${ticker}:* ${amountFormatted} ($${valFormatted})\n`;
            text += `  Avg Buy: $${avgBuy < 1 ? avgBuy.toFixed(4) : avgBuy.toFixed(2)}\n`;
            text += `  P/L: ${plIcon} ${plSign}$${plValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${plSign}${plPercent}%)\n`;

            portfolioValue += value;
            portfolioInvested += invested;
        }
    }

    if (!hasCrypto) {
        text += `_You maintain a fiat-only existence._\n`;
    } else {
        const totalPL = portfolioValue - portfolioInvested;
        const totalPLSign = totalPL >= 0 ? "+" : "";
        text += `\n💰 Total Algo-Assets: *$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`;
        text += `📊 Total P/L: *${totalPLSign}$${totalPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}*`;
    }

    text += `\n\n_Use .buycrypto <coin> <amount/all>_\n_Use .sellcrypto <coin> <amount/all>_`;

    await economy.saveDB(); // Save migrations
    await sock.sendMessage(from, { text }, { quoted: msg });
}

/* 
 * Buy Crypto
 */
async function handleBuy(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: .buycrypto <ticker> <amount/$amount>\nExample: .buycrypto BTC 0.5\nExample: .buycrypto DOGE $1000" }, { quoted: msg });
    }

    const ticker = args[0].toUpperCase();
    let amountArg = args[1];

    if (!CRYPTO_COINS[ticker]) {
        return sock.sendMessage(from, { text: "❌ Unknown coin. Check .crypto for list." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getMarketPrices();
    const price = market[ticker];

    // Ensure portfolio exists
    if (!user.portfolio) user.portfolio = { crypto: {}, stocks: {} };
    if (!user.portfolio.crypto) user.portfolio.crypto = {};

    let coinAmount = 0;
    let cost = 0;

    // Check payment method (Wallet + Bank via Card)
    const hasBankCard = (user.inventory.debit_card || 0) > 0;
    const totalBalance = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

    // Handle "all"
    if (amountArg.toLowerCase() === 'all') {
        if (totalBalance <= 0) return sock.sendMessage(from, { text: "❌ You have no money!" }, { quoted: msg });
        cost = totalBalance;
        coinAmount = cost / price;
    }
    // Handle Dollar amount purchase (e.g. $100)
    else if (amountArg.startsWith('$')) {
        cost = utils.parseNumber(amountArg.substring(1));
        if (isNaN(cost) || cost <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
        coinAmount = cost / price;
    }
    // Handle Coin amount purchase (e.g. 0.5 BTC)
    else {
        coinAmount = utils.parseNumber(amountArg);
        if (isNaN(coinAmount) || coinAmount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
        cost = coinAmount * price;
    }

    // Affordability Check
    if (cost > totalBalance) {
        return sock.sendMessage(from, { text: `❌ You can't afford this!\nCost: $${cost.toLocaleString()}\nBalance: $${totalBalance.toLocaleString()}` }, { quoted: msg });
    }

    // Execute Transaction
    if (hasBankCard && user.financials.wallet < cost) {
        const remainder = cost - user.financials.wallet;
        user.financials.wallet = 0;
        user.financials.bank -= remainder;
    } else {
        user.financials.wallet -= cost;
    }

    // HOUSE TAX (1%)
    const fee = cost * 0.01;
    await economy.updateHouseBalance(fee);

    // Get Existing Holding (Migration Check)
    let currentHolding = user.portfolio.crypto[ticker];
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
    const newQuantity = currentHolding.quantity + coinAmount;
    const newAverage = newTotalInvested / newQuantity;

    user.portfolio.crypto[ticker] = {
        quantity: newQuantity,
        average_buy_price: newAverage,
        total_invested: newTotalInvested
    };

    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `✅ *CRYPTO PURCHASED*\n\n` +
            `Bought: *${coinAmount.toFixed(6)} ${ticker}*\n` +
            `Cost: *$${cost.toLocaleString()}*\n` +
            `Avg Price: $${newAverage < 1 ? newAverage.toFixed(4) : newAverage.toFixed(2)}`
    }, { quoted: msg });
}

/* 
 * Sell Crypto
 */
async function handleSell(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: .sellcrypto <ticker> <amount/all>" }, { quoted: msg });
    }

    const ticker = args[0].toUpperCase();
    let amountArg = args[1];

    if (!CRYPTO_COINS[ticker]) {
        return sock.sendMessage(from, { text: "❌ Unknown coin." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getMarketPrices();
    const price = market[ticker];

    // Portfolio Check
    if (!user.portfolio?.crypto || !user.portfolio.crypto[ticker]) {
        return sock.sendMessage(from, { text: `❌ You don't own any ${ticker}.` }, { quoted: msg });
    }

    // Migration Check
    let holding = user.portfolio.crypto[ticker];
    if (typeof holding === 'number') {
        holding = {
            quantity: holding,
            average_buy_price: price,
            total_invested: holding * price
        };
        user.portfolio.crypto[ticker] = holding;
    }

    if (holding.quantity <= 0) {
        return sock.sendMessage(from, { text: `❌ You don't own any ${ticker}.` }, { quoted: msg });
    }

    let coinAmount = 0;
    const currentOwned = holding.quantity;

    if (amountArg.toLowerCase() === 'all') {
        coinAmount = currentOwned;
    } else {
        coinAmount = utils.parseNumber(amountArg);
        if (isNaN(coinAmount) || coinAmount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
    }

    if (coinAmount > currentOwned) {
        return sock.sendMessage(from, { text: `❌ You only have ${currentOwned.toFixed(6)} ${ticker}.` }, { quoted: msg });
    }

    // Calculate Value
    let payout = coinAmount * price;

    // Calculate Realized P/L
    const avgBuy = holding.average_buy_price;
    const investedPortion = coinAmount * avgBuy;
    const realizedPL = payout - investedPortion;

    // Deduct Crypto
    holding.quantity -= coinAmount;
    holding.total_invested -= investedPortion;

    if (holding.quantity < 0.00000001) {
        delete user.portfolio.crypto[ticker]; // Cleanup dust
    }

    // Update Realized Gains
    if (!user.stats.realized_gains) user.stats.realized_gains = 0;
    user.stats.realized_gains += realizedPL;

    // Pay User (Prefer Bank if Card possessed)
    const hasBankCard = (user.inventory.debit_card || 0) > 0;
    if (hasBankCard) {
        user.financials.bank += payout;
        // Bank Cap Check?
        if (user.financials.bank > user.financials.bank_capacity) {
            const overflow = user.financials.bank - user.financials.bank_capacity;
            user.financials.bank = user.financials.bank_capacity;
            user.financials.wallet += overflow; // Dump overflow to wallet
        }
    } else {
        user.financials.wallet += payout;
    }

    await economy.saveDB();

    const dest = hasBankCard ? "Bank" : "Wallet";
    const plSign = realizedPL >= 0 ? "+" : "";

    await sock.sendMessage(from, {
        text: `💵 *CRYPTO SOLD*\n\n` +
            `Sold: *${coinAmount.toFixed(6)} ${ticker}*\n` +
            `Payout: *$${payout.toLocaleString()}*\n` +
            `Realized P/L: *${plSign}$${realizedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n` +
            `Deposited to: ${dest}`
    }, { quoted: msg });
}

/* 
 * Convert Crypto (.convert)
 */
async function handleConvert(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 3) {
        return sock.sendMessage(from, { text: "❌ Usage: .convert <amount> <FROM_COIN> <TO_COIN>\nExample: .convert 0.1 BTC ETH" }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getMarketPrices();

    const fromTicker = args[1].toUpperCase();
    const toTicker = args[2].toUpperCase();

    if (!CRYPTO_COINS[fromTicker] || !CRYPTO_COINS[toTicker]) {
        return sock.sendMessage(from, { text: "❌ Unknown coin(s)." }, { quoted: msg });
    }
    if (fromTicker === toTicker) {
        return sock.sendMessage(from, { text: "🤡 You can't convert to the same coin!" }, { quoted: msg });
    }

    // Check Balance Logic
    if (!user.portfolio?.crypto || !user.portfolio.crypto[fromTicker]) {
        return sock.sendMessage(from, { text: `❌ You don't own any ${fromTicker}.` }, { quoted: msg });
    }

    let sourceHolding = user.portfolio.crypto[fromTicker];
    // Migration check
    if (typeof sourceHolding === 'number') {
        sourceHolding = { quantity: sourceHolding, average_buy_price: market[fromTicker], total_invested: sourceHolding * market[fromTicker] };
    }

    // Determine Amount
    let amount;
    if (args[0].toLowerCase() === 'all') {
        amount = sourceHolding.quantity;
    } else {
        amount = utils.parseNumber(args[0]);
    }

    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
    }

    if (sourceHolding.quantity < amount) {
        return sock.sendMessage(from, { text: `❌ Insufficient balance! Owned: ${sourceHolding.quantity}` }, { quoted: msg });
    }

    // Exchange Logic
    const priceFrom = market[fromTicker];
    const priceTo = market[toTicker];

    // Value in USD
    const valueUSD = amount * priceFrom;

    // Tax (1% conversion fee)
    const fee = valueUSD * 0.01;
    const netValue = valueUSD - fee;
    await economy.updateHouseBalance(fee);

    // Target Coin Amount
    const amountReceived = netValue / priceTo;

    // Deduct Source
    sourceHolding.quantity -= amount;
    sourceHolding.total_invested -= (sourceHolding.average_buy_price * amount); // Reduce cost basis proportionally

    if (sourceHolding.quantity <= 0.00000001) {
        delete user.portfolio.crypto[fromTicker];
    } else {
        user.portfolio.crypto[fromTicker] = sourceHolding;
    }

    // Add Target
    let targetHolding = user.portfolio.crypto[toTicker];
    if (typeof targetHolding === 'number') {
        targetHolding = { quantity: targetHolding, average_buy_price: priceTo, total_invested: targetHolding * priceTo };
    } else if (!targetHolding) {
        targetHolding = { quantity: 0, average_buy_price: 0, total_invested: 0 };
    }

    // Update Target Stats (Weighted Average)
    // New Basis = Old Invested + Net Value of Conversion
    // Net Value is the COST BASIS for the new coins
    targetHolding.total_invested += netValue;
    targetHolding.quantity += amountReceived;
    targetHolding.average_buy_price = targetHolding.total_invested / targetHolding.quantity;

    user.portfolio.crypto[toTicker] = targetHolding;

    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `🔄 *CONVERSION SUCCESSFUL*\n\n` +
            `Exchanged: *${amount} ${fromTicker}*\n` +
            `Received: *${amountReceived.toFixed(6)} ${toTicker}*\n` +
            `Fee: *$${fee.toFixed(2)}* (1%)\n` +
            `Rate: 1 ${fromTicker} ≈ ${(priceFrom / priceTo).toFixed(4)} ${toTicker}`
    }, { quoted: msg });
}

module.exports = {
    handleCrypto,
    handleBuy,
    handleSell,
    handleConvert,
    getMarketPrices
};
