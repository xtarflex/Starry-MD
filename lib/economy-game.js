/* 
 * Economy Game Events Module
 * Handles Chaos Diamonds and The Purge.
 */

const economy = require('./economy');
const economyWorld = require('./economy-world');

// Global State for Events
let CHAOS_DIAMOND = {
    active: false,
    location: null,
    holder: null,       // JID of component holding it
    value: 1000000,
    expires: 0
};

let PURGE_MODE = {
    active: false,
    endTime: 0
};

/* 
 * Process Diamond Event (Spawn Check & Expiry Check)
 * Called periodically from handler core.
 */
async function processDiamondEvent(sock, triggerFrom) {
    // 1. Check Expiry / Win Condition
    if (CHAOS_DIAMOND.active && Date.now() > CHAOS_DIAMOND.expires) {
        if (CHAOS_DIAMOND.holder) {
            // WINNER
            const winner = await economy.getUserProfile(CHAOS_DIAMOND.holder);
            winner.financials.wallet += CHAOS_DIAMOND.value;
            winner.inventory.chaos_diamond = (winner.inventory.chaos_diamond || 0) + 1;
            await economy.saveDB();

            const winMsg = `💎 *CHAOS DIAMOND SECURED* 💎\n\n🏆 *WINNER:* ${winner.name} (@${CHAOS_DIAMOND.holder.split('@')[0]})\n\nThey survived the hunt and claimed *$${CHAOS_DIAMOND.value.toLocaleString()}*!`;

            // Notify the group where the trigger happened (simulated broadcast)
            if (triggerFrom) await sock.sendMessage(triggerFrom, { text: winMsg, mentions: [CHAOS_DIAMOND.holder] });
            // Notify Winner via DM
            await sock.sendMessage(CHAOS_DIAMOND.holder, { text: `✅ *MISSION ACCOMPLISHED*\n\nYou held the Chaos Diamond until extraction!\n💰 +$${CHAOS_DIAMOND.value.toLocaleString()}` });

        } else {
            // FADED
            if (triggerFrom) await sock.sendMessage(triggerFrom, { text: "💎 *SIGNAL LOST*\n\nThe Chaos Diamond signal has faded. No one claimed the artifact." });
        }

        // Reset
        CHAOS_DIAMOND = {
            active: false,
            location: null,
            holder: null,
            value: 1000000,
            expires: 0
        };
        return null;
    }

    // 2. Spawn Check (Only if not active)
    if (!CHAOS_DIAMOND.active) {
        if (Math.random() < 0.01) { // 1% chance per trigger
            const planets = Object.keys(economyWorld.LOCATIONS);
            const loc = planets[Math.floor(Math.random() * planets.length)];

            CHAOS_DIAMOND = {
                active: true,
                location: loc,
                holder: null,
                value: 1000000 + Math.floor(Math.random() * 4000000), // 1M - 5M
                expires: Date.now() + (30 * 60 * 1000) // 30 mins
            };

            // Return event info for handler to broadcast
            return CHAOS_DIAMOND;
        }
    }

    return null;
}

/* 
 * Handle .diamond command (Claim or Steal)
 */
async function claimDiamond(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!from.endsWith('@g.us')) {
        return sock.sendMessage(from, { text: "❌ You can only interact with Chaos Diamonds in public channels (Groups)!" }, { quoted: msg });
    }

    if (!CHAOS_DIAMOND.active) {
        return sock.sendMessage(from, { text: "💎 *NO SIGNAL*\n\nThere are no Chaos Diamonds detected in the Multiverse right now." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender);
    const now = Date.now();
    const timeLeft = Math.ceil((CHAOS_DIAMOND.expires - now) / 60000);

    // Case 1: You are already holding it
    if (CHAOS_DIAMOND.holder === sender) {
        return sock.sendMessage(from, { text: `💎 *YOU HAVE THE DIAMOND!* 💎\n\n🏃 *RUN!* Hide on other planets!\n⏱️ Time to Extraction: *${timeLeft} minutes*\n\n⚠️ People are coming for you!` }, { quoted: msg });
    }

    // Case 2: Someone else holds it (STEAL)
    if (CHAOS_DIAMOND.holder) {
        const holderProfile = await economy.getUserProfile(CHAOS_DIAMOND.holder);

        // Location Check
        if (user.location !== holderProfile.location) {
            return sock.sendMessage(from, { text: `📡 *TRACKING SIGNAL*\n\nCarrier: @${CHAOS_DIAMOND.holder.split('@')[0]}\n🌍 Location: *${holderProfile.location}*\n\n❌ You are on *${user.location}*. Go to their planet to steal it!`, mentions: [CHAOS_DIAMOND.holder] }, { quoted: msg });
        }

        // Available to Steal? (Check user cooldown)
        const cooldown = await economy.checkCooldown(sender, 'steal_diamond');
        if (cooldown.onCooldown) {
            return sock.sendMessage(from, { text: `⏳ *COOLDOWN*\n\nYou need to catch your breath! Can steal again in *${Math.ceil(cooldown.remaining / 1000)}s*.` }, { quoted: msg });
        }

        // SUCCESSFUL STEAL
        const previousHolder = CHAOS_DIAMOND.holder;
        CHAOS_DIAMOND.holder = sender; // Transfer ownership

        // Set cooldown for the THIEF (1 minute)
        await economy.setCooldown(sender, 'steal_diamond', 60000);

        // Notify
        const stealMsg = `🔫 *DIAMOND STOLEN!* 🔫\n\n@${sender.split('@')[0]} snatched the Chaos Diamond from @${previousHolder.split('@')[0]}!\n\n🌍 Planet: ${user.location}\n⏱️ Time Left: ${timeLeft}m\n\n*Get it back!*`;
        return sock.sendMessage(from, { text: stealMsg, mentions: [sender, previousHolder] });
    }

    // Case 3: Nobody holds it (INITIAL CLAIM)
    // Check location
    if (user.location !== CHAOS_DIAMOND.location) {
        return sock.sendMessage(from, { text: `📡 *SIGNAL DETECTED*\n\nObject located on: *${CHAOS_DIAMOND.location}*\nYou are on: ${user.location}\n\n*Travel there to pick it up!*` }, { quoted: msg });
    }

    // CLAIM
    CHAOS_DIAMOND.holder = sender;
    // START THE CHASE TIMER (3 Minutes)
    CHAOS_DIAMOND.expires = Date.now() + (3 * 60 * 1000);

    await economy.setCooldown(sender, 'steal_diamond', 60000);

    const claimMsg = `💎 *DIAMOND ACQUIRED* 💎\n\n@${sender.split('@')[0]} has picked up the Chaos Diamond!\n\n🕒 *THE CHASE BEGINS*\nTimer updated to: *3 minutes*\n\n🌍 Location: ${user.location}\n💰 Reward: $${CHAOS_DIAMOND.value.toLocaleString()}\n\n*Everyone else: ATTACK!* Type .diamond to steal!`;
    return sock.sendMessage(from, { text: claimMsg, mentions: [sender] });
}

/* 
 * Check Purge Status
 */
function isPurgeActive() {
    if (PURGE_MODE.active && Date.now() < PURGE_MODE.endTime) return true;
    PURGE_MODE.active = false;
    return false;
}

/* 
 * Trigger The Purge (Admin Only or Timer)
 */
function startPurge(durationMinutes = 60) {
    PURGE_MODE.active = true;
    PURGE_MODE.endTime = Date.now() + (durationMinutes * 60 * 1000);
    return PURGE_MODE;
}

module.exports = {
    processDiamondEvent,
    claimDiamond,
    isPurgeActive,
    startPurge,
    getDiamondState: () => CHAOS_DIAMOND
};
