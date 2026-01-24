/* 
 * Economy Basic Commands
 * .balance, .daily, .work, .deposit, .withdraw
 */

const economy = require('./economy');
const economyTasks = require('./economy-tasks');
const economyWorld = require('./economy-world');
const economyCards = require('./economy-cards');
const economyAssets = require('./economy-assets');
const utils = require('./utils');
const config = require('../config');

/*
 * Show user balance - Starry Multiverse Edition
 */
async function handleBalance(msg, sock, botState) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);
    const pushName = msg.pushName || "User";

    if (!economy.isRegistered(sender)) {
        return sock.sendMessage(from, { text: "⚠️ *UNREGISTERED ENTITY*\n\nYou are not indexed in the Multiverse. Type `.spawn` to begin your journey." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const fin = user.financials;
    const stats = user.stats;

    const total = fin.wallet + fin.bank;
    const xpNeeded = stats.level * 1000;
    const xpProgress = Math.floor((stats.xp / xpNeeded) * 100);
    const hasBankCard = user.inventory.debit_card > 0;

    const balanceMsg = `🌌 *${user.name}'s Identity*
📍 *Location:* ${user.location}
${economyCards.ROLES[user.role]?.emoji || "🎖️"} *Role:* ${user.role}

💵 *Wallet:* $${fin.wallet.toLocaleString()}
🏦 *Bank:* $${fin.bank.toLocaleString()} / $${fin.bank_capacity.toLocaleString()}
💰 *Net Worth:* $${total.toLocaleString()}

${hasBankCard ? "💳 *Debit Card:* LINKED\n" : "⚠️ *Debit Card:* NOT FOUND\n"}
⭐ *Level:* ${stats.level}
📊 *XP:* ${stats.xp}/${xpNeeded} (${xpProgress}%)
❤️ *Health:* ${stats.health}/100`;

    await sock.sendMessage(from, { text: balanceMsg }, { quoted: msg });
}

/*
 * MMORPG Onboarding
 */
async function handleSpawn(msg, sock, botState, args) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);
    const pushName = msg.pushName || "User";

    // Block 'spawn diamond' attempts
    if (args && args[0] && (args[0].toLowerCase() === 'diamond' || args[0].toLowerCase() === 'chaos')) {
        return sock.sendMessage(from, {
            text: "❌ *ACCESS DENIED*\n\nChaos Diamonds cannot be manually spawned. They manifest randomly in active sectors (Groups)."
        }, { quoted: msg });
    }

    if (economy.isRegistered(sender)) {
        return sock.sendMessage(from, { text: "❌ *ACCESS DENIED*\n\nYou have already materialized in this simulation." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);

    const spawnMsg = `✨ *MATERIALIZATION COMPLETE* ✨

Welcome to * The Starry Multiverse* , @${sender.split('@')[0]}!

📇 *Citizen ID Card:* ISSUED
💵 *Starter Cash:* $1,000
🌍 *Starting Location:* Earth

* Your Mission:* 
1. Work jobs (.work) or mine (.mine) to earn money.
2. Buy properties to increase bank capacity.
3. Purchase vehicles to reach Mars or Cyber City.
4. Beware of thieves... or become one.

Type * .menu* to see all commands.
Good luck, Citizen.`;

    await sock.sendMessage(from, { text: spawnMsg, mentions: [sender] }, { quoted: msg });
}
/* 
 * Daily reward
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleDaily(msg, sock, botState) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);
    const pushName = msg.pushName || "User";

    if (!economy.isRegistered(sender)) {
        return sock.sendMessage(from, { text: "⚠️ *UNREGISTERED ENTITY*\n\nType `.spawn` to begin your journey." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const cooldownData = await economy.checkCooldown(sender, 'daily');

    if (cooldownData.onCooldown) {
        return sock.sendMessage(from, {
            text: `⏰ *Daily Cooldown*\n\nYou already claimed your solar stimulus!\nCome back in *${economy.formatTime(cooldownData.remaining)}*.`
        }, { quoted: msg });
    }

    const db = await economy.loadDB();
    const now = Date.now();

    // Apply Planetary Physics
    const locData = economyWorld.LOCATIONS[user.location] || economyWorld.LOCATIONS["Earth"];
    const baseReward = db.config.daily_reward;
    const locMultiplier = locData.multiplier || 1.0;
    const roleMultiplier = economyCards.getRoleMultiplier(user, 'work'); // Daily also benefits from work buffs

    let reward = Math.floor(baseReward * locMultiplier * roleMultiplier);

    // --- REAL ESTATE PASSIVE INCOME ---
    const propId = user.assets.property || "prop_box";
    const propIncome = economyAssets.PROPERTIES[propId]?.income || 0;
    reward += propIncome;

    await economy.updateBalance(sender, reward, 'wallet');
    economy.setCooldown(sender, 'daily', db.config.daily_cooldown);
    await economy.saveDB();

    const xpResult = await economy.addXP(sender, Math.floor(100 * locMultiplier * roleMultiplier));

    let responseMsg = `🎁 *Solar Stimulus Claimed: ${user.location}*\n\n💰 *Base Reward:* $${(reward - propIncome).toLocaleString()}\n🏠 *Property Income:* $${propIncome.toLocaleString()}\n━━━━━━━━━━━━━━━━━━\n💰 *Total Received:* $${reward.toLocaleString()}\n⭐ *XP:* +${Math.floor(100 * locMultiplier * roleMultiplier)}`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/* 
 * Work for money
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleWork(msg, sock, botState) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);
    const pushName = msg.pushName || "User";

    if (!economy.isRegistered(sender)) {
        return sock.sendMessage(from, { text: "⚠️ *UNREGISTERED ENTITY*\n\nType `.spawn` to begin your journey." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const cooldownData = await economy.checkCooldown(sender, 'work');

    if (cooldownData.onCooldown) {
        return sock.sendMessage(from, {
            text: `⏰ *Energy Low*\n\nYou're exhausted! Rest for *${economy.formatTime(cooldownData.remaining)}*.`
        }, { quoted: msg });
    }

    const db = await economy.loadDB();
    const min = db.config.work_min;
    const max = db.config.work_max;

    // Apply Planetary Physics & Role Buffs
    const locData = economyWorld.LOCATIONS[user.location] || economyWorld.LOCATIONS["Earth"];
    const baseEarned = Math.floor(Math.random() * (max - min + 1)) + min;
    const locMultiplier = locData.multiplier || 1.0;
    const roleMultiplier = economyCards.getRoleMultiplier(user, 'work');
    const taxMultiplier = economyCards.getRoleMultiplier(user, 'tax');

    const grossEarned = Math.floor(baseEarned * locMultiplier * roleMultiplier);
    const currentTaxRate = (locData.tax || 0.0) * taxMultiplier;
    const taxAmount = Math.floor(grossEarned * currentTaxRate);
    const netEarned = grossEarned - taxAmount;

    const jobs = [
        `mining helium-3 on the moon 🌙`,
        `repairing a warp drive 🚀`,
        `delivering cargo to Mars 📦`,
        `hacking a neural network 💻`,
        `escorting a merchant through Earth's orbit 🛸`,
        `scavenging ship parts in the Void 🛡️`
    ];
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    await economy.updateBalance(sender, netEarned, 'wallet');
    economy.setCooldown(sender, 'work', db.config.work_cooldown);
    await economy.saveDB();

    const xpResult = await economy.addXP(sender, Math.floor(150 * locMultiplier * roleMultiplier));

    let responseMsg = `💼 *Shift Complete: ${user.location}*\n\nYou were ${job} and earned:\n💰 *$${netEarned.toLocaleString()}*`;

    if (taxAmount > 0) {
        responseMsg += `\n💸 *Tax Paid:* $${taxAmount.toLocaleString()} (${(currentTaxRate * 100).toFixed(0)}%)`;
    }

    responseMsg += `\n⭐ *XP:* +${Math.floor(150 * locMultiplier * roleMultiplier)}`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/* 
 * Deposit money to bank
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleDeposit(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (!economy.isRegistered(sender)) {
        return sock.sendMessage(from, { text: "⚠️ *UNREGISTERED ENTITY*\n\nType `.spawn` to begin your journey." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const fin = user.financials;

    const args = body.trim().split(/\s+/);
    if (args.length < 2) {
        return sock.sendMessage(from, { text: `❌ *Usage:* .deposit <amount>` }, { quoted: msg });
    }

    const amountStr = args[1];
    let amount = amountStr.toLowerCase() === 'all' ? fin.wallet : utils.parseNumber(amountStr);

    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, { text: `❌ Invalid amount!` }, { quoted: msg });
    }

    if (amount > fin.wallet) {
        return sock.sendMessage(from, { text: `❌ Insufficient wallet funds!\n💵 *Wallet:* $${fin.wallet.toLocaleString()}` }, { quoted: msg });
    }

    const spaceInBank = fin.bank_capacity - fin.bank;
    if (amount > spaceInBank) {
        return sock.sendMessage(from, { text: `❌ Bank Capacity Reached!\n🏦 *Available Space:* $${spaceInBank.toLocaleString()}\n💡 Upgrade your * Property* to store more.` }, { quoted: msg });
    }

    fin.wallet -= amount;
    fin.bank += amount;
    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `🏦 *SECURE DEPOSIT COMPLETE*\n\n💵 Transferred: $${amount.toLocaleString()}\n\n*Updated Balance:*\n💵 Wallet: $${fin.wallet.toLocaleString()}\n🏦 Bank: $${fin.bank.toLocaleString()}`
    }, { quoted: msg });
}

/* 
 * Withdraw money from bank
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleWithdraw(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (!economy.isRegistered(sender)) {
        return sock.sendMessage(from, { text: "⚠️ *UNREGISTERED ENTITY*\n\nType `.spawn` to begin your journey." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const fin = user.financials;

    const args = body.trim().split(/\s+/);
    if (args.length < 2) {
        return sock.sendMessage(from, { text: `❌ *Usage:* .withdraw <amount>` }, { quoted: msg });
    }

    const amountStr = args[1];
    let amount = amountStr.toLowerCase() === 'all' ? fin.bank : utils.parseNumber(amountStr);

    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, { text: `❌ Invalid amount!` }, { quoted: msg });
    }

    if (amount > fin.bank) {
        return sock.sendMessage(from, { text: `❌ Insufficient bank funds!\n🏦 *Bank:* $${fin.bank.toLocaleString()}` }, { quoted: msg });
    }

    fin.bank -= amount;
    fin.wallet += amount;
    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `🏦 *WITHDRAWAL COMPLETE*\n\n💵 Received: $${amount.toLocaleString()}\n\n*Updated Balance:*\n💵 Wallet: $${fin.wallet.toLocaleString()}\n🏦 Bank: $${fin.bank.toLocaleString()}`
    }, { quoted: msg });
}

/* 
 * MMORPG Loan System (.loan)
 */
async function handleLoan(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);
    const args = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim().split(/\s+/);

    if (args.length < 2) {
        return sock.sendMessage(from, {
            text: `🏦 *GALACTIC LOAN OFFICE*\n\n- * .loan <amount>* : Request a loan (Max: $${(user.stats.level * 10000).toLocaleString()})\n- * .loan pay* : Repay your debt.\n\n*Interest Rate:* 10% per Earth cycle. Unpaid debt leads to asset seizure.`
        }, { quoted: msg });
    }

    if (args[1].toLowerCase() === 'pay') {
        if (user.financials.debt <= 0) return sock.sendMessage(from, { text: "✅ You have no outstanding debt." }, { quoted: msg });

        const debt = user.financials.debt;
        const success = await economy.makePayment(sender, debt);
        if (success) {
            user.financials.debt = 0;
            await economy.saveDB();
            return sock.sendMessage(from, { text: `✅ *DEBT SETTLED*\n\nYou paid off your loan of $${debt.toLocaleString()}.` }, { quoted: msg });
        } else {
            return sock.sendMessage(from, { text: `❌ *PAYMENT FAILED*\n\nYou don't have enough funds in your Wallet or Bank to settle your $${debt.toLocaleString()} debt.` }, { quoted: msg });
        }
    }

    const amount = utils.parseNumber(args[1]);
    if (isNaN(amount) || amount <= 0) return sock.sendMessage(from, { text: "❌ Invalid loan amount." }, { quoted: msg });

    const maxLoan = user.stats.level * 10000;
    if (amount > maxLoan) return sock.sendMessage(from, { text: `❌ *LOAN REJECTED*\n\nBased on your level (${user.stats.level}), your max credit is $${maxLoan.toLocaleString()}.` }, { quoted: msg });

    if (user.financials.debt > 0) return sock.sendMessage(from, { text: `❌ *LOAN REJECTED*\n\nYou already have an active loan of $${user.financials.debt.toLocaleString()}. Pay it back first.` }, { quoted: msg });

    const interest = Math.floor(amount * 0.1);
    user.financials.wallet += amount;
    user.financials.debt = amount + interest;
    await economy.saveDB();

    await sock.sendMessage(from, {
        text: `🏦 *LOAN APPROVED*\n\n💰 *Received:* $${amount.toLocaleString()}\n💸 *Debt to Repay:* $${(amount + interest).toLocaleString()} (incl. 10% interest)\n\n*Note:* Use * .loan pay* to settle up.`
    }, { quoted: msg });
}

/* 
 * The Guide (.guide)
 */
async function handleGuide(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const topic = args && args.length > 0 ? args[0].toLowerCase() : "index";

    const guides = {
        "index": `
📖 *STARRY MULTIVERSE GUIDE* 📖
━━━━━━━━━━━━━━━━━━━━━
Choose a topic to learn more:
- * .guide economy* (Money & Banking)
- * .guide world* (Planets & Travel)
- * .guide roles* (Police, Thieves, etc.)
- * .guide assets* (Properties & Vehicles)
- * .guide chaos* (Diamond Events)

Type \`.guide <topic>\` for details.
`,
        "economy": `
🏦 *ECONOMY 101*
- * Wallet:* Cash you carry. Can be robbed if you die.
- * Bank:* Safe storage. Capacity is limited by your Property.
- * Debit Card:* Allows spending from Bank if Wallet is empty.
- * Taxes:* Earth has a 5% trade tax on all earnings.
`,
        "world": `
🌌 *GALACTIC MAP*
- * Earth:* Start point. 5% Tax. Normal yields.
- * Mars:* High Mining yield (3x). No water for fishing.
- * Cyber City:* Crime heaven. Higher rewards for illicit acts.
- * The Void:* Pure chaos. Only for the brave.
`,
        "roles": `
🎖️ *ROLES & IDENTITY* (Phase 3)
Your Role determines your multipliers.
- * Citizen:* Balanced stats.
- * Police:* Can arrest thieves. Low work multiplier.
- * Thief:* Higher robbery success. Can be jailed.
- * Merchant:* Lower taxes, higher work yields.
`,
        "assets": `
🏘️ *PROPERTIES & TRANSPORT*
- * Properties:* Store your wealth. Each upgrade increases Bank Capacity.
- * Vehicles:* Rockets and Ships are required to leave Earth's orbit.
`,
        "chaos": `
💎 *THE CHAOS DIAMONDS*
A rare event where a Chaos Diamond spawns. The first to find it gains immense power or wealth. Expect heavy resistance.
`
    };

    const text = guides[topic] || guides["index"];
    await sock.sendMessage(from, { text: text.trim() }, { quoted: msg });
}

/* 
 * Update Alert (.update)
 */
async function handleUpdateAlert(msg, sock, botState) {
    const from = msg.key.remoteJid;

    // Check for pre-written update note
    let updateMsg = "";
    try {
        const fs = require('fs-extra');
        if (fs.existsSync('./database/update_log.txt')) {
            updateMsg = fs.readFileSync('./database/update_log.txt', 'utf8');
        } else {
            // Fallback default
            updateMsg = `🚀 *STARRY MULTIVERSE: UPDATE V2.0* 🚀\n━━━━━━━━━━━━━━━━━━━━━\n\n✨ * NEW FEATURES:* \n- 💎 * Chaos Diamonds:* Rare artifacts spawning in the system.\n- 🚨 * The Purge:* Global events where laws are suspended.\n- 💳 * Galactic Loans:* Borrow money (with interest!).\n- 🏘️ * Real Estate:* Buy properties to store more Bank stats.\n\nType * .guide* for the full manual.`;
        }
    } catch (e) {
        updateMsg = "⚠️ Update log not found.";
    }

    await sock.sendMessage(from, { text: updateMsg }, { quoted: msg });
}

module.exports = {
    handleBalance,
    handleSpawn,
    handleGuide,
    handleUpdateAlert,
    handleMap: economyWorld.handleMap,
    handleDaily,
    handleWork,
    handleDeposit,
    handleWithdraw,
    handleLoan,
    handleRob: require('./economy-activities').handleRob
};
