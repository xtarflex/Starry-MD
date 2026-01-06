/**
 * Economy Task & Achievement System
 * Handles .tasks, .claim, and background progress tracking
 */

const fs = require('fs-extra');
const economy = require('./economy');
const utils = require('./utils');

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
        { id: 'm_loyal', goal: 20, type: 'daily_claim', reward: { money: 50000, title: "Celestial Legend 👑" }, text: "Claim daily reward 20 times" }
    ]
};

module.exports = {
    /**
     * .tasks (View current tasks)
     */
    handleTasks: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const pushName = msg.pushName || "User";

        const user = await economy.getUserProfile(sender, pushName);
        if (!user.tasks) user.tasks = { progress: {}, completed: [] };

        let taskText = `🎯 *STARRY MISSION CENTER* 🎯\n\n`;

        // Daily
        taskText += `📅 *DAILY TASKS*\n`;
        TASKS.daily.forEach(t => {
            const prog = user.tasks.progress[t.id] || 0;
            const done = user.tasks.completed.includes(t.id);
            taskText += `${done ? '✅' : '⏳'} *${t.text}*\n   Progress: ${prog}/${t.goal} | Reward: $${t.reward.money}\n`;
        });

        taskText += `\n🗓️ *WEEKLY TASKS*\n`;
        TASKS.weekly.forEach(t => {
            const prog = user.tasks.progress[t.id] || 0;
            const done = user.tasks.completed.includes(t.id);
            taskText += `${done ? '✅' : '⏳'} *${t.text}*\n   Progress: ${prog}/${t.goal} | Reward: $${t.reward.money}\n`;
        });

        taskText += `\n🌌 *MONTHLY MILESTONES*\n`;
        TASKS.monthly.forEach(t => {
            const prog = user.tasks.progress[t.id] || 0;
            const done = user.tasks.completed.includes(t.id);
            taskText += `${done ? '✅' : '⏳'} *${t.text}*\n   Progress: ${prog}/${t.goal} | Reward: ${t.reward.title || '$' + t.reward.money}\n`;
        });

        taskText += `\n_Type .claim <task_id> to get rewards!_`;

        await sock.sendMessage(from, { text: utils.autoReadMore(taskText) }, { quoted: msg });
    },

    /**
     * Increment Task Progress
     */
    trackProgress: async (jid, type, amount = 1) => {
        const user = await economy.getUserProfile(jid);
        if (!user.tasks) user.tasks = { progress: {}, completed: [] };

        const allTasks = [...TASKS.daily, ...TASKS.weekly, ...TASKS.monthly];
        let updated = false;

        allTasks.forEach(task => {
            if (task.type === type && !user.tasks.completed.includes(task.id)) {
                user.tasks.progress[task.id] = (user.tasks.progress[task.id] || 0) + amount;
                updated = true;

                // Optional: Auto-notify if complete? 
                // We'll let them check with .tasks for now to avoid spam.
            }
        });

        if (updated) await economy.saveDB();
    },

    /**
     * .claim <task_id>
     */
    handleClaim: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const pushName = msg.pushName || "User";

        if (!args) return sock.sendMessage(from, { text: "❌ Usage: .claim <task_id>\nExample: .claim d_fish_5" }, { quoted: msg });

        const taskId = args.trim().toLowerCase();
        const user = await economy.getUserProfile(sender, pushName);
        if (!user.tasks) return sock.sendMessage(from, { text: "❌ You have no tasks yet!" });

        if (user.tasks.completed.includes(taskId)) {
            return sock.sendMessage(from, { text: "❌ You have already claimed this reward!" }, { quoted: msg });
        }

        const allTasks = [...TASKS.daily, ...TASKS.weekly, ...TASKS.monthly];
        const task = allTasks.find(t => t.id === taskId);

        if (!task) return sock.sendMessage(from, { text: "❌ Invalid Task ID. Check .tasks for list." }, { quoted: msg });

        const progress = user.tasks.progress[taskId] || 0;
        if (progress < task.goal) {
            return sock.sendMessage(from, { text: `❌ Task not complete! Progress: ${progress}/${task.goal}` }, { quoted: msg });
        }

        // Apply Rewards
        user.tasks.completed.push(taskId);
        if (task.reward.money) user.wallet += task.reward.money;
        if (task.reward.xp) await economy.addXP(sender, task.reward.xp);

        if (task.reward.title) {
            if (!user.titles) user.titles = [];
            if (!user.titles.includes(task.reward.title)) {
                user.titles.push(task.reward.title);
            }
        }

        await economy.saveDB();

        let rewardMsg = `🎊 *TASK COMPLETED!* 🎊\n\nTask: *${task.text}*\nReward: `;
        if (task.reward.money) rewardMsg += `*$${task.reward.money}* `;
        if (task.reward.xp) rewardMsg += `+ *${task.reward.xp} XP* `;
        if (task.reward.title) rewardMsg += `+ Title: *${task.reward.title}*`;

        await sock.sendMessage(from, { text: rewardMsg }, { quoted: msg });
    }
};
