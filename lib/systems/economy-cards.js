/* 
 * Economy Role & Identity Module
 * Manages role switching and buff calculations.
 */

import economy from './economy.js';

export const ROLES = {
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
    "BountyHunter": {
        description: "Hunts criminals for sport and profit.",
        multipliers: { work: 0.8, tax: 1.0, rob_success: 1.2, rob_defense: 0.8 },
        emoji: "🔫"
    },
    "Tycoon": {
        description: "Business magnate. Higher tax, but massive income potential.",
        multipliers: { work: 2.0, tax: 1.5, rob_success: 0.8, rob_defense: 0.5 },
        emoji: "💼"
    },
    "Criminal": {
        description: "Lives outside the law. High risk, high reward.",
        multipliers: { work: 0.5, tax: 0.0, rob_success: 1.5, rob_defense: 0.5 },
        emoji: "🦹"
    }
};

/* 
 * Get Multiplier for a specific attribute based on user role
 */
export async function getRoleMultiplier(jid, attribute) {
    const user = await economy.getUserProfile(jid);
    const role = user.role || "Citizen";

    if (ROLES[role] && ROLES[role].multipliers && ROLES[role].multipliers[attribute]) {
        return ROLES[role].multipliers[attribute];
    }
    return 1.0;
}

/* 
 * Switch Role
 */
async function handleSwitchRole(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (args.length < 1) {
        let list = "📜 *AVAILABLE ROLES*\n\n";
        for (const [key, val] of Object.entries(ROLES)) {
            list += `${val.emoji} *${key}*: ${val.description}\n`;
        }
        list += `\n_Usage: .setrole <RoleName>_`;
        return sock.sendMessage(from, { text: list }, { quoted: msg });
    }

    const requestedRole = args[0]; // Case sensitive match for now? Let's make it insensitive.
    const roleKey = Object.keys(ROLES).find(r => r.toLowerCase() === requestedRole.toLowerCase());

    if (!roleKey) {
        return sock.sendMessage(from, { text: "❌ Unknown role." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender);

    // Cost to switch? Free for now.
    user.role = roleKey;
    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `✅ You are now a *${roleKey}* ${ROLES[roleKey].emoji}!`
    }, { quoted: msg });
}

export default {
    getRoleMultiplier,
    handleSwitchRole,
    ROLES
};
