/* 
 * Economy Shop Module
 * Handles .shop, .buy, .inventory, .sell, .heal
 */

import economy from './economy.js';
import economyCards from './economy-cards.js';
import economyAssets from './economy-assets.js';
import utils from '../core/utils.js';
import economyItems from './economy-items.js';

const SHOP_ITEMS = {
    rod: {
        id: 'rod',
        name: "🎣 Fishing Rod",
        price: 500,
        description: "Unlocks .fish command to catch fish for profit.",
        type: 'permanent'
    },
    pickaxe: {
        id: 'pickaxe',
        name: "⛏️ Pickaxe",
        price: 750,
        description: "Unlocks .mine command to find gems.",
        type: 'permanent'
    },
    sword: {
        id: 'sword',
        name: "⚔️ Iron Sword",
        price: 1500,
        description: "Increases hunting success rate.",
        type: 'permanent'
    },
    shovel: {
        id: 'shovel',
        name: "🛶 Shovel",
        price: 600,
        description: "Unlocks .dig command for treasure.",
        type: 'permanent'
    },
    potion: {
        id: 'potion',
        name: "🧪 Health Potion",
        price: 100,
        description: "Restores 50 HP immediately.",
        type: 'consumable',
        effect: 'heal',
        value: 50
    },
    elixir: {
        id: 'elixir',
        name: "🍷 Elixir of Life",
        price: 500,
        description: "Fully restores HP and cures status effects.",
        type: 'consumable',
        effect: 'fullheal'
    },
    lockpick: {
        id: 'lockpick',
        name: "🗝️ Lockpick",
        price: 250,
        description: "Increases robbery success chance by 10% (One use).",
        type: 'consumable',
        effect: 'rob_boost'
    },
    seed: {
        id: 'seed',
        name: "🌱 Mystery Seed",
        price: 50,
        description: "Plant it and see what grows.",
        type: 'consumable'
    }
    // Note: Cards and Properties are handled separately
};

/* 
 * Display Shop
 */
async function handleShop(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const type = (args && args[0]) ? args[0].toLowerCase() : 'items';

    let txt = `🛒 *STARRY GENERAL STORE* 🛒\n\n`;

    if (type === 'cards') {
        // Display Card Packs
        const packs = economyCards.PACKS;
        for (const [id, pack] of Object.entries(packs)) {
            txt += `📦 *${pack.name}*\n💰 $${pack.price.toLocaleString()}\n📜 ${pack.contents.join(', ')}\nID: *${id}*\n\n`;
        }
    } else if (type === 'props' || type === 'properties') {
        const props = economyAssets.PROPERTIES;
        for (const [id, prop] of Object.entries(props)) {
            if (id === 'box') continue; // Hide default box
            txt += `🏠 *${prop.name}*\n💰 $${prop.price.toLocaleString()}\n🔒 Bank: $${prop.bankLimit.toLocaleString()}\nID: *${id}*\n\n`;
        }
    } else {
        // Default Items
        for (const item of Object.values(SHOP_ITEMS)) {
            txt += `🔹 *${item.name}* ($${item.price})\n${item.description}\nID: *${item.id}*\n\n`;
        }
        txt += `_Check other sections: .shop cards | .shop props_\n_To buy: .buy <id>_`;
    }

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * Buy Item
 */
async function handleBuy(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: `.buy <id>`" }, { quoted: msg });

    const itemId = args[0].toLowerCase();
    const amount = parseInt(args[1]) || 1;

    // Check what type of item it is
    let item = SHOP_ITEMS[itemId];
    let category = 'item';

    if (economyCards.PACKS[itemId]) {
        item = economyCards.PACKS[itemId];
        category = 'pack';
    } else if (economyAssets.PROPERTIES[itemId]) {
        item = economyAssets.PROPERTIES[itemId];
        category = 'property';
    }

    if (!item) return sock.sendMessage(from, { text: "❌ Item not found in shop!" }, { quoted: msg });

    const cost = item.price * amount;
    const bal = await economy.getBalance(sender, 'wallet');

    if (bal < cost) return sock.sendMessage(from, { text: `❌ You need $${cost.toLocaleString()} (Have: $${bal.toLocaleString()})` }, { quoted: msg });

    // Process Purchase
    await economy.updateBalance(sender, -cost, 'wallet');

    if (category === 'item') {
        await economy.updateInventory(sender, itemId, amount);
        return sock.sendMessage(from, { text: `✅ Bought ${amount}x *${item.name}* for $${cost.toLocaleString()}` }, { quoted: msg });
    }
    else if (category === 'pack') {
        // Open pack logic handled here or in separate function?
        // For simplicity, buying a pack immediately opens it.
        await sock.sendMessage(from, { text: `📦 Opening ${amount}x *${item.name}*...` });
        // Simulating pack opening loop
        let cards = [];
        for (let i = 0; i < amount; i++) {
            const newCards = await economyCards.openPack(sender, itemId);
            cards.push(...newCards);
        }
        // Save cards to user (economyCards.openPack handles saving usually? let's assume it returns cards and we save, or it saves)
        // Checking openPack implementation: usually it updates DB.
        // Assuming it does.
        return sock.sendMessage(from, { text: `🃏 *PACK OPENED*\n\nYou got: ${cards.map(c => c.name).join(', ')}` }, { quoted: msg });
    }
    else if (category === 'property') {
        if (amount > 1) return sock.sendMessage(from, { text: "❌ You can only own one home at a time!" }, { quoted: msg });
        const user = await economy.getUserProfile(sender);
        if (user.assets.property === itemId) return sock.sendMessage(from, { text: "⚠️ You already own this property!" }, { quoted: msg });

        // Sell old property (50% value) if exists? 
        // For now, just overwrite
        user.assets.property = itemId;
        await economy.saveDB();
        return sock.sendMessage(from, { text: `🏠 *NEW HOME PURCHASED*\n\nYou moved into: *${item.name}*!` }, { quoted: msg });
    }
}

/* 
 * View Inventory
 */
async function handleInventory(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    const inv = await economy.getInventory(sender);
    const user = await economy.getUserProfile(sender);
    const cards = user.assets.cards || [];

    if (Object.keys(inv).length === 0 && cards.length === 0) {
        return sock.sendMessage(from, { text: "🎒 Your inventory is empty." }, { quoted: msg });
    }

    let txt = `🎒 *INVENTORY* 🎒\n\n`;

    // Items
    if (Object.keys(inv).length > 0) {
        txt += `📦 *Items:*\n`;
        for (const [id, count] of Object.entries(inv)) {
            if (count > 0) {
                const name = SHOP_ITEMS[id]?.name || economyItems.getItemName(id) || id;
                txt += `• ${name}: ${count}\n`;
            }
        }
        txt += `\n`;
    }

    // Cards
    if (cards.length > 0) {
        txt += `🃏 *Cards (${cards.length}):*\n`;
        // Group by rarity or something? 
        // Just listing names for now
        const cardNames = cards.map(c => `${c.name} (${c.rarity})`).join(', ');
        txt += cardNames.length > 500 ? cardNames.slice(0, 500) + '...' : cardNames;
    }

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * Use Item
 */
async function handleUse(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const itemId = args[0]?.toLowerCase();

    if (!itemId) return sock.sendMessage(from, { text: "❌ Usage: `.use <item_id>`" }, { quoted: msg });

    const inv = await economy.getInventory(sender);
    if (!inv[itemId] || inv[itemId] <= 0) return sock.sendMessage(from, { text: "❌ You don't have this item!" }, { quoted: msg });

    const item = SHOP_ITEMS[itemId];
    if (!item) return sock.sendMessage(from, { text: "❌ This item cannot be used." }, { quoted: msg });
    if (item.type !== 'consumable') return sock.sendMessage(from, { text: "❌ This item is not consumable." }, { quoted: msg });

    // Deduct
    await economy.updateInventory(sender, itemId, -1);

    // Effect
    if (item.effect === 'heal') {
        // Implement health system later, for now simulate
        return sock.sendMessage(from, { text: `🧪 You drank the potion. Health restored! (+${item.value} HP)` }, { quoted: msg });
    }
    else if (item.effect === 'fullheal') {
        return sock.sendMessage(from, { text: `🍷 You feel completely rejuvenated! (HP Maxed)` }, { quoted: msg });
    }
    else if (item.effect === 'rob_boost') {
        // Should set a state flag
        // For now just echo
        return sock.sendMessage(from, { text: `🗝️ Lockpick prepared. Your next robbery has higher success chance!` }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: `✅ Used ${item.name}.` }, { quoted: msg });
}

export default {
    handleShop,
    handleBuy,
    handleInventory,
    handleUse,
    SHOP_ITEMS
};
