/**
 * Economy Social Module
 * Handles .rob, .gift, .leaderboard, .profile
 */

const economy = require('./economy');
const economyTasks = require('./economy-tasks');
const utils = require('./utils');
const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/economy.json');

/**
 * Steal money from another user
 */
async function handleRob(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const target = utils.parseTarget(msg, args);
    if (!target) {
        return sock.sendMessage(from, { text: "❌ Please mention or reply to the user you want to rob!\nExample: .rob @user" }, { quoted: msg });
    }

    if (target === sender) {
        return sock.sendMessage(from, { text: "🤡 You can't rob yourself!" }, { quoted: msg });
    }

    const attacker = await economy.getUserProfile(sender, pushName);
    const victim = await economy.getUserProfile(target);

    // Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'rob');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, { text: `🚨 *ROBBERY FAILED*\n\nYou're still laying low after your last job. Try again in *${timeLeft}*.` }, { quoted: msg });
    }

    // Minimum target balance
    if (victim.wallet < 100) {
        return sock.sendMessage(from, { text: `❌ This user is too poor! They need at least $100 in their wallet to be worth the risk.` }, { quoted: msg });
    }

    // Jail Check (Not implemented yet but planning)
    if (attacker.jail_until && Date.now() < attacker.jail_until) {
        const remaining = attacker.jail_until - Date.now();
        return sock.sendMessage(from, { text: `🔒 *INCARCERATED*\n\nYou're currently in jail! You'll be released in *${economy.formatTime(remaining)}*.` }, { quoted: msg });
    }

    // Risk System
    const hasShield = victim.inventory.shield > 0;
    const successRate = hasShield ? 0.2 : 0.45; // 45% success or 20% if victim has shield

    const roll = Math.random();

    if (roll < successRate) {
        // Success
        const stolenPercent = 0.1 + (Math.random() * 0.25); // 10% - 35%
        const stolen = Math.floor(victim.wallet * stolenPercent);

        victim.wallet -= stolen;
        attacker.wallet += stolen;

        attacker.stats.successful_robs = (attacker.stats.successful_robs || 0) + 1;
        victim.stats.times_robbed = (victim.stats.times_robbed || 0) + 1;

        // Track Task Progress
        await economyTasks.trackProgress(sender, 'rob_success');

        // Reward with some XP
        await economy.addXP(sender, 20);

        await economy.setCooldown(sender, 'rob', 3600000); // 1 hour cooldown
        await economy.saveDB();

        const response = `🎭 *ROBBERY SUCCESSFUL*\n\nYou snuck into @${target.split('@')[0]}'s place and snatched:\n💰 *$${stolen.toLocaleString()}*\n✨ +20 XP\n\n📈 *Stat:* You've pulled off ${attacker.stats.successful_robs} successful jobs!`;

        await sock.sendMessage(from, { text: response, mentions: [target] }, { quoted: msg });

        // Notify Victim
        await sock.sendMessage(target, { text: `🚨 *SECURITY BREECH*\n\nYou were just robbed by @${sender.split('@')[0]} in a group!\n💸 Loss: *$${stolen.toLocaleString()}*\n\n💡 Tip: Buy a 🛡️ Passive Shield to lower robbery rates!`, mentions: [sender] });

    } else {
        // Failure - Jail or Fine
        // Tweak: Reduced fine based on user feedback (10% + 200 instead of 20% + 500)
        let fine = Math.floor(attacker.wallet * 0.1) + 200;

        // Fix: Collect from bank if wallet is empty
        if (attacker.wallet < fine) {
            const extraNeeded = fine - attacker.wallet;
            attacker.wallet = 0;
            if (attacker.bank >= extraNeeded) {
                attacker.bank -= extraNeeded;
            } else {
                attacker.bank = 0; // Bankrupt
            }
        } else {
            attacker.wallet -= fine;
        }

        // 30% chance of jail on failure
        const getJailed = Math.random() < 0.3;
        let penaltyMsg = `💸 *Fine:* -$${fine.toLocaleString()} (Taken from Wallet/Bank)`;

        if (getJailed) {
            attacker.jail_until = Date.now() + 1800000; // 30 min jail
            penaltyMsg += `\n🔒 *Jailed:* 30 minutes`;
        }

        await economy.setCooldown(sender, 'rob', 1800000); // 30 min cooldown on fail
        await economy.saveDB();

        const response = `👮 *CAUGHT IN THE ACT!*\n\nYou tried to rob @${target.split('@')[0]} but the police were waiting!\n\n${penaltyMsg}`;
        await sock.sendMessage(from, { text: response, mentions: [target] }, { quoted: msg });
    }
}

/**
 * Gift money to another user
 */
async function handleGift(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const target = utils.parseTarget(msg, args);
    if (!target) {
        return sock.sendMessage(from, { text: "❌ Mention or reply to the user you want to gift!\nExample: .gift @user 1000" }, { quoted: msg });
    }
    if (target === sender) return sock.sendMessage(from, { text: "🤡 You can't gift yourself!" }, { quoted: msg });

    const amount = parseInt(args.replace(/@\d+/g, '').trim());
    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, { text: "❌ Please provide a valid amount to gift!\nExample: .gift @user 1000" }, { quoted: msg });
    }

    const giver = await economy.getUserProfile(sender, pushName);
    const receiver = await economy.getUserProfile(target);

    if (giver.wallet < amount) {
        return sock.sendMessage(from, { text: `❌ You don't have enough money in your wallet!\n💵 Balance: *$${giver.wallet.toLocaleString()}*` }, { quoted: msg });
    }

    giver.wallet -= amount;
    receiver.wallet += amount;

    await economy.saveDB();

    const response = `🎁 *GENEROUS GIFT*\n\n@${sender.split('@')[0]} sent a gift of *$${amount.toLocaleString()}* to @${target.split('@')[0]}!\n\n🤝 *Respect Points +1*`;

    await sock.sendMessage(from, { text: response, mentions: [sender, target] }, { quoted: msg });
}

/**
 * Show Leaderboard
 */
async function handleLeaderboard(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const db = await fs.readJson(DB_PATH);
    const users = db.users;

    // Sort users by total wealth (wallet + bank)
    const sorted = Object.entries(users)
        .map(([jid, data]) => ({
            jid,
            name: data.name,
            total: data.wallet + data.bank,
            level: data.level
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    let lbText = `🏆 *STARRY GLOBAL LEADERBOARD*\n\n`;

    sorted.forEach((u, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        lbText += `${medal} *${u.name}*\n`;
        lbText += `   💰 Wealth: *$${u.total.toLocaleString()}*\n`;
        lbText += `   ⭐ Level: ${u.level}\n\n`;
    });

    lbText += `_The richest 10 users in the galaxy._`;

    await sock.sendMessage(from, { text: lbText }, { quoted: msg });
}

/**
 * Show detailed profile
 */
async function handleProfile(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const target = utils.parseTarget(msg, args) || sender;

    const user = await economy.getUserProfile(target);
    const isMe = target === sender;

    let profileText = `👤 *${isMe ? 'YOUR' : user.name.toUpperCase() + "'S"} PROFILE*`;
    if (user.premium) profileText += ` 「 ✨ *PREMIUM* ✨ 」`;

    // Show Extra Titles
    if (user.titles && user.titles.length > 0) {
        profileText += `\n🎭 *Title:* ${user.titles.join(' | ')}`;
    }

    profileText += `\n\n📝 *Bio:* _${user.bio || "Exploring the cosmos..."}_\n\n`;
    profileText += `⭐ *Level:* ${user.level}\n`;
    profileText += `📊 *XP:* ${user.xp}/${user.level * 100}\n`;
    profileText += `❤️ *Health:* ${user.health}/${user.max_health}\n\n`;

    profileText += `💰 *Wallet:* $${user.wallet.toLocaleString()}\n`;
    profileText += `🏦 *Bank:* $${user.bank.toLocaleString()} / $${user.bank_capacity.toLocaleString()}\n\n`;

    profileText += `📈 *ACTIVITY STATS*\n`;
    profileText += `🎣 Fish Caught: ${user.stats.fish_caught || 0}\n`;
    profileText += `⛏️ Gems Mined: ${user.stats.gems_mined || 0}\n`;
    profileText += `🕵️ Successful Robs: ${user.stats.successful_robs || 0}\n`;
    profileText += `💀 Times Robbed: ${user.stats.times_robbed || 0}\n\n`;

    if (user.jail_until && Date.now() < user.jail_until) {
        profileText += `🔒 *STATUS:* Incarcerated (Exits: ${economy.formatTime(user.jail_until - Date.now())})`;
    } else {
        profileText += `🟢 *STATUS:* Free To Roam`;
    }

    await sock.sendMessage(from, { text: profileText, mentions: [target] }, { quoted: msg });
}

/**
 * Set custom RPG name
 */
async function handleSetName(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args || args.trim().length < 3) {
        return sock.sendMessage(from, { text: "❌ Please provide a name (3-15 characters)!\nExample: .name ShadowHunter" }, { quoted: msg });
    }

    const newName = args.trim().split(/\s+/)[0]; // No spaces in RPG names
    if (newName.length > 15) {
        return sock.sendMessage(from, { text: "❌ Name too long! (Max 15 characters)" }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    const hasIdCard = (user.inventory.idcard || 0) > 0;
    const isFirstTime = !user.stats.name_changes || user.stats.name_changes === 0;

    // First time is free, subsequent changes $5000
    let cost = isFirstTime ? 0 : 5000;
    let usedItem = false;

    if (hasIdCard) {
        cost = 0;
        usedItem = true;
    } else if (user.wallet < cost) {
        const costType = isFirstTime ? "initial registration" : "name change fee";
        return sock.sendMessage(from, { text: `❌ You need *$${cost.toLocaleString()}* for the ${costType}!\n💡 Tip: Buy an 🆔 Identity Card in the .shop for a cheaper change!` }, { quoted: msg });
    }

    // Process payment/item
    if (usedItem) {
        user.inventory.idcard -= 1;
    } else {
        user.wallet -= cost;
    }

    const oldName = user.name;
    await economy.setRPGName(sender, newName);

    let successMsg = `🎉 *IDENTITY UPDATED*\n\n`;
    if (usedItem) {
        successMsg += `Used: *🆔 Identity Card*\n`;
    } else {
        successMsg += `Paid: *$${cost.toLocaleString()}*\n`;
    }
    successMsg += `Old Name: *${oldName}*\nNew Name: *${newName}*\n\n_Your new identity is now reflected in the leaderboard!_`;

    await sock.sendMessage(from, { text: successMsg }, { quoted: msg });
}

/**
 * Set custom RPG bio
 */
async function handleSetBio(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    if (!args || args.trim().length < 5) {
        return sock.sendMessage(from, { text: "❌ Please provide a bio (min 5 characters)!\nExample: .setbio Loving the Starry experience!" }, { quoted: msg });
    }

    if (args.length > 100) {
        return sock.sendMessage(from, { text: "❌ Bio too long! (Max 100 characters)" }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    user.bio = args.trim();

    await economy.saveDB();

    await sock.sendMessage(from, { text: `📝 *BIO UPDATED*\n\nYour profile bio has been updated successfully!` }, { quoted: msg });
}

module.exports = {
    handleRob,
    handleGift,
    handleLeaderboard,
    handleProfile,
    handleSetName,
    handleSetBio
};
