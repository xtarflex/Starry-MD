/* 
 * Economy Forex Module
 * Handles Foreign Exchange Market (Low Volatility)
 */

import economy from './economy.js';
import utils from '../core/utils.js';

// Base Rates (USD to X) - Reference rates
// Volatility is much lower than crypto (e.g., 2-5%)
const FOREX_PAIRS = {
    EUR: { name: "Euro", base: 1.08, volatility: 0.02 },       // 1 EUR = $1.08
    GBP: { name: "British Pound", base: 1.25, volatility: 0.03 }, // 1 GBP = $1.25
    JPY: { name: "Japanese Yen", base: 0.0065, volatility: 0.02 }, // 1 JPY = $0.0065
    CAD: { name: "Canadian Dollar", base: 0.73, volatility: 0.02 },
    AUD: { name: "Australian Dollar", base: 0.65, volatility: 0.025 },
    CNY: { name: "Chinese Yuan", base: 0.14, volatility: 0.015 },
    INR: { name: "Indian Rupee", base: 0.012, volatility: 0.015 },
    BRL: { name: "Brazilian Real", base: 0.20, volatility: 0.04 },
    RUB: { name: "Russian Ruble", base: 0.011, volatility: 0.05 },
    ZAR: { name: "South African Rand", base: 0.053, volatility: 0.04 }
};

/* 
 * Get Current Forex Rates
 * Updates every 1 hour
 */
export function getForexRates() {
    const timeBlock = Math.floor(Date.now() / 3600000); // 1 Hour blocks
    const rates = {};

    for (const [ticker, pair] of Object.entries(FOREX_PAIRS)) {
        const seed = timeBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const random = seededRandom(seed);

        // Very stable, small fluctuations
        const change = (random * 2 - 1) * pair.volatility;
        let rate = pair.base * (1 + change);

        if (rate < 0.000001) rate = 0.000001;

        rates[ticker] = rate;
    }
    return rates;
}

function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/* 
 * Display Forex Market
 */
async function handleForex(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);
    const rates = getForexRates();

    const now = Date.now();
    const timeBlock = Math.floor(now / 3600000);
    const nextUpdate = (timeBlock + 1) * 3600000;
    const timeLeft = Math.max(0, nextUpdate - now);
    const minutesLeft = Math.floor((timeLeft / 1000 / 60));

    let text = `💱 *GLOBAL F.X. MARKET*\n`;
    text += `_Next Update: ${minutesLeft}m (Interval: 1h)_\n\n`;

    // 1. Rates List
    text += `*📊 Exchange Rates (1 Unit -> USD):*\n`;
    for (const [ticker, rate] of Object.entries(rates)) {
        const name = FOREX_PAIRS[ticker].name;
        // Direction
        const prevBlock = Math.floor(Date.now() / 3600000) - 1;
        const seed = prevBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const prevRate = FOREX_PAIRS[ticker].base * (1 + ((seededRandom(seed) * 2 - 1) * FOREX_PAIRS[ticker].volatility));
        const arrow = rate >= prevRate ? "🔼" : "🔽";

        text += `${arrow} *${ticker}* (${name}): $${rate.toFixed(4)}\n`;
    }

    text += `\n_This module is for information purposes. To trade currencies, use the Global Bank (Coming Soon)._\n`;
    // Future expansion: Allow holding foreign currencies in wallet

    await sock.sendMessage(from, { text }, { quoted: msg });
}

/* 
 * Exchange Currency (USD to Foreign or Vice Versa) -> Placeholder for now
 * Currently just a converter calculator
 */
async function handleExchange(msg, sock, botState, args) {
    const from = msg.key.remoteJid;

    if (args.length < 3) {
        return sock.sendMessage(from, { text: "❌ Usage: .exchange <amount> <FROM> <TO>\nSupported: USD, EUR, GBP, JPY, etc." }, { quoted: msg });
    }

    const amount = utils.parseNumber(args[0]);
    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, { text: "❌ Invalid amount." }, { quoted: msg });
    }

    const fromCurr = args[1].toUpperCase();
    const toCurr = args[2].toUpperCase();

    const rates = getForexRates();
    // Add USD base
    rates['USD'] = 1.0;

    if (!rates[fromCurr] || !rates[toCurr]) {
        return sock.sendMessage(from, { text: "❌ Unknown currency." }, { quoted: msg });
    }

    // Convert
    // 1. Convert FROM to USD
    const rateInUSD = rates[fromCurr]; // This rate implies 1 Unit = $X.  So Amount * Rate = USD.
    const valInUSD = amount * rateInUSD;

    // 2. Convert USD to TO
    const rateOutUSD = rates[toCurr]; // 1 Unit = $Y.  So USD / Rate = Units.
    const valOut = valInUSD / rateOutUSD;

    await sock.sendMessage(from, {
        text: `💱 *CURRENCY CONVERTER*\n\n` +
            `Input: *${amount.toLocaleString()} ${fromCurr}*\n` +
            `Output: *${valOut.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${toCurr}*\n` +
            `Rate: 1 ${fromCurr} = ${(rateInUSD / rateOutUSD).toFixed(4)} ${toCurr}`
    }, { quoted: msg });
}

export default {
    handleForex,
    handleExchange,
    getForexRates
};

// Volatility is much lower than crypto (e.g., 2-5%)

