/* 
 * Economy Forex Module
 * Handles Foreign Exchange Market (Low Volatility)
 */

const economy = require('./economy');
const utils = require('./utils');

// Base Rates (USD to X) - Reference rates
// Volatility is much lower than crypto (e.g., 2-5%)
const FOREX_PAIRS = {
    EUR: { name: "Euro", base: 1.08, volatility: 0.02 },       // 1 EUR = $1.08
    GBP: { name: "British Pound", base: 1.25, volatility: 0.03 }, // 1 GBP = $1.25
    JPY: { name: "Japanese Yen", base: 0.0065, volatility: 0.02 }, // 1 JPY = $0.0065
    CHF: { name: "Swiss Franc", base: 1.10, volatility: 0.015 },  // 1 CHF = $1.10
    AUD: { name: "Australian Dollar", base: 0.65, volatility: 0.04 }, // 1 AUD = $0.65
    CAD: { name: "Canadian Dollar", base: 0.73, volatility: 0.03 }   // 1 CAD = $0.73
};

/* 
 * Get Current Forex Rates
 * Prices update every 5 minutes
 */
function getForexRates(timestamp = Date.now()) {
    const timeBlock = Math.floor(timestamp / 300000); // 5 min blocks
    const rates = {};

    for (const [ticker, currency] of Object.entries(FOREX_PAIRS)) {
        // Deterministic seed
        const seed = timeBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const random = seededRandom(seed);

        // Fluctuation: -volatility to +volatility
        const change = (random * 2 - 1) * currency.volatility;
        let rate = currency.base * (1 + change);

        // Prevent negative rates (Physics check)
        if (rate < 0.00000001) rate = 0.00000001;

        rates[ticker] = rate;
    }
    return rates;
}

// Simple seeded random function (Same as crypto for consistency)
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/* 
 * Display Forex Market & Portfolio
 */
async function handleForex(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);
    const now = Date.now();
    const market = getForexRates(now);
    const prevMarket = getForexRates(now - 300000); // 5 mins ago

    // Timer Logic
    const timeBlock = Math.floor(now / 300000);
    const nextUpdate = (timeBlock + 1) * 300000;
    const timeLeft = Math.max(0, nextUpdate - now);
    const secondsLeft = Math.floor((timeLeft / 1000) % 60);
    const minutesLeft = Math.floor((timeLeft / 1000 / 60));

    // Ensure portfolio exists
    if (!user.portfolio) user.portfolio = { crypto: {}, forex: {}, stocks: {} };
    if (!user.portfolio.forex) user.portfolio.forex = {};

    let text = `💱 *FOREX MARKET*\n`;
    text += `_Next Update: ${minutesLeft}m ${secondsLeft}s_\n\n`;

    // 1. Market List
    text += `*📈 Currency Rates (USD base):*\n`;
    for (const [ticker, rate] of Object.entries(market)) {
        let formattedRate = rate < 0.01 ? rate.toFixed(6) : rate.toFixed(4);

        // Calculate Change
        const prevRate = prevMarket[ticker];
        const change = rate - prevRate;
        const changePercent = (change / prevRate) * 100;
        const sign = change >= 0 ? "+" : "";
        const indicator = change >= 0 ? "🟢" : "🔴";

        text += `${indicator} *${ticker}:* $${formattedRate} (${sign}${changePercent.toFixed(2)}%)\n`;
    }

    // 2. User Portfolio
    text += `\n💼 *Your Money Bin:*\n`;
    let hasForex = false;
    let portfolioValue = 0;
    let portfolioInvested = 0;

    for (const [ticker, data] of Object.entries(user.portfolio.forex)) {
        // Data structure: { quantity, average_buy_price, total_invested }
        const qty = data.quantity;
        if (qty > 0) {
            hasForex = true;
            const currentRate = market[ticker];
            const value = qty * currentRate;
            const invested = data.total_invested;
            const avgBuy = data.average_buy_price;

            // P/L Calc
            const plValue = value - invested;
            const plPercent = invested > 0 ? ((plValue / invested) * 100).toFixed(2) : "0.00";
            const plIcon = plValue >= 0 ? "📈" : "📉";
            const plSign = plValue >= 0 ? "+" : "";

            const valFormatted = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
            const amountFormatted = qty.toLocaleString(undefined, { maximumFractionDigits: 2 });

            text += `- *${ticker}:* ${amountFormatted} ($${valFormatted})\n`;
            text += `  Avg Buy: $${avgBuy.toFixed(4)}\n`;
            text += `  P/L: ${plIcon} ${plSign}$${plValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${plSign}${plPercent}%)\n`;

            portfolioValue += value;
            portfolioInvested += invested;
        }
    }

    if (!hasForex) {
        text += `_You only hold logical Dollars._\n`;
    } else {
        const totalPL = portfolioValue - portfolioInvested;
        const totalPLSign = totalPL >= 0 ? "+" : "";
        text += `\n💰 Total Forex Assets: *$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`;
        text += `📊 Total P/L: *${totalPLSign}$${totalPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}*`;
    }

    text += `\n\n_Use .buyfx <currency> <amount/all>_\n_Use .sellfx <currency> <amount/all>_`;

    await sock.sendMessage(from, { text }, { quoted: msg });
}

/* 
 * Buy Forex
 */
async function handleBuy(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: .buyfx <currency> <amount/$amount>\nExample: .buyfx EUR 100\nExample: .buyfx GBP $1000" }, { quoted: msg });
    }

    const ticker = args[0].toUpperCase();
    let amountArg = args[1];

    if (!FOREX_PAIRS[ticker]) {
        return sock.sendMessage(from, { text: "❌ Unknown currency. Check .forex for list." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getForexRates();
    const rate = market[ticker];

    // Ensure portfolio exists
    if (!user.portfolio) user.portfolio = { crypto: {}, forex: {}, stocks: {} };
    if (!user.portfolio.forex) user.portfolio.forex = {};

    let currencyAmount = 0;
    let cost = 0;

    const totalBalance = user.financials.wallet; // Forex usually cash only? Let's allow wallet only for simplicity or match crypto logic

    // Handle "all"
    if (amountArg.toLowerCase() === 'all') {
        if (totalBalance <= 0) return sock.sendMessage(from, { text: "❌ You have no money!" }, { quoted: msg });
        cost = totalBalance;
        currencyAmount = cost / rate;
    }
    // Handle Dollar amount purchase (e.g. $100)
    else if (amountArg.startsWith('$')) {
        cost = utils.parseNumber(amountArg.substring(1));
        if (isNaN(cost) || cost <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
        currencyAmount = cost / rate;
    }
    // Handle Currency amount purchase (e.g. 100 EUR)
    else {
        currencyAmount = utils.parseNumber(amountArg);
        if (isNaN(currencyAmount) || currencyAmount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
        cost = currencyAmount * rate;
    }

    // Affordability Check
    if (cost > totalBalance) {
        return sock.sendMessage(from, { text: `❌ You can't afford this!\nCost: $${cost.toLocaleString()}\nWallet: $${totalBalance.toLocaleString()}` }, { quoted: msg });
    }

    // Execute Transaction
    user.financials.wallet -= cost;

    // Exchange Fee (0.5% - lower than crypto)
    const fee = cost * 0.005;
    await economy.updateHouseBalance(fee);

    // Get Existing Holding
    let currentHolding = user.portfolio.forex[ticker];
    if (!currentHolding) {
        currentHolding = { quantity: 0, average_buy_price: 0, total_invested: 0 };
    }

    // Update Average Buy Price
    const newTotalInvested = currentHolding.total_invested + cost;
    const newQuantity = currentHolding.quantity + currencyAmount;
    const newAverage = newTotalInvested / newQuantity;

    user.portfolio.forex[ticker] = {
        quantity: newQuantity,
        average_buy_price: newAverage,
        total_invested: newTotalInvested
    };

    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `✅ *FOREX PURCHASED*\n\n` +
            `Bought: *${currencyAmount.toFixed(2)} ${ticker}*\n` +
            `Cost: *$${cost.toLocaleString()}*\n` +
            `Rate: $${rate.toFixed(4)}\n` +
            `Fee: $${fee.toFixed(2)}`
    }, { quoted: msg });
}

/* 
 * Sell Forex
 */
async function handleSell(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: .sellfx <currency> <amount/all>" }, { quoted: msg });
    }

    const ticker = args[0].toUpperCase();
    let amountArg = args[1];

    if (!FOREX_PAIRS[ticker]) {
        return sock.sendMessage(from, { text: "❌ Unknown currency." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const market = getForexRates();
    const rate = market[ticker];

    // Portfolio Check
    if (!user.portfolio?.forex || !user.portfolio.forex[ticker]) {
        return sock.sendMessage(from, { text: `❌ You don't own any ${ticker}.` }, { quoted: msg });
    }

    let holding = user.portfolio.forex[ticker];
    if (holding.quantity <= 0) {
        return sock.sendMessage(from, { text: `❌ You don't own any ${ticker}.` }, { quoted: msg });
    }

    let currencyAmount = 0;
    const currentOwned = holding.quantity;

    if (amountArg.toLowerCase() === 'all') {
        currencyAmount = currentOwned;
    } else {
        currencyAmount = utils.parseNumber(amountArg);
        if (isNaN(currencyAmount) || currencyAmount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
    }

    if (currencyAmount > currentOwned) {
        return sock.sendMessage(from, { text: `❌ You only have ${currentOwned.toFixed(2)} ${ticker}.` }, { quoted: msg });
    }

    // Calculate Value
    let payout = currencyAmount * rate;

    // Calculate Realized P/L
    const avgBuy = holding.average_buy_price;
    const investedPortion = currencyAmount * avgBuy;
    const realizedPL = payout - investedPortion;

    // Deduct Asset
    holding.quantity -= currencyAmount;
    holding.total_invested -= investedPortion;

    if (holding.quantity < 0.01) {
        delete user.portfolio.forex[ticker]; // Cleanup
    }

    // Update Realized Gains
    if (!user.stats.realized_gains) user.stats.realized_gains = 0;
    user.stats.realized_gains += realizedPL;

    // Credit Wallet
    user.financials.wallet += payout;

    await economy.saveDB();

    const plSign = realizedPL >= 0 ? "+" : "";

    await sock.sendMessage(from, {
        text: `💵 *FOREX SOLD*\n\n` +
            `Sold: *${currencyAmount.toFixed(2)} ${ticker}*\n` +
            `Payout: *$${payout.toLocaleString()}*\n` +
            `Realized P/L: *${plSign}$${realizedPL.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n` +
            `Deposited to: Wallet`
    }, { quoted: msg });
}

module.exports = {
    handleForex,
    handleBuy,
    handleSell,
    getForexRates
};
