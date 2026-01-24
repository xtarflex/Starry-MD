/* 
 * Economy Shop Module
 * Handles .shop, .buy, .inventory, .sell, .heal
 */

const economy = require('./economy');
const economyCards = require('./economy-cards');
const economyAssets = require('./economy-assets');
const utils = require('./utils');
const economyItems = require('./economy-items');

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
    time_orb: {
        id: 'time_orb',
        name: "🔮 Time Orb",
        price: 25000,
        description: "Manipulate time to instantly reset your .rob cooldown.",
        type: 'useable'
    },
    energy_drink: {
        id: 'energy_drink',
        name: "⚡ Energy Drink",
        price: 500,
        description: "Instantly resets your 'work' cooldown.",
        type: 'useable'
    },
    shadow_cloak: {
        id: 'shadow_cloak',
        name: "🧥 Cloak of Shadows",
        price: 15000,
        description: "Become invincible to robbery attempts for 1 hour.",
        type: 'useable'
    },
    jail_card: {
        id: 'jail_card',
        name: "🎟️ Get Out of Jail Card",
        price: 20000,
        description: "Instantly releases you from jail without paying bail.",
        type: 'useable'
    },
    premium_title: {
        id: 'premium_title',
        name: "🏆 Premium Title",
        price: 50000,
        description: "A prestigious cosmetic title for your profile.",
        type: 'useable'
    },
    debit_card: {
        id: 'debit_card',
        name: "💳 Starry Bank Card",
        price: 25000,
        description: "Allows automated withdrawals from your bank account for all transactions.",
        type: 'item',
        aliases: ["bank_card", "card", "atm_card"]
    },
    handcuffs: {
        id: 'handcuffs',
        name: "⛓️ Handcuffs",
        price: 5000,
        description: "Required for Citizens to perform arrests. (One-time use per successful arrest)",
        type: 'consumable'
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
    },
    // --- WEAPONS ---
    pistol: {
        id: 'pistol',
        name: "🔫 Glock 19",
        price: 1500,
        description: "Standard issue sidearm. +20 Attack Power.",
        type: 'permanent',
        attack: 20
    },
    rifle: {
        id: 'rifle',
        name: "💀 AK-47",
        price: 8000,
        description: "Heavy assault rifle. +50 Attack Power.",
        type: 'permanent',
        attack: 50
    },
    drone: {
        id: 'drone',
        name: "🛸 Spy Drone",
        price: 50000,
        description: "Rob from a distance ('laying down'). No Jail risk, but expensive to operate.",
        type: 'permanent'
    },
    // --- VEHICLES ---
    car_sport: {
        id: 'car_sport',
        name: "🏎️ Sport Car",
        price: 75000,
        description: "Fast travel on Earth. Status symbol.",
        type: 'permanent',
        speed: 2.0
    },
    cyber_bike: {
        id: 'cyber_bike',
        name: "🏍️ Cyber Bike",
        price: 45000,
        description: "Agile neon bike. Perfect for the city.",
        type: 'permanent',
        speed: 1.5
    },
    rocket: {
        id: 'rocket',
        name: "🚀 Space Rocket",
        price: 50000,
        description: "Enables interplanetary travel to Mars.",
        type: 'permanent'
    },
    starship: {
        id: 'starship',
        name: "🛸 Warp Starship",
        price: 250000,
        description: "Enables travel to Cyber City. Interstellar luxury.",
        type: 'permanent'
    },
    void_drive: {
        id: 'void_drive',
        name: "🌌 Void Drive",
        price: 1000000,
        description: "Experimental engine for The Void. Dangerous.",
        type: 'permanent'
    },
    // --- SPECIAL LICENSES ---
    license_thief: {
        id: 'license_thief',
        name: "🎭 Thief License",
        price: 50000,
        description: "Professional certification. Increases rob success rate & allows House robbery.",
        type: 'permanent'
    },
    badge_police: {
        id: 'badge_police',
        name: "👮 Police Badge",
        price: 50000,
        description: "Join the force. Earn passive income from failed robberies.",
        type: 'permanent'
    },
    // --- DEBIT CARD (Starry Multiverse) ---
    debit_card: {
        id: 'debit_card',
        name: "💳 Multiverse Debit Card",
        price: 5000,
        description: "Allows smart-spending directly from your Bank account.",
        type: 'permanent'
    },

    // --- ID CARDS (ROLES) ---
    id_police: {
        id: 'id_police',
        name: "👮 Police ID Card",
        price: 50000,
        description: "Identity: Switch to the Police role. Buff: +30% Work, +50% Rob Defense.",
        type: 'useable',
        role: 'Police'
    },
    id_thief: {
        id: 'id_thief',
        name: "🥷 Thief ID Card",
        price: 30000,
        description: "Identity: Switch to the Thief role. Buff: +80% Rob Success, -30% Work.",
        type: 'useable',
        role: 'Thief'
    },
    id_merchant: {
        id: 'id_merchant',
        name: "👨‍💼 Merchant ID Card",
        price: 100000,
        description: "Identity: Switch to the Merchant role. Buff: -30% Tax, +20% Work.",
        type: 'useable',
        role: 'Merchant'
    },
    // --- REAL ESTATE (PROPERTIES) ---
    prop_apartment: {
        id: 'prop_apartment',
        name: "🏘️ Micro-Apartment",
        price: 50000,
        description: "A small base. Use to move in. Bank Cap: $300k. Upkeep: $500/week.",
        type: 'useable',
        property: 'prop_apartment'
    },
    prop_penthouse: {
        id: 'prop_penthouse',
        name: "🌆 Luxury Penthouse",
        price: 500000,
        description: "Live the high life. Use to move in. Bank Cap: $3M. Upkeep: $5k/wk.",
        type: 'useable',
        property: 'prop_penthouse'
    },
    prop_mansion: {
        id: 'prop_mansion',
        name: "🏛️ Galactic Mansion",
        price: 5000000,
        description: "Elite status. Use to claim. Bank Cap: $40M. Upkeep: $50k/wk.",
        type: 'useable',
        property: 'prop_mansion'
    },
    prop_estate: {
        id: 'prop_estate',
        name: "🪐 Planetary Estate",
        price: 50000000,
        description: "Ruler of realms. Use to claim. Bank Cap: $500M. Upkeep: $500k/wk.",
        type: 'useable',
        property: 'prop_estate'
    },
    prop_private_island: {
        id: 'prop_private_island',
        name: "🏝️ Private Island",
        price: 250000000,
        description: "Your own paradise. Use to claim. Bank Cap: $5B. Upkeep: $1M/wk.",
        type: 'useable',
        property: 'prop_private_island'
    },
    prop_moon_base: {
        id: 'prop_moon_base',
        name: "🌑 Moon Base Alpha",
        price: 1000000000,
        description: "The ultimate flex. Use to claim. Bank Cap: $100B. Upkeep: $5M/wk.",
        type: 'useable',
        property: 'prop_moon_base'
    },
    // --- LEGENDARY ITEMS ---
    golden_bike: {
        id: 'golden_bike',
        name: "🏍️ Golden Cyber Bike",
        price: 100000000,
        description: "A bike made of solid gold. Functionally identical to a Cyber Bike, but shinier.",
        type: 'permanent',
        speed: 1.5
    },
    dyson_blueprint: {
        id: 'dyson_blueprint',
        name: "☀️ Dyson Sphere Blueprint",
        price: 5000000000,
        description: "Plans for a star-enveloping mega-structure. The ultimate status symbol.",
        type: 'item'
    },
    // --- PROFILE PICTURES (ANIME) ---
    pfp_default: {
        id: 'pfp_default',
        name: "👤 Default Avatar",
        price: 0,
        description: "Standard issue neural avatar. (No Gender)",
        type: 'pfp',
        url: 'c:/StarryMD/assets/pfp/pfp_default.png'
    },
    // Male Series
    pfp_male_1: { id: 'pfp_male_1', name: "🧑 Male Avatar I", price: 1000, description: "A simple sketch of a casual guy.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_male_1.png' },
    pfp_male_2: { id: 'pfp_male_2', name: "👨 Male Avatar II", price: 10000, description: "Clean lines, smart casual look.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_male_2.png' },
    pfp_male_3: { id: 'pfp_male_3', name: "🤵 Male Avatar III", price: 50000, description: "Stylish, confident, textured.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_male_3.png' },
    pfp_male_4: { id: 'pfp_male_4', name: "🤴 Male Avatar IV", price: 200000, description: "Detailed, dramatic, cool vibe.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_male_4.png' },
    pfp_male_5: { id: 'pfp_male_5', name: "🧖‍♂️ Male Avatar V (God)", price: 1000000, description: "Ethereal, divine, masterpiece.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_male_5.png' },

    // Female Series
    pfp_female_1: { id: 'pfp_female_1', name: "👩 Female Avatar I", price: 1000, description: "A simple sketch of a casual girl.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_female_1.png' },
    pfp_female_2: { id: 'pfp_female_2', name: "👱‍♀️ Female Avatar II", price: 10000, description: "Clean lines, friendly and smart.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_female_2.png' },
    pfp_female_3: { id: 'pfp_female_3', name: "👩‍🎤 Female Avatar III", price: 50000, description: "Trendy, confident, high production.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_female_3.png' },
    pfp_female_4: { id: 'pfp_female_4', name: "👸 Female Avatar IV (Goddess)", price: 500000, description: "Divine beauty, ethereal glow.", type: 'pfp', url: 'c:/StarryMD/assets/pfp/pfp_female_4.png' }
};

/* 
 * Display Shop
 */
async function handleShop(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    let shopText = `🏪 *STARRY ECONOMY SHOP*\n\nYour Balance: *$${user.financials.wallet.toLocaleString()}*\n\n`;

    for (const [id, item] of Object.entries(SHOP_ITEMS)) {
        shopText += `*${item.name}*\n`;
        shopText += `💰 Price: $${item.price.toLocaleString()}\n`;
        shopText += `📝 ${item.description}\n`;
        shopText += `⌨️ Command: \`.buy ${id}\`\n\n`;
    }

    shopText += `_Type .buy <item_id> to purchase._`;

    await sock.sendMessage(from, { text: shopText }, { quoted: msg });
}

/* 
 * Buy Item
 */
async function handleBuy(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: .buy <item_id> [quantity]\nExample: .buy rod\nExample: .buy potion 5" }, { quoted: msg });
    }

    const itemId = args[0].toLowerCase().trim();
    let quantity = 1;

    // Parse Quantity if provided
    if (args.length > 1) {
        const parsedQty = parseInt(args[1]);
        if (!isNaN(parsedQty) && parsedQty > 0) {
            quantity = parsedQty;
        } else {
            return sock.sendMessage(from, { text: "❌ Invalid quantity. Please use a positive number." }, { quoted: msg });
        }
    }

    let item = SHOP_ITEMS[itemId];

    // Check aliases if direct ID match fails
    if (!item) {
        for (const key of Object.keys(SHOP_ITEMS)) {
            if (SHOP_ITEMS[key].aliases && SHOP_ITEMS[key].aliases.includes(itemId)) {
                item = SHOP_ITEMS[key];
                break; // Found it
            }
        }
    }

    if (!item) {
        return sock.sendMessage(from, { text: "❌ That item doesn't exist in our shop!" }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const hasBankCard = (user.inventory.debit_card || 0) > 0;
    const totalBalance = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

    // Calculate total cost
    const totalCost = item.price * quantity;

    // Check if affordable
    if (totalBalance < totalCost) {
        const errorMsg = hasBankCard
            ? `❌ You need at least *$${totalCost.toLocaleString()}* total (Wallet + Bank) to buy *${quantity}x ${item.name}*!\n💰 Balance: *$${totalBalance.toLocaleString()}*`
            : `❌ You need at least *$${totalCost.toLocaleString()}* in your wallet to buy *${quantity}x ${item.name}*!\n💡 Tip: Use a *💳 Bank Card* to use your bank funds directly!`;
        return sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
    }

    // Check if already owned (for permanent items)
    // Permanent items can only be bought once (quantity 1) or strictly blocked if owned?
    // Let's strictly block if owned > 0.
    if (item.type === 'permanent' && user.inventory[itemId] > 0) {
        return sock.sendMessage(from, { text: `❌ You already own a *${item.name}*!` }, { quoted: msg });
    }
    // Also block buying multiple permanent items at once (waste of money)
    if (item.type === 'permanent' && quantity > 1) {
        return sock.sendMessage(from, { text: `❌ You can only own one *${item.name}*!` }, { quoted: msg });
    }

    // Process Purchase
    if (hasBankCard && user.financials.wallet < totalCost) {
        const remainder = totalCost - user.financials.wallet;
        user.financials.wallet = 0;
        user.financials.bank -= remainder;
    } else {
        user.financials.wallet -= totalCost;
    }

    // HOUSE TRANSFER (Closed Loop)
    await economy.updateHouseBalance(totalCost);

    user.inventory[itemId] = (user.inventory[itemId] || 0) + quantity;

    // Handle durability for tools (multiply by quantity? Usually tools are bought 1 by 1 but if someone buys 5 pickaxes?)
    // If it's a tool with durability, and they buy 5, do we add 5 * durability?
    // Current logic uses a single durability counter per item ID.
    // If user has 5 pickaxes, they share one big durability pool in this simple system.
    if (item.durability) {
        user.durability[itemId] = (user.durability[itemId] || 0) + (item.durability * quantity);
    }

    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `✅ *PURCHASE SUCCESSFUL*\n\nBought: *${quantity}x ${item.name}*\nTotal Cost: *$${totalCost.toLocaleString()}*\n\n💰 New Balance: *$${user.financials.wallet.toLocaleString()}*\n🏛️ *Tax:* Transferred to Central Bank.`
    }, { quoted: msg });
}

/* 
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

    const maxHealth = user.max_health || 100;
    invText += `\n❤️ Health: *${user.health}/${maxHealth}*\n💎 Level: *${user.level}*`;

    await sock.sendMessage(from, { text: invText }, { quoted: msg });
}

/* 
 * Sell Item
 */
async function handleSell(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args) {
        return sock.sendMessage(from, { text: "❌ Usage: .sell <item_id>" }, { quoted: msg });
    }

    const itemId = args[0].toLowerCase().trim();
    const item = SHOP_ITEMS[itemId];
    const user = await economy.getUserProfile(sender, pushName);

    if (!user.inventory[itemId] || user.inventory[itemId] <= 0) {
        return sock.sendMessage(from, { text: `❌ You don't have any *${itemId}* to sell!` }, { quoted: msg });
    }

    const sellPrice = Math.floor((item ? item.price : 100) * 0.5);
    const hasBankCard = (user.inventory.bank_card || 0) > 0;

    user.inventory[itemId] -= 1;

    if (hasBankCard) {
        user.financials.bank += sellPrice;
    } else {
        user.financials.wallet += sellPrice;
    }

    if (user.durability[itemId]) {
        user.durability[itemId] = 0; // Reset durability on sell
    }

    await economy.saveDB();

    const destination = hasBankCard ? "🏦 Bank" : "💵 Wallet";
    await sock.sendMessage(from, { text: `💵 *ITEM SOLD*\n\nYou sold 1x *${item ? item.name : itemId}* for *$${sellPrice.toLocaleString()}*.\n💰 Deposited to: *${destination}*` }, { quoted: msg });
}

/* 
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

/* 
 * Use Item from Inventory
 */
async function handleUse(msg, sock, botState, args) {
    // Delegate to new generic items handler
    return economyItems.handleUse(msg, sock, botState, args);
}

module.exports = {
    handleShop,
    handleBuy,
    handleInventory,
    handleSell,
    handleHeal,
    handleUse,
    SHOP_ITEMS // Exporting for other modules if needed (e.g., economy-items in future refactor)
};
