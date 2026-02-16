/* 
 * Economy World & Travel Module
 * Defines planets, maps, and travel laws.
 */

const economy = require('./economy');
const utils = require('../core/utils');

const LOCATIONS = {
    "Earth": {
        description: "The cradle of humanity. Balanced economy with a 5% trade tax.",
        multiplier: 1.0,
        tax: 0.05,
        activities: ["work", "fish", "gamble"],
        emoji: "🌍"
    },
    "Mars": {
        description: "A dusty red frontier. Mining yields are 3x, but fishing is impossible.",
        multiplier: 3.0,
        tax: 0.0,
        activities: ["work", "mine", "gamble"],
        emoji: "🔴"
    },
    "Cyber City": {
        description: "A neon-soaked dystopia where crime pays double and police have no jurisdiction.",
        multiplier: 2.0,
        tax: 0.02,
        activities: ["work", "rob", "gamble"],
        emoji: "🌃"
    },
    "The Void": {
        description: "An unstable rift in space-time. High-risk hunting for massive rewards.",
        multiplier: 5.0,
        tax: 0.0,
        activities: ["hunt"],
        emoji: "🔮"
    }
};

/* 
 * Get Galactic Map
 */
async function handleMap(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);

    let mapText = `🌌 *GALACTIC NAVIGATION SYSTEM* 🌌\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const [name, data] of Object.entries(LOCATIONS)) {
        const isCurrent = user.location === name;
        mapText += `${isCurrent ? "📍" : data.emoji} *${name.toUpperCase()}*\n`;
        mapText += `📝 ${data.description}\n`;
        mapText += `📊 Multiplier: x${data.multiplier} | ${isCurrent ? "*(You are here)*" : ""}\n\n`;
    }

    mapText += `🚀 *Travel:* Type \`.travel <planet>\` to move.\n_Note: You need a compatible vehicle to reach certain planets._`;

    // Try to send Image
    try {
        const fs = require('fs-extra');
        if (fs.existsSync('./database/galactic_map.png')) {
            const image = fs.readFileSync('./database/galactic_map.png');
            await sock.sendMessage(from, { image: image, caption: mapText }, { quoted: msg });
            return;
        }
    } catch (e) {
        // Fallback
    }

    await sock.sendMessage(from, { text: mapText }, { quoted: msg });
}

/* 
 * Planetary Travel (.travel)
 */
async function handleTravel(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: .travel <planet>\nExample: .travel Mars" }, { quoted: msg });
    }

    const destination = args.join(' ').trim().toLowerCase();
    const planetName = Object.keys(LOCATIONS).find(k => k.toLowerCase() === destination);

    if (!planetName) {
        return sock.sendMessage(from, { text: `❌ Planet *"${destination}"* not found in our star charts.` }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender);
    if (user.location === planetName) {
        return sock.sendMessage(from, { text: `⚠️ You are already on *${planetName}*.` }, { quoted: msg });
    }

    // Vehicle Requirements
    const requirements = {
        "Mars": { item: "rocket", name: "🚀 Rocket" },
        "Cyber City": { item: "starship", name: "🛸 Starship" },
        "The Void": { item: "void_drive", name: "☄️ Void Drive" }
    };

    if (requirements[planetName]) {
        const req = requirements[planetName];
        if (!user.inventory[req.item] || user.inventory[req.item] <= 0) {
            return sock.sendMessage(from, {
                text: `❌ *ACCESS DENIED*\n\nTo reach *${planetName}*, you need a *${req.name}*.\nBuy one at the \`.shop\`.`
            }, { quoted: msg });
        }
    }

    // Process Travel
    const oldLocation = user.location;
    user.location = planetName;
    user.stats.travel_count = (user.stats.travel_count || 0) + 1;
    await economy.saveDB();

    const travelMsg = `
✨ *WARP DRIVE ACTIVATED* ✨
━━━━━━━━━━━━━━━━━━━━━
📍 * Departing:* ${oldLocation}
🏁 * Arriving:* ${planetName}

${LOCATIONS[planetName].emoji} *WELCOME TO ${planetName.toUpperCase()}!*
${LOCATIONS[planetName].description}
`.trim();

    await sock.sendMessage(from, { text: travelMsg }, { quoted: msg });
}

module.exports = {
    LOCATIONS,
    handleMap,
    handleTravel
};
