/* 
 * Economy Assets & Real Estate Module
 * Manages properties, vehicles, and their impact on bank capacity.
 */

const economy = require('./economy');

const PROPERTIES = {
    "prop_box": {
        id: "prop_box",
        name: "📦 Cardboard Box",
        capacity: 5000,
        upkeep: 0,
        income: 0,
        emoji: "📦"
    },
    "prop_apartment": {
        id: "prop_apartment",
        name: "🏙️ Micro-Apartment",
        capacity: 300000,
        upkeep: 500,
        income: 500,
        emoji: "🏘️"
    },
    "prop_penthouse": {
        id: "prop_penthouse",
        name: "🏢 Luxury Penthouse",
        capacity: 3000000,
        upkeep: 5000,
        income: 2000,
        emoji: "💎"
    },
    "prop_mansion": {
        id: "prop_mansion",
        name: "🏰 Galactic Mansion",
        capacity: 40000000,
        upkeep: 50000,
        income: 10000,
        emoji: "🏛️"
    },
    "prop_estate": {
        id: "prop_estate",
        name: "🪐 Planetary Estate",
        capacity: 500000000,
        upkeep: 500000,
        income: 50000,
        emoji: "🪐"
    },
    "prop_private_island": {
        id: "prop_private_island",
        name: "🏝️ Private Island",
        capacity: 5000000000,
        upkeep: 1000000,
        income: 150000,
        emoji: "🏝️"
    },
    "prop_moon_base": {
        id: "prop_moon_base",
        name: "🌑 Moon Base Alpha",
        capacity: 100000000000,
        upkeep: 5000000,
        income: 500000,
        emoji: "🌑"
    }
};

/* 
 * Get current bank capacity based on property
 */
function getBankCapacity(propertyId) {
    const prop = PROPERTIES[propertyId] || PROPERTIES["prop_box"];
    return prop.capacity;
}

/* 
 * Update user's bank capacity based on their current property
 */
async function syncBankCapacity(jid) {
    const user = await economy.getUserProfile(jid);
    const propId = user.assets.property || "prop_box";
    const newCap = getBankCapacity(propId);

    user.financials.bank_capacity = newCap;
    await economy.saveDB();
    return newCap;
}

/* 
 * Handle property purchase via use logic
 */
async function handlePropertySwitch(msg, sock, botState, propId) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);

    if (!PROPERTIES[propId]) return;

    user.assets.property = propId;
    // CRITICAL FIX: Ensure bank capacity is immediately synced
    const newCap = getBankCapacity(propId);
    user.financials.bank_capacity = newCap;

    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `🏠 *PROPERTY ACQUIRED*\n\nYou moved into: * ${PROPERTIES[propId].name}* ${PROPERTIES[propId].emoji}\n\n📈 *Bank Capacity:* $${newCap.toLocaleString()}\n💸 *Weekly Upkeep:* $${PROPERTIES[propId].upkeep.toLocaleString()}\n💰 *Passive Income:* $${PROPERTIES[propId].income.toLocaleString()}/day`
    }, { quoted: msg });
}

module.exports = {
    PROPERTIES,
    getBankCapacity,
    syncBankCapacity,
    handlePropertySwitch
};
