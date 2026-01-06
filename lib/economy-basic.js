/**
 * Economy Basic Commands
 * .balance, .daily, .work, .deposit, .withdraw
 */

const economy = require('./economy');
const economyTasks = require('./economy-tasks');
const utils = require('./utils');

/**
 * Show user balance
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleBalance(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    const total = user.wallet + user.bank;
    const xpNeeded = user.level * 100;
    const xpProgress = Math.floor((user.xp / xpNeeded) * 100);

    const balanceMsg = `💰 *${user.name}'s Balance*

💵 *Wallet:* $${user.wallet.toLocaleString()}
🏦 *Bank:* $${user.bank.toLocaleString()} / $${user.bank_capacity.toLocaleString()}
💎 *Total:* $${total.toLocaleString()}

⭐ *Level:* ${user.level}
📊 *XP:* ${user.xp}/${xpNeeded} (${xpProgress}%)
❤️ *Health:* ${user.health}/${user.max_health}`;

    await sock.sendMessage(from, { text: balanceMsg }, { quoted: msg });
}

/**
 * Daily reward
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleDaily(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    // Check cooldown
    const cooldownCheck = await economy.checkCooldown(sender, 'daily');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, {
            text: `⏰ *Daily Cooldown*\n\nYou already claimed your daily reward!\nCome back in *${timeLeft}*.`
        }, { quoted: msg });
    }

    // Load config
    const db = await economy.loadDB();
    const reward = db.config.daily_reward;

    // Give reward
    await economy.updateBalance(sender, reward, 'wallet');
    await economy.setCooldown(sender, 'daily', db.config.daily_cooldown);
    await economyTasks.trackProgress(sender, 'daily_claim');

    // Add XP
    const xpResult = await economy.addXP(sender, 10);

    let responseMsg = `🎁 *Daily Reward Claimed!*\n\n💰 *Earned:* $${reward}\n⭐ *XP:* +10`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/**
 * Work for money
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleWork(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    // Check cooldown
    const cooldownCheck = await economy.checkCooldown(sender, 'work');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, {
            text: `⏰ *Work Cooldown*\n\nYou're tired! Rest for *${timeLeft}*.`
        }, { quoted: msg });
    }

    // Load config
    const db = await economy.loadDB();
    const min = db.config.work_min;
    const max = db.config.work_max;

    // Random earnings
    const earned = Math.floor(Math.random() * (max - min + 1)) + min;

    // Random work scenarios
    const jobs = [
        `delivered pizza 🍕`,
        `washed cars 🚗`,
        `walked dogs 🐕`,
        `coded a website 💻`,
        `fixed a computer 🖥️`,
        `tutored a student 📚`,
        `mowed lawns 🌱`,
        `painted a fence 🎨`
    ];
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    // Give reward
    await economy.updateBalance(sender, earned, 'wallet');
    await economy.setCooldown(sender, 'work', db.config.work_cooldown);
    await economyTasks.trackProgress(sender, 'work');

    // Add XP
    const xpResult = await economy.addXP(sender, 15);

    // Update stats
    user.stats.total_earned += earned;
    await economy.saveDB();

    let responseMsg = `💼 *Work Complete!*\n\nYou ${job} and earned:\n💰 *$${earned}*\n⭐ *XP:* +15`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/**
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

    const user = await economy.getUserProfile(sender, pushName);

    // Parse amount
    const args = body.trim().split(/\s+/);
    if (args.length < 2) {
        return sock.sendMessage(from, {
            text: `❌ *Usage:* .deposit <amount>\n\nExample: .deposit 500`
        }, { quoted: msg });
    }

    const amountStr = args[1].toLowerCase();
    let amount;

    if (amountStr === 'all') {
        amount = user.wallet;
    } else {
        amount = parseInt(amountStr);
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, {
            text: `❌ Invalid amount! Use a number or "all".`
        }, { quoted: msg });
    }

    if (amount > user.wallet) {
        return sock.sendMessage(from, {
            text: `❌ You don't have $${amount} in your wallet!\n\n💵 *Wallet:* $${user.wallet.toLocaleString()}`
        }, { quoted: msg });
    }

    const spaceInBank = user.bank_capacity - user.bank;
    if (amount > spaceInBank) {
        return sock.sendMessage(from, {
            text: `❌ Bank capacity exceeded!\n\n🏦 *Space Available:* $${spaceInBank.toLocaleString()}\n💡 *Tip:* Level up to increase capacity!`
        }, { quoted: msg });
    }

    // Transfer
    await economy.updateBalance(sender, -amount, 'wallet');
    await economy.updateBalance(sender, amount, 'bank');

    const updatedUser = await economy.getUserProfile(sender);

    await sock.sendMessage(from, {
        text: `🏦 *Deposit Successful!*\n\n💵 Transferred: $${amount.toLocaleString()}\n\n*New Balance:*\n💵 Wallet: $${updatedUser.wallet.toLocaleString()}\n🏦 Bank: $${updatedUser.bank.toLocaleString()}`
    }, { quoted: msg });
}

/**
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

    const user = await economy.getUserProfile(sender, pushName);

    // Parse amount
    const args = body.trim().split(/\s+/);
    if (args.length < 2) {
        return sock.sendMessage(from, {
            text: `❌ *Usage:* .withdraw <amount>\n\nExample: .withdraw 500`
        }, { quoted: msg });
    }

    const amountStr = args[1].toLowerCase();
    let amount;

    if (amountStr === 'all') {
        amount = user.bank;
    } else {
        amount = parseInt(amountStr);
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, {
            text: `❌ Invalid amount! Use a number or "all".`
        }, { quoted: msg });
    }

    if (amount > user.bank) {
        return sock.sendMessage(from, {
            text: `❌ You don't have $${amount} in your bank!\n\n🏦 *Bank:* $${user.bank.toLocaleString()}`
        }, { quoted: msg });
    }

    // Transfer
    await economy.updateBalance(sender, -amount, 'bank');
    await economy.updateBalance(sender, amount, 'wallet');

    const updatedUser = await economy.getUserProfile(sender);

    await sock.sendMessage(from, {
        text: `💵 *Withdrawal Successful!*\n\n🏦 Withdrew: $${amount.toLocaleString()}\n\n*New Balance:*\n💵 Wallet: $${updatedUser.wallet.toLocaleString()}\n🏦 Bank: $${updatedUser.bank.toLocaleString()}`
    }, { quoted: msg });
}

module.exports = {
    handleBalance,
    handleDaily,
    handleWork,
    handleDeposit,
    handleWithdraw
};
