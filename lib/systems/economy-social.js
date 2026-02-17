/* 
 * Economy Social Module
 * Handles .rob, .gift, .leaderboard, .profile
 */

import economy from './economy.js';
import economyTasks from './economy-tasks.js';
import utils from '../core/utils.js';
import economyShop from './economy-shop.js'; // Import shop for item details
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../database/economy.json');

/* 
 * Steal money from another user
 */
async function handleRob(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: `.rob @user`" }, { quoted: msg });
    }

    const target = utils.parseTarget(msg, args);
    if (!target) return sock.sendMessage(from, { text: "❌ Mention a user to rob!" }, { quoted: msg });
    if (target === sender) return sock.sendMessage(from, { text: "❌ You cannot rob yourself!" }, { quoted: msg });
    if (target === utils.decodeJid(sock.user.id)) return sock.sendMessage(from, { text: "❌ You cannot rob the System." }, { quoted: msg });

    // Check Cooldown
    const lastRob = await economy.getCooldown(sender, 'rob');
    const now = Date.now();
    const cooldownTime = 60 * 60 * 1000; // 1 Hour

    if (now - lastRob < cooldownTime) {
        return sock.sendMessage(from, { text: `⏳ *COOLDOWN:* You can rob again in ${utils.formatTime(cooldownTime - (now - lastRob))}.` }, { quoted: msg });
    }

    // Victim Balance Check
    const victimBal = await economy.getBalance(target, 'wallet');
    if (victimBal < 500) {
        return sock.sendMessage(from, { text: "⚠️ This user is too poor to rob! (Min $500)" }, { quoted: msg });
    }

    // Robbery Logic (50% Chance)
    const success = Math.random() > 0.5;

    if (success) {
        // Steal 10-30% of wallet
        const percent = (Math.random() * 0.2) + 0.1;
        const stolen = Math.floor(victimBal * percent);

        await economy.updateBalance(target, -stolen, 'wallet');
        await economy.updateBalance(sender, stolen, 'wallet');

        await economy.setCooldown(sender, 'rob');

        return sock.sendMessage(from, {
            text: `🔫 *ROBBERY SUCCESSFUL*\n\nYou stole *$${stolen}* from @${target.split('@')[0]}!\nRun before the cops come! 🏃‍♂️💨`,
            mentions: [sender, target]
        }, { quoted: msg });
    } else {
        // Fail: Lose $500 fine
        const fine = 500;
        await economy.updateBalance(sender, -fine, 'wallet');
        await economy.setCooldown(sender, 'rob');

        return sock.sendMessage(from, {
            text: `🚓 *BUSTED*\n\nYou failed to rob @${target.split('@')[0]} and paid a *$${fine}* fine to the police.`,
            mentions: [sender, target]
        }, { quoted: msg });
    }
}

/* 
 * Gift money/items to another user
 */
async function handleGift(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args || args.length < 2) {
        return sock.sendMessage(from, { text: "❌ Usage: `.gift @user <amount>` or `.gift @user <item_id> (Not implemented yet)`" }, { quoted: msg });
    }

    const target = utils.parseTarget(msg, args);
    if (!target) return sock.sendMessage(from, { text: "❌ Mention a user to gift!" }, { quoted: msg });
    if (target === sender) return sock.sendMessage(from, { text: "❌ You cannot gift yourself!" }, { quoted: msg });

    const amount = utils.parseNumber(args.find(a => /^\d+$/.test(a)));
    if (!amount || amount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount!" }, { quoted: msg });

    const senderBal = await economy.getBalance(sender, 'wallet');
    if (senderBal < amount) return sock.sendMessage(from, { text: utils.ui.error("Insufficient funds in wallet!") }, { quoted: msg });

    await economy.updateBalance(sender, -amount, 'wallet');
    await economy.updateBalance(target, amount, 'wallet');

    return sock.sendMessage(from, {
        text: `🎁 *GIFT SENT*\n\nYou gave *$${amount.toLocaleString()}* to @${target.split('@')[0]}.`,
        mentions: [sender, target]
    }, { quoted: msg });
}

/* 
 * Global Leaderboard
 */
async function handleLeaderboard(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    const data = await fs.readJson(DB_PATH, { throws: false }) || {};
    const users = Object.keys(data).filter(k => k.endsWith('@s.whatsapp.net'));

    const leaderboard = users.map(u => {
        const p = data[u];
        const netWorth = (p.wallet || 0) + (p.bank || 0);
        return { jid: u, netWorth, name: p.name || u.split('@')[0] };
    });

    leaderboard.sort((a, b) => b.netWorth - a.netWorth);
    const top10 = leaderboard.slice(0, 10);

    let txt = `🏆 *GALACTIC LEADERBOARD* 🏆\n\n`;
    top10.forEach((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        txt += `${medal} *${u.name}*: $${u.netWorth.toLocaleString()}\n`;
    });

    // User Rank
    const rank = leaderboard.findIndex(u => u.jid === sender) + 1;
    txt += `\n👤 *Your Rank:* #${rank}`;

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * User Profile (RPG Style)
 */
async function handleProfile(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    let target = utils.parseTarget(msg, args) || (msg.key.participant || from);

    const profile = await economy.getUserProfile(target);
    const netWorth = profile.financials.wallet + profile.financials.bank;

    // Billing check (visual only here, process handled separately)
    const nextBill = new Date((profile.stats.last_billing || Date.now()) + (7 * 24 * 60 * 60 * 1000));

    const txt = `👤 *PILOT PROFILE: @${target.split('@')[0]}*\n\n` +
        `💰 *Net Worth:* $${netWorth.toLocaleString()}\n` +
        `💳 *Wallet:* $${profile.financials.wallet.toLocaleString()}\n` +
        `🏦 *Bank:* $${profile.financials.bank.toLocaleString()}\n` +
        `📉 *Debt:* $${profile.financials.debt.toLocaleString()}\n\n` +
        `🎖️ *Level:* ${profile.xp.level} | *XP:* ${profile.xp.current}/${profile.xp.next}\n` +
        `🏠 *Property:* ${profile.assets.property}\n` +
        `📅 *Next Bill:* ${nextBill.toLocaleDateString()}\n\n` +
        `_Type .inventory for items._`;

    await sock.sendMessage(from, { text: txt, mentions: [target] }, { quoted: msg });
}

/*
 * View Cooldowns
 */
async function handleCooldowns(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);
    const now = Date.now();

    const cds = user.cooldowns || {};
    let txt = `⏱️ *YOUR COOLDOWNS*\n\n`;

    // Map of command -> duration (ms)
    // We should ideally import this from tasks, but hardcoding for display is fast
    const limits = {
        work: 15 * 60 * 1000,
        daily: 24 * 60 * 60 * 1000,
        rob: 60 * 60 * 1000,
        mine: 30 * 60 * 1000 // example
    };

    let count = 0;
    for (const [cmd, time] of Object.entries(cds)) {
        const limit = limits[cmd] || 0;
        const readyAt = time + limit;
        if (readyAt > now) {
            txt += `• *${cmd.toUpperCase()}:* ${utils.formatTime(readyAt - now)}\n`;
            count++;
        }
    }

    if (count === 0) txt += "✅ All commands are ready!";

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * Census (Admins Only) - Count registered users
 */
async function handleCensus(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const data = await fs.readJson(DB_PATH, { throws: false }) || {};
    const count = Object.keys(data).filter(k => k.endsWith('@s.whatsapp.net')).length;

    await sock.sendMessage(from, { text: `👥 *POPULATION CENSUS*\n\nRegistered Pilots: *${count}*` }, { quoted: msg });
}

/*
 * Investor Leaderboard (Separate from main)
 */
async function handleInvestorLeaderboard(msg, sock, botState) {
    // Placeholder command
    return sock.sendMessage(msg.key.remoteJid, { text: "🚧 *Wall Street Under Construction*" });
}

export default {
    handleRob,
    handleGift,
    handleLeaderboard,
    handleProfile,
    handleCooldowns,
    handleCensus,
    handleInvestorLeaderboard
};