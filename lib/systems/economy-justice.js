/* 
 * Economy Justice Module
 * Handles .arrest, .bail, .escape, and .bounties
 */

import economy from './economy.js';
import economyCards from './economy-cards.js';
import utils from '../core/utils.js';

/* 
 * Arrest Logic (.arrest @user)
 * Police can arrest wanted criminals
 */
async function handleArrest(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    // 1. Role Check: Must be Police (Role/Badge) or have Handcuffs
    const isPolice = user.role === 'Police' || (user.inventory.badge_police && user.inventory.badge_police > 0);
    const hasHandcuffs = user.inventory.handcuffs && user.inventory.handcuffs > 0;

    if (!isPolice && !hasHandcuffs) {
        return sock.sendMessage(from, { text: "❌ *ACCESS DENIED*\n\nOnly *Police Officers* or citizens with **Handcuffs** can make arrests." }, { quoted: msg });
    }

    // 2. Target Check
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = mentioned[0];

    if (!targetJid) return sock.sendMessage(from, { text: "❌ Usage: .arrest @user" }, { quoted: msg });
    if (targetJid === sender) return sock.sendMessage(from, { text: "🧠 You cannot arrest yourself." }, { quoted: msg });

    const target = await economy.getUserProfile(targetJid);
    if (target.jail_until > Date.now()) {
        return sock.sendMessage(from, { text: "⚠️ This user is already in jail!" }, { quoted: msg });
    }

    // 3. Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'arrest');
    if (cooldownCheck.onCooldown) {
        return sock.sendMessage(from, { text: `⏰ *Cooldown Active*\n\nYou need to file paperwork. Wait *${economy.formatTime(cooldownCheck.remaining)}*.` }, { quoted: msg });
    }

    // 4. Arrest Mechanics (RNG + Stats)
    // Police Bonus: +30% Success
    // Handcuffs: +10% Success
    // Target Strength (Def Multiplier) reduces success

    let successRate = 0.50; // Base 50%
    if (isPolice) successRate += 0.30;
    if (user.inventory.handcuffs > 0) successRate += 0.10;

    const targetDef = await economyCards.getRoleMultiplier(target.jid, 'rob_defense');

    const finalProb = Math.min(0.95, successRate / targetDef);

    const success = Math.random() < finalProb;

    if (success) {
        // Successful Arrest
        const jailTime = 1800000; // 30 Minutes
        target.jail_until = Date.now() + jailTime;

        // Consume Handcuffs for Citizens
        if (!isPolice) {
            user.inventory.handcuffs = (user.inventory.handcuffs || 0) - 1;
        }

        // Reward for Officer
        const bounty = 10000; // Increased to $10k
        await economy.updateBalance(sender, bounty, 'bank');
        await economy.updateHouseBalance(-bounty); // House pays the bounty

        await economy.setCooldown(sender, 'arrest', 600000); // 10 min cooldown
        await economy.saveDB();

        return sock.sendMessage(from, {
            text: `🚨 *ARREST SUCCESSFUL* 🚨\n\nOfficer @${sender.split('@')[0]} has arrested @${targetJid.split('@')[0]}!\n\n👮 *Reward:* $${bounty.toLocaleString()}\n🔒 *Sentence:* 30 Minutes\n\n_Justice is served._`,
            mentions: [sender, targetJid]
        }, { quoted: msg });

    } else {
        // Failed Arrest
        // Fine: 5% of Wallet (Min $2500, Max $50k)
        const percentFine = Math.floor(user.financials.wallet * 0.05);
        const fine = Math.max(2500, Math.min(percentFine, 50000));

        user.financials.wallet -= fine;
        if (user.financials.wallet < 0) user.financials.wallet = 0;

        await economy.updateBalance(sender, -fine, 'wallet'); // Ensure sync
        await economy.distributeFine(fine); // Goes to house/police fund

        await economy.setCooldown(sender, 'arrest', 300000); // 5 min shame cooldown
        await economy.saveDB(); // Save fine

        return sock.sendMessage(from, {
            text: `💨 *ARREST FAILED*\n\n@${targetJid.split('@')[0]} slipped away!\n\n💸 *Penalty:* $${fine.toLocaleString()} deducted for failed procedure.`,
            mentions: [sender, targetJid]
        }, { quoted: msg });
    }
}

/* 
 * Bail Logic (.bail)
 * Pay to get out of jail
 */
async function handleBail(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    if (!user.jail_until || user.jail_until <= Date.now()) {
        return sock.sendMessage(from, { text: "🔓 You are not in jail. Stay clean!" }, { quoted: msg });
    }

    const bailAmount = 50000; // Expensive!
    const totalFunds = user.financials.wallet + user.financials.bank;

    if (totalFunds < bailAmount) {
        return sock.sendMessage(from, { text: `❌ *BAIL DENIED*\n\nJudge says: "$${bailAmount.toLocaleString()} or rot!"\n💰 You have: $${totalFunds.toLocaleString()}` }, { quoted: msg });
    }

    // Pay Bail
    if (user.financials.wallet >= bailAmount) {
        user.financials.wallet -= bailAmount;
    } else {
        const rem = bailAmount - user.financials.wallet;
        user.financials.wallet = 0;
        user.financials.bank -= rem;
    }

    await economy.updateHouseBalance(bailAmount); // Bail goes to House
    user.jail_until = 0; // Free
    await economy.saveDB();

    return sock.sendMessage(from, { text: `🔓 *BAIL POSTED*\n\nYou paid *$${bailAmount.toLocaleString()}* and are now free.\n\n_Don't make me see you here again._` }, { quoted: msg });
}

/* 
 * Escape Logic (.escape)
 * Risky way to get out
 */
async function handleEscape(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    if (!user.jail_until || user.jail_until <= Date.now()) {
        return sock.sendMessage(from, { text: "🔓 You are not in jail. No need to run." }, { quoted: msg });
    }

    // Cooldown on escape attempts to prevent spamming
    const cooldownCheck = await economy.checkCooldown(sender, 'escape');
    if (cooldownCheck.onCooldown) {
        return sock.sendMessage(from, { text: "🧱 Guards are watching closely. Wait a bit." }, { quoted: msg });
    }

    // 10% Chance Base
    const escapeChance = 0.10;
    const success = Math.random() < escapeChance;

    if (success) {
        user.jail_until = 0;
        await economy.saveDB();
        return sock.sendMessage(from, { text: `🏃💨 *PRISON BREAK!*\n\nYou successfully escaped from jail! You are now a fugitive.` }, { quoted: msg });
    } else {
        // Fail: Add 30 more minutes
        user.jail_until += 1800000;
        await economy.setCooldown(sender, 'escape', 300000); // 5 min cooldown
        await economy.saveDB();
        return sock.sendMessage(from, { text: `🚨 *CAUGHT!*\n\nThe guards beat you up and added *30 Minutes* to your sentence.\n🔒 Remaining: ${economy.formatTime(user.jail_until - Date.now())}` }, { quoted: msg });
    }
}

export default {
    handleArrest,
    handleBail,
    handleEscape
};


