/* 
 * Economy Items Module
 * Handles item usage logic (.use <item>)
 */

import economy from './economy.js';
import economyCards from './economy-cards.js';
import economyAssets from './economy-assets.js';
import rateLimit from '../utils/rate-limit.js';
import utils from '../core/utils.js';
// Lazy load SHOP_ITEMS inside handleUse to avoid circular dependency
// import { SHOP_ITEMS } from './economy-shop.js'; // Circular

/* 
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

async function handleUse(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const isMe = msg.key.fromMe;

    // CRITICAL FIX: Ensure sender JID matches what handler.js/rate-limit.js uses
    const rawSender = isMe ? sock.user.id : (isGroup ? msg.key.participant : from);
    const sender = utils.decodeJid(rawSender);
    const pushName = msg.pushName || "User";

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: .use <item_id> [quantity]\nExample: .use exp_scroll 5" }, { quoted: msg });
    }

    // Parse Quantity (Check if last arg is a number)
    let quantity = 1;
    let itemParts = [...args];
    const lastArg = args[args.length - 1];

    if (/^\d+$/.test(lastArg)) {
        quantity = parseInt(lastArg);
        if (quantity < 1) quantity = 1;
        itemParts.pop(); // Remove quantity from ID parts
    }

    // Safety Cap
    if (quantity > 50) quantity = 50;

    const itemId = itemParts.join('_').toLowerCase().trim();
    const user = await economy.getUserProfile(sender, pushName);

    // Strict Inventory Check
    if (!user.inventory[itemId] || user.inventory[itemId] < quantity) {

        let suggestionMsg = `❌ You don't have *${quantity}x ${itemId}* in your inventory!`;

        // Attempt to find closest match from ALL valid items (owned or not)
        try {
            const { SHOP_ITEMS } = await import('./economy-shop.js');
            const validIds = Object.keys(SHOP_ITEMS);

            let bestMatch = null;
            let bestDistance = Infinity;
            const threshold = 3;

            for (const validId of validIds) {
                const distance = levenshtein(itemId, validId);
                if (distance < bestDistance && distance <= threshold) {
                    bestDistance = distance;
                    bestMatch = validId;
                }
            }

            if (bestMatch) {
                suggestionMsg += `\n\n💡 *Did you mean:* .use *${bestMatch}*?`;
                // If they own the suggestion, tell them!
                if (user.inventory[bestMatch] > 0) {
                    suggestionMsg += `\n✅ (You own ${user.inventory[bestMatch]} of these!)`;
                }
            }
        } catch (e) {
            console.error("Failed to lazy load SHOP_ITEMS", e);
        }

        return sock.sendMessage(from, { text: suggestionMsg }, { quoted: msg });
    }

    // --- CONSUMABLE LOGIC ---

    // 1. EXP SCROLL
    if (itemId === 'exp_scroll') {
        user.inventory.exp_scroll -= quantity;

        let totalXp = 0;
        let leveledCombined = false;
        let finalLevel = 0;

        for (let i = 0; i < quantity; i++) {
            const xpAmount = Math.floor(Math.random() * 401) + 100; // 100-500
            const result = await economy.addXP(sender, xpAmount);
            totalXp += xpAmount;
            if (result.leveled_up) {
                leveledCombined = true;
                finalLevel = result.new_level;
            }
        }

        let text = `📜 *XP SCROLL USED (${quantity}x)*\n\nYou gained a total of *${totalXp} XP*!`;
        if (leveledCombined) {
            text += `\n🎊 *LEVEL UP!* You are now Level *${finalLevel}*!`;
        }
        await economy.saveDB();
        return sock.sendMessage(from, { text }, { quoted: msg });
    }

    // 2. HEALTH POTION
    else if (itemId === 'potion') {
        if (!user.health) user.health = 50; // default if missing
        if (user.health >= 100) {
            return sock.sendMessage(from, { text: "💚 You are already at full health!" }, { quoted: msg });
        }

        const missing = 100 - user.health;
        const needed = Math.ceil(missing / 50);
        const actualUse = Math.min(quantity, needed);

        user.inventory.potion -= actualUse;
        const healed = Math.min(missing, actualUse * 50);
        user.health += healed;

        await economy.saveDB();

        const extraMsg = quantity > actualUse ? `\n_Restored to full health using ${actualUse} potions._` : "";
        return sock.sendMessage(from, { text: `🧪 *HEALING SUCCESSFUL*\n\nUsed ${actualUse}x Health Potion(s).\nHealed: +${healed} HP\n❤️ Health: *${user.health}/100*${extraMsg}` }, { quoted: msg });
    }

    // 3. SINGLE USE ITEMS (Block Bulk Use)
    if (quantity > 1) {
        // List of items that shouldn't be bulk used.
        // We can just check for single-use logic blocks below.
        // OR we can default to blocking if not handled in consumable logic above.
        // Let's explicitly check important ones.
        const singleUseItems = ['energy_drink', 'time_orb', 'jail_card', 'shadow_cloak', 'premium_title', 'idcard'];

        if (singleUseItems.includes(itemId) || itemId.startsWith('id_') || itemId.startsWith('prop_')) {
            return sock.sendMessage(from, { text: `❌ *${itemId}* can only be used one at a time.` }, { quoted: msg });
        }
    }

    // --- SINGLE USE LOGIC DELEGATION ---

    // PREMIUM TITLE
    if (itemId === 'premium_title') {
        user.inventory.premium_title -= 1;
        if (!user.titles) user.titles = [];
        if (!user.titles.includes("Premium 🌟")) user.titles.push("Premium 🌟");
        await economy.saveDB();
        return sock.sendMessage(from, { text: "🏆 *PREMIUM TITLE ACTIVATED*\n\nYour profile now shines with a celestial glow! ✨\nCheck your status with .profile" }, { quoted: msg });
    }

    // ENERGY DRINK (Reset Work Cooldown)
    else if (itemId === 'energy_drink') {
        const check = await economy.checkCooldown(sender, 'work');
        if (!check.onCooldown) {
            return sock.sendMessage(from, { text: "⚡ You are already fully rested! No need for energy." }, { quoted: msg });
        }
        user.inventory.energy_drink -= 1;
        user.cooldowns.work = 0; // Reset
        await economy.saveDB();
        return sock.sendMessage(from, { text: "⚡ *GULP!*\n\nYou drank an Energy Drink. You feel refreshed and ready to work again!" }, { quoted: msg });
    }

    // SHADOW CLOAK (Robbery Immunity)
    else if (itemId === 'shadow_cloak') {
        user.inventory.shadow_cloak -= 1;
        await economy.setCooldown(sender, 'rob_immunity', 3600000);
        await economy.saveDB();
        return sock.sendMessage(from, { text: "🧥 *CLOAK EQUIPPED*\n\nYou have vanished into the shadows.\n🛡️ *Immunity:* 1 Hour against robberies." }, { quoted: msg });
    }

    // TIME ORB (Reset Rob Cooldown)
    else if (itemId === 'time_orb') {
        const check = await economy.checkCooldown(sender, 'rob');
        if (!check.onCooldown) {
            return sock.sendMessage(from, { text: "🔮 The timeline is already clear! You don't have a robbery cooldown." }, { quoted: msg });
        }

        user.inventory.time_orb -= 1;
        user.cooldowns.rob = 0; // Reset
        rateLimit.reset(sender, 'rob'); // Reset Rate Limit
        rateLimit.reset(sender, 'steal'); // Reset Steal as well
        await economy.saveDB();
        return sock.sendMessage(from, { text: "🔮 *TIME WARP*\n\nYou shattered the Time Orb!\nYour robbery cooldown has been erased from the timeline." }, { quoted: msg });
    }

    // JAIL CARD
    else if (itemId === 'jail_card') {
        if (!user.jail_until || user.jail_until <= Date.now()) {
            return sock.sendMessage(from, { text: "🎟️ You are not in jail. Save this for when you need it!" }, { quoted: msg });
        }
        user.inventory.jail_card -= 1;
        user.jail_until = 0;
        await economy.saveDB();
        return sock.sendMessage(from, { text: "🎟️ *FREEDOM!*\n\nYou presented your Get Out of Jail Free card. The guards let you go." }, { quoted: msg });
    }

    // ROLES / ID CARDS
    else if (itemId.startsWith('id_')) {
        let role = null;
        if (itemId === 'id_police') role = 'Police';
        if (itemId === 'id_thief') role = 'Thief';
        if (itemId === 'id_merchant') role = 'Merchant';
        if (role) {
            user.inventory[itemId] -= 1;
            await economyCards.handleSwitchRole(msg, sock, botState, role);
            return;
        }
    }

    // PROPERTIES
    else if (itemId.startsWith('prop_')) {
        user.inventory[itemId] -= 1;
        await economyAssets.handlePropertySwitch(msg, sock, botState, itemId);
        return;
    }

    // TITLES
    else if (['master_hunter', 'legendary_miner', 'galactic_tycoon'].includes(itemId)) {
        user.inventory[itemId] -= 1;
        const titleMap = {
            'master_hunter': "Master Hunter 🏹",
            'legendary_miner': "Legendary Miner 💎",
            'galactic_tycoon': "Galactic Tycoon 🎩"
        };
        const title = titleMap[itemId];
        if (!user.titles) user.titles = [];
        if (!user.titles.includes(title)) {
            user.titles.push(title);
        }
        await economy.saveDB();
        return sock.sendMessage(from, { text: `🎭 *TITLE ACTIVATED*\n\nYou have equipped the title: *${title}*\nView it in your .profile` }, { quoted: msg });
    }

    else if (itemId === 'idcard') {
        return sock.sendMessage(from, { text: "🆔 *IDENTITY CARD*\n\nUse the `.name <new_name>` command to change your name for free!" }, { quoted: msg });
    }

    else {
        return sock.sendMessage(from, { text: "❌ This item cannot be used directly. Check .help for details." }, { quoted: msg });
    }
}

export default { handleUse };
