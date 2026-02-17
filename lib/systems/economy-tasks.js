/* 
 * Economy Task & Achievement System
 * Handles .tasks, .claim, and background progress tracking
 */

import fs from 'fs-extra';
import economy from './economy.js';
import utils from '../core/utils.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../database/economy.json'); // Direct DB access if needed, or via economy.js

const TASKS = {
    daily: [
        { id: 'd_fish_5', goal: 5, type: 'fish', reward: { money: 500, xp: 100 }, text: "Catch 5 fish" },
        { id: 'd_work_3', goal: 3, type: 'work', reward: { money: 300, xp: 50 }, text: "Complete 3 work shifts" },
        { id: 'd_gamble_5', goal: 5, type: 'gamble', reward: { money: 1000, xp: 150 }, text: "Participate in 5 gambles" }
    ],
    weekly: [
        { id: 'w_rob_10', goal: 10, type: 'rob_success', reward: { money: 5000, xp: 1000 }, text: "Successful robberies (10 total)" },
        { id: 'w_mine_20', goal: 20, type: 'mine', reward: { money: 3000, xp: 800 }, text: "Mine 20 times" }
    ],
    monthly: [
        { id: 'm_rich_1m', goal: 1000000, type: 'networth', reward: { money: 100000, xp: 5000, item: 'trophy_rich' }, text: "Reach $1M Net Worth" }
    ]
};

/* 
 * Display Tasks
 */
async function handleTasks(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);
    const progress = user.tasks || {};

    let txt = `📅 *MISSION BOARD* 📅\n\n`;

    // Daily
    txt += `☀️ *Daily Tasks:*\n`;
    for (const task of TASKS.daily) {
        const current = progress[task.id] || 0;
        const status = current >= task.goal ? "✅" : `${current}/${task.goal}`;
        txt += `• ${task.text}: ${status}\n`;
    }

    // Weekly
    txt += `\n🗓️ *Weekly Tasks:*\n`;
    for (const task of TASKS.weekly) {
        const current = progress[task.id] || 0;
        const status = current >= task.goal ? "✅" : `${current}/${task.goal}`;
        txt += `• ${task.text}: ${status}\n`;
    }

    txt += `\n_Type .claim to collect rewards for completed tasks._`;
    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * Claim Rewards
 */
async function handleClaim(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);
    const progress = user.tasks || {};
    const claimed = user.claimedTasks || [];

    let rewardMoney = 0;
    let rewardXP = 0;
    let claimedCount = 0;

    const allTasks = [...TASKS.daily, ...TASKS.weekly, ...TASKS.monthly];

    for (const task of allTasks) {
        const current = progress[task.id] || 0;
        if (current >= task.goal && !claimed.includes(task.id)) {
            rewardMoney += task.reward.money || 0;
            rewardXP += task.reward.xp || 0;
            user.claimedTasks.push(task.id); // Valid since by-reference or update later
            claimedCount++;
        }
    }

    if (claimedCount === 0) {
        return sock.sendMessage(from, { text: "❌ No rewards to claim!" }, { quoted: msg });
    }

    await economy.updateBalance(sender, rewardMoney, 'wallet');
    await economy.addXP(sender, rewardXP);

    // Save claimed tasks state
    await economy.saveDB();

    return sock.sendMessage(from, {
        text: `🎉 *REWARDS CLAIMED*\n\nCollected rewards for ${claimedCount} tasks:\n💰 +$${rewardMoney.toLocaleString()}\n✨ +${rewardXP} XP`
    }, { quoted: msg });
}

/* 
 * Update Progress (Internal)
 */
async function updateProgress(jid, type, amount = 1) {
    const user = await economy.getUserProfile(jid);
    if (!user.tasks) user.tasks = {};

    const allTasks = [...TASKS.daily, ...TASKS.weekly, ...TASKS.monthly];
    let updated = false;

    for (const task of allTasks) {
        if (task.type === type) {
            // Check if already completed? Maybe cap it at goal to save space?
            // Or keep counting for stats? Let's cap at goal + buffer or just count.
            const current = user.tasks[task.id] || 0;
            if (current < task.goal) {
                user.tasks[task.id] = current + amount;
                updated = true;
            }
        }
    }

    if (updated) await economy.saveDB();
}

export {
    handleTasks,
    handleClaim,
    updateProgress,
    updateProgress as trackProgress // Alias for compatibility
};

export default {
    handleTasks,
    handleClaim,
    updateProgress,
    trackProgress: updateProgress // Alias
};
