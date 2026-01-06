/**
 * Economy Shop Module
 * Handles .shop, .buy, .inventory, .sell, .heal
 */

const economy = require('./economy');
const utils = require('./utils');

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
        name: "⛏️ Iron Pickaxe",
        price: 5000,
        description: "Unlocks .mine command. Break rocks to find gems. (50 uses)",
        type: 'consumable',
        durability: 50
    },
    sword: {
        id: 'sword',
        name: "⚔️ Steel Sword",
        price: 15000,
        description: "Unlocks .hunt command. Battle creatures for high rewards.",
        type: 'permanent'
    },
    shield: {
        id: 'shield',
        name: "🛡️ Power Shield",
        price: 10000,
        description: "Passive: Reduces robbery success rate against you by 50%.",
        type: 'permanent'
    },
    potion: {
        id: 'potion',
        name: "🧪 Health Potion",
        price: 200,
        description: "Restores 50 HP. Essential for hunters.",
        type: 'useable'
    },
    idcard: {
        id: 'idcard',
        name: "🆔 Identity Card",
        price: 3500,
        description: "Allows one free name change via .name command.",
        type: 'useable'
    },
    exp_scroll: {
        id: 'exp_scroll',
        name: "📜 EXP Scroll",
        price: 2000,
        description: "Gives a random XP boost (100-500 XP).",
        type: 'useable'
    },
    premium_title: {
        id: 'premium_title',
        name: "🏆 Premium Title",
        price: 50000,
        description: "A prestigious cosmetic title for your profile.",
        type: 'useable'
    },
    master_hunter: {
        id: 'master_hunter',
        name: "🏹 Hunter Title",
        price: 100000,
        description: "Show off your hunting prowess.",
        type: 'useable',
        title: "Master Hunter 🏹"
    },
    legendary_miner: {
        id: 'legendary_miner',
        name: "💎 Miner Title",
        price: 150000,
        description: "The ultimate miner's badge.",
        type: 'useable',
        title: "Legendary Miner 💎"
    },
    galactic_tycoon: {
        id: 'galactic_tycoon',
        name: "🎩 Tycoon Title",
        price: 500000,
        description: "For the richest in the galaxy.",
        type: 'useable',
        title: "Galactic Tycoon 🎩"
    }
};

/**
 * Display Shop
 */
async function handleShop(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    let shopText = `🏪 *STARRY ECONOMY SHOP*\n\nYour Balance: *$${user.wallet.toLocaleString()}*\n\n`;

    for (const [id, item] of Object.entries(SHOP_ITEMS)) {
        shopText += `*${item.name}*\n`;
        shopText += `💰 Price: $${item.price.toLocaleString()}\n`;
        shopText += `📝 ${item.description}\n`;
        shopText += `⌨️ Command: \`.buy ${id}\`\n\n`;
    }

    shopText += `_Type .buy <item_id> to purchase._`;

    await sock.sendMessage(from, { text: shopText }, { quoted: msg });
}

/**
 * Buy Item
 */
async function handleBuy(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args) {
        return sock.sendMessage(from, { text: "❌ Usage: .buy <item_id>\nExample: .buy rod" }, { quoted: msg });
    }

    const itemId = args.toLowerCase().trim();
    const item = SHOP_ITEMS[itemId];

    if (!item) {
        return sock.sendMessage(from, { text: "❌ That item doesn't exist in our shop!" }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);

    // Check if affordable
    if (user.wallet < item.price) {
        return sock.sendMessage(from, { text: `❌ You need at least *$${item.price.toLocaleString()}* in your wallet to buy this!` }, { quoted: msg });
    }

    // Check if already owned (for permanent items)
    if (item.type === 'permanent' && user.inventory[itemId] > 0) {
        return sock.sendMessage(from, { text: `❌ You already own a *${item.name}*!` }, { quoted: msg });
    }

    // Process Purchase
    user.wallet -= item.price;
    user.inventory[itemId] = (user.inventory[itemId] || 0) + 1;

    // Handle durability for tools
    if (item.durability) {
        user.durability[itemId] = (user.durability[itemId] || 0) + item.durability;
    }

    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `✅ *PURCHASE SUCCESSFUL*\n\nYou bought a *${item.name}* for *$${item.price.toLocaleString()}*!\n\n💰 New Balance: *$${user.wallet.toLocaleString()}*`
    }, { quoted: msg });
}

/**
 * Show Inventory
 */
async function handleInventory(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    let invText = `🎒 *${user.name}'s INVENTORY*\n\n`;

    let hasItems = false;
    for (const [id, count] of Object.entries(user.inventory)) {
        if (count > 0) {
            hasItems = true;
            const itemInfo = SHOP_ITEMS[id];
            invText += `${itemInfo ? itemInfo.name : id}: *${count}*\n`;
            if (user.durability[id] > 0) {
                invText += `   ⚙️ Durability: ${user.durability[id]}\n`;
            }
        }
    }

    if (!hasItems) {
        invText += "_Your backpack is empty._\n\n💡 Use .shop to buy gear!";
    }

    invText += `\n❤️ Health: *${user.health}/${user.max_health}*\n💎 Level: *${user.level}*`;

    await sock.sendMessage(from, { text: invText }, { quoted: msg });
}

/**
 * Sell Item
 */
async function handleSell(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args) {
        return sock.sendMessage(from, { text: "❌ Usage: .sell <item_id>" }, { quoted: msg });
    }

    const itemId = args.toLowerCase().trim();
    const item = SHOP_ITEMS[itemId];
    const user = await economy.getUserProfile(sender, pushName);

    if (!user.inventory[itemId] || user.inventory[itemId] <= 0) {
        return sock.sendMessage(from, { text: `❌ You don't have any *${itemId}* to sell!` }, { quoted: msg });
    }

    const sellPrice = Math.floor((item ? item.price : 100) * 0.5);

    user.inventory[itemId] -= 1;
    user.wallet += sellPrice;

    if (user.durability[itemId]) {
        user.durability[itemId] = 0; // Reset durability on sell
    }

    await economy.saveDB();

    await sock.sendMessage(from, { text: `💵 *ITEM SOLD*\n\nYou sold 1x *${item ? item.name : itemId}* for *$${sellPrice.toLocaleString()}*.` }, { quoted: msg });
}

/**
 * Use Potion (Heal)
 */
async function handleHeal(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    if (!user.inventory.potion || user.inventory.potion <= 0) {
        return sock.sendMessage(from, { text: "❌ You don't have any *Health Potions*! Buy some at the .shop" }, { quoted: msg });
    }

    if (user.health >= user.max_health) {
        return sock.sendMessage(from, { text: "💚 You are already at full health!" }, { quoted: msg });
    }

    user.inventory.potion -= 1;
    user.health = Math.min(user.max_health, user.health + 50);

    await economy.saveDB();

    await sock.sendMessage(from, { text: `🧪 *HEALING SUCCESSFUL*\n\nUsed 1x Health Potion.\n❤️ Health: *${user.health}/${user.max_health}*` }, { quoted: msg });
}

/**
 * Use Item from Inventory
 */
async function handleUse(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args) {
        return sock.sendMessage(from, { text: "❌ Usage: .use <item_id>\nExample: .use exp_scroll" }, { quoted: msg });
    }

    const itemId = args.toLowerCase().trim();
    const user = await economy.getUserProfile(sender, pushName);

    if (!user.inventory[itemId] || user.inventory[itemId] <= 0) {
        return sock.sendMessage(from, { text: `❌ You don't have any *${itemId}* in your inventory!` }, { quoted: msg });
    }

    if (itemId === 'exp_scroll') {
        user.inventory.exp_scroll -= 1;
        // Random XP boost 100-500
        const xpAmount = Math.floor(Math.random() * 401) + 100;
        const result = await economy.addXP(sender, xpAmount);

        let text = `📜 *XP SCROLL USED*\n\nYou gained *${xpAmount} XP*!`;
        if (result.leveled_up) {
            text += `\n🎊 *LEVEL UP!* You are now Level *${result.new_level}*!`;
        }

        await economy.saveDB();
        await sock.sendMessage(from, { text }, { quoted: msg });
    } else if (itemId === 'premium_title') {
        user.inventory.premium_title -= 1;
        user.premium = true;
        await economy.saveDB();
        await sock.sendMessage(from, { text: "🏆 *PREMIUM TITLE ACTIVATED*\n\nYour profile now shines with a celestial glow! ✨\nCheck your status with .profile" }, { quoted: msg });
    } else if (['master_hunter', 'legendary_miner', 'galactic_tycoon'].includes(itemId)) {
        const item = SHOP_ITEMS[itemId];
        user.inventory[itemId] -= 1;

        if (!user.titles) user.titles = [];
        if (!user.titles.includes(item.title)) {
            user.titles.push(item.title);
        }

        await economy.saveDB();
        await sock.sendMessage(from, { text: `🎭 *TITLE ACTIVATED*\n\nYou have equipped the title: *${item.title}*\nView it in your .profile` }, { quoted: msg });
    } else if (itemId === 'idcard') {
        await sock.sendMessage(from, { text: "🆔 *IDENTITY CARD*\n\nUse the `.name <new_name>` command to change your name for free!" }, { quoted: msg });
    } else if (itemId === 'potion') {
        return handleHeal(msg, sock, botState);
    } else {
        await sock.sendMessage(from, { text: "❌ This item cannot be used directly. Check .help for details." }, { quoted: msg });
    }
}

module.exports = {
    handleShop,
    handleBuy,
    handleInventory,
    handleSell,
    handleHeal,
    handleUse
};
