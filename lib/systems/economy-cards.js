/* 
 * Economy Role & Identity Module
 * Manages role switching and buff calculations.
 */

const economy = require('./economy');

const ROLES = {
    "Citizen": {
        description: "A standard inhabitant of the Multiverse.",
        multipliers: { work: 1.0, tax: 1.0, rob_success: 1.0, rob_defense: 1.0 },
        emoji: "🥉"
    },
    "Police": {
        description: "Enforcers of galactic law. High work yield, better defense.",
        multipliers: { work: 1.3, tax: 1.0, rob_success: 0.5, rob_defense: 1.5 },
        emoji: "👮"
    },
    "Thief": {
        description: "Masters of the shadows. Experts at robbery, poor at honest work.",
        multipliers: { work: 0.7, tax: 1.0, rob_success: 1.8, rob_defense: 0.8 },
        emoji: "🥷"
    },
    "Merchant": {
        description: "Master traders. Pay lower taxes and earn more from work.",
        multipliers: { work: 1.2, tax: 0.7, rob_success: 1.0, rob_defense: 1.0 },
        emoji: "👨‍💼"
    }
};

/* 
 * Get the net multiplier for a specific activity based on role.
 */
function getRoleMultiplier(user, activity) {
    const roleData = ROLES[user.role] || ROLES["Citizen"];
    return roleData.multipliers[activity] || 1.0;
}

/* 
 * Switch Role via ID Card
 */
async function handleSwitchRole(msg, sock, botState, roleName) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);

    if (!ROLES[roleName]) {
        return sock.sendMessage(from, { text: `❌ Role *${roleName}* does not exist.` }, { quoted: msg });
    }

    if (user.role === roleName) {
        return sock.sendMessage(from, { text: `⚠️ You are already a *${roleName}*.` }, { quoted: msg });
    }

    // Process switch
    user.role = roleName;
    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `🆔 *IDENTITY UPDATED*\n\nYou are now a * ${roleName}* ${ROLES[roleName].emoji}.\n${ROLES[roleName].description}`
    }, { quoted: msg });
}

module.exports = {
    ROLES,
    getRoleMultiplier,
    handleSwitchRole
};
