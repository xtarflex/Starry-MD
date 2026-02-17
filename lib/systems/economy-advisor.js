import { getUserProfile, updateHouseBalance, saveDB } from './economy';
import { getStockPrices } from './economy-stock';
import { getMarketPrices } from './economy-crypto';
import { generateContent } from '../services/ai';
import { log } from '../core/utils';
import config from '../../config';

/* 
 * 🧠 STARRY FINANCIAL ADVISOR (Paid AI Service)
 * Uses AI to analyze REAL market data (stocks/crypto) and give advice.
 * Cost: $5,000 per consultation.
 */

const ADVISOR_COST = 5000;

async function handleAdvisor(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    // 1. Payment Check
    const user = await getUserProfile(sender, pushName);
    const hasBankCard = (user.inventory.debit_card || 0) > 0;
    const totalBalance = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

    if (totalBalance < ADVISOR_COST) {
        return sock.sendMessage(from, {
            text: `🚫 *INSUFFICIENT FUNDS*\n\nThe Starry Financial Advisor charges *$${ADVISOR_COST.toLocaleString()}* per session.\n\nYour Balance: $${totalBalance.toLocaleString()}`
        }, { quoted: msg });
    }

    // 2. Initial Response (Loading)
    await sock.sendMessage(from, { react: { text: "💼", key: msg.key } });
    const { key } = await sock.sendMessage(from, { text: `💼 *Consulting Financial AI...*\n\n_Analyzing Market Trends..._` }, { quoted: msg });

    // 3. Gather Market Data (Real Context)
    let marketContext = "MARKET DATA:\n\n";

    // Stocks
    const stocks = getStockPrices();
    marketContext += "STOCKS:\n";
    for (const [ticker, price] of Object.entries(stocks)) {
        marketContext += `- ${ticker}: $${price.toFixed(2)}\n`;
    }

    // Crypto
    // Try to get crypto prices safely
    try {
        const cryptoPrices = getMarketPrices ? getMarketPrices() : {};
        if (Object.keys(cryptoPrices).length > 0) {
            marketContext += "\nCRYPTO:\n";
            for (const [coin, price] of Object.entries(cryptoPrices)) {
                marketContext += `- ${coin}: $${price.toFixed(2)}\n`;
            }
        }
    } catch (e) { }

    // User Portfolio Context
    let userContext = "\nUSER PORTFOLIO:\n";
    if (user.portfolio?.stocks) {
        userContext += "Stocks Owned: " + Object.keys(user.portfolio.stocks).join(", ") + "\n";
    }
    if (user.portfolio?.crypto) {
        userContext += "Crypto Owned: " + Object.keys(user.portfolio.crypto).join(", ") + "\n";
    }

    // 4. Build Prompt
    const query = args.join(" ") || "General market advice";
    const prompt = `
You are a High-Level Financial Advisor in the Starry Multiverse RPG.
Your job is to analyze the provided MARKET DATA and give the user advice.

CONTEXT:
${marketContext}
${userContext}

USER REQUEST: "${query}"

INSTRUCTIONS:
1. Be professional.
2. Analyze the specific prices provided.
3. Suggest a specific BUY or SELL strategy based on the data.
4. Keep it concise (bullet points).
5. Remind them that the market is volatile.
`;

    try {
        // 5. Deduct Fee
        if (hasBankCard && user.financials.wallet < ADVISOR_COST) {
            const remainder = ADVISOR_COST - user.financials.wallet;
            user.financials.wallet = 0;
            user.financials.bank -= remainder;
        } else {
            user.financials.wallet -= ADVISOR_COST;
        }
        await updateHouseBalance(ADVISOR_COST);
        await saveDB();

        // 6. Call AI
        const advice = await generateContent(prompt, "tech", [], sock, from, pushName);

        // 7. Send Result
        const finalMsg = `💼 *FINANCIAL ADVISOR REPORT*\n\n${advice}\n\n──────────────\n💸 *Fee:* $${ADVISOR_COST.toLocaleString()} (Deducted)`;

        await sock.sendMessage(from, { text: finalMsg, edit: key });
        log("ECONOMY", `Advisor consulted by ${pushName} (-$${ADVISOR_COST})`);

    } catch (error) {
        log("ERROR", `Advisor failed: ${error.message}`);
        await sock.sendMessage(from, { text: "❌ Connection to Advisor AI Lost. Fee refunded.", edit: key });
        // Refund logic would be good here strictly speaking, but for simplicity assuming atomic fail before save or manual refund.
        // Actually we saved BEFORE AI call. Let's refund.
        user.financials.wallet += ADVISOR_COST;
        await saveDB();
    }
}

export default { handleAdvisor };
