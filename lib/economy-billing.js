/* 
 * Billing & Maintenance Module
 * Processes accumulated interest and property upkeep.
 */

const economy = require('./economy');
const assets = require('./economy-assets');

/* 
 * Process all outstanding financial obligations (Interest, Upkeep).
 * Should be called whenever a user interacts with the RPG.
 */
async function processBilling(jid) {
    const user = await economy.getUserProfile(jid);
    const now = Date.now();
    const lastBilling = user.stats.last_billing || now;

    // Billing Cycle: Weekly (7 days)
    const BILLING_PERIOD = 7 * 24 * 60 * 60 * 1000;
    const elapsed = now - lastBilling;

    if (elapsed < BILLING_PERIOD) return null; // Too early

    const cycles = Math.floor(elapsed / BILLING_PERIOD);
    if (cycles <= 0) return null;

    let totalDeduction = 0;
    let interestAdded = 0;

    // 1. Property Upkeep
    const propId = user.assets.property || "prop_box";
    const prop = assets.PROPERTIES[propId];
    const upkeep = (prop.upkeep || 0) * cycles;
    totalDeduction += upkeep;

    // 2. Loan Interest (10% per cycle on existing debt)
    if (user.financials.debt > 0) {
        interestAdded = Math.floor(user.financials.debt * 0.1 * cycles);
        user.financials.debt += interestAdded;
    }

    // Attempt to pay upkeep from Wallet/Bank
    const paymentSuccess = await economy.makePayment(jid, totalDeduction);

    // Update billing timestamp
    user.stats.last_billing = now - (elapsed % BILLING_PERIOD);
    await economy.saveDB();

    return {
        cycles,
        upkeep,
        interestAdded,
        paymentSuccess,
        totalDeduction
    };
}

module.exports = {
    processBilling
};
