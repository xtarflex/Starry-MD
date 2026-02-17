import path from 'path';
import utils from '../core/utils.js';
import dbManager from '../core/db-manager.js';

/*
 * Rate Limit System (The Shield)
 * Features:
 * - Multi-layer limits (minute, hour, day)
 * - Persistent storage (restores on restart)
 * - Warn-once logic (text warning first, then silence/react)
 * - comprehensive defaults for all commands
 */

const DB_PATH = path.join(process.cwd(), 'database', 'rate_limits.json');

// --- DEFAULT LIMITS ---
// Structure:
// rate: { max: N, window: MS }  -> Sliding window / short term
// daily: { max: N }             -> Fixed daily limit (resets at midnight UTC or rolling 24h)
//
// "daily" reset logic here is: rolling 24h for simplicity and fairness, 
// or could be fixed reset. Let's go with rolling 24h based on user preference 
// or existing economy day.
// Actually, economy usually uses a daily reset time. 
// For rate limiting, sticking to a simpler "max per 24h" (rolling) is often safer for a bot 
// to avoid "midnight spikes".

const LIMITS = {
    // --- GLOBAL DEFAULT ---
    'default': {
        rate: { max: 5, window: 10000 } // 5 cmds per 10s (Anti-Spam)
    },

    // --- ECONOMY (High Value) ---
    'daily': {
        daily: { max: 1 }
    },
    'rob': {
        rate: { max: 1, window: 3600000 }, // 1 per hour
        daily: { max: 10 }
    },
    'steal': {
        rate: { max: 1, window: 3600000 }, // 1 per hour
        daily: { max: 5 }
    },
    'bank': { rate: { max: 10, window: 60000 } }, // Reasonable check speed
    'balance': { rate: { max: 10, window: 60000 } },
    'bal': { rate: { max: 10, window: 60000 } },
    'deposit': { rate: { max: 5, window: 60000 } },
    'dep': { rate: { max: 5, window: 60000 } },
    'withdraw': { rate: { max: 5, window: 60000 } },
    'with': { rate: { max: 5, window: 60000 } },
    'give': { rate: { max: 5, window: 60000 } }, // Prevent rapid transfers
    'pay': { rate: { max: 5, window: 60000 } },

    // --- GAMBLING (Risk of Addiction/Spam) ---
    'gamble': {
        rate: { max: 10, window: 60000 }, // 10 per minute (fast paced)
        daily: { max: 500 } // High but exists
    },
    'slot': { rate: { max: 5, window: 10000 } }, // Spin speed limit
    'coinflip': { rate: { max: 10, window: 60000 } },
    'roulette': { rate: { max: 3, window: 60000 } },
    'bj': { rate: { max: 20, window: 60000 } }, // Blackjack needs moves
    'blackjack': { rate: { max: 20, window: 60000 } },
    'hit': { rate: { max: 20, window: 60000 } },
    'stand': { rate: { max: 20, window: 60000 } },
    'duel': { rate: { max: 1, window: 30000 } },

    // --- ACTIVITIES (Grinding) ---
    'work': {
        rate: { max: 1, window: 300000 }, // 5 mins usually handled by cooldown, but adding backup
        daily: { max: 50 }
    },
    'mine': { rate: { max: 1, window: 60000 } },
    'fish': { rate: { max: 1, window: 60000 } },
    'hunt': { rate: { max: 1, window: 60000 } },
    'dig': { rate: { max: 1, window: 60000 } },

    // --- AI / FUN (Expensive Compute or annoying) ---
    'ai': { rate: { max: 5, window: 60000 } },
    'chat': { rate: { max: 5, window: 60000 } },
    'ask': { rate: { max: 5, window: 60000 } },
    'gpt': { rate: { max: 5, window: 60000 } },

    'imagine': { rate: { max: 2, window: 60000 } }, // Image gen is slow
    'draw': { rate: { max: 2, window: 60000 } },

    'sticker': { rate: { max: 5, window: 60000 } },
    's': { rate: { max: 5, window: 60000 } },

    // --- UTIL ---
    'ping': { rate: { max: 3, window: 10000 } }, // Anti-ping spam
    'help': { rate: { max: 3, window: 20000 } },
    'menu': { rate: { max: 3, window: 20000 } },

    // --- SOCIAL ---
    'profile': { rate: { max: 5, window: 60000 } },
    'rank': { rate: { max: 2, window: 60000 } }, // DB heavy?
    'top': { rate: { max: 2, window: 60000 } },
    'leaderboard': { rate: { max: 2, window: 60000 } }
};

// --- STATE MANAGEMENT ---
let usageMap = {};
let isDirty = false;

// Load Data (Async Background Load)
// We start empty, and populate when DB is ready. 
// This avoids blocking the event loop on startup.
dbManager.load(DB_PATH, {}).then(data => {
    usageMap = data;
    utils.log("RATE", "Rate limits loaded safely.");
});

// Save Loop (Async & Queued)
setInterval(async () => {
    if (isDirty) {
        await dbManager.save(DB_PATH, usageMap);
        isDirty = false;
    }
}, 10000); // Save every 10s if changed

// Cleanup Loop (Remove old entries to save RAM)
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const user in usageMap) {
        for (const cmd in usageMap[user]) {
            const data = usageMap[user][cmd];

            // If inactive for > 24 hours, delete entry
            // (Assuming max window is daily)
            const lastActivity = data.timestamp || 0;
            if (now - lastActivity > 86400000 + 3600000) { // 25 hours
                delete usageMap[user][cmd];
            }
        }
        // If user object empty, delete user
        if (Object.keys(usageMap[user]).length === 0) {
            delete usageMap[user];
            cleaned++;
        }
    }
    if (cleaned > 0) isDirty = true;
}, 3600000); // Hourly cleanup

/**
 * Check if user is allowed to execute command
 * @param {string} userId 
 * @param {string} command 
 * @returns {object} { allowed: boolean, reason: string|null, timeLeft: number|null, warn: boolean }
 */
export const check = (userId, command) => {
    // Normalize
    const cmd = command.toLowerCase();
    const limitConfig = LIMITS[cmd] || LIMITS['default'];

    const now = Date.now();

    // Ensure user structure
    if (!usageMap[userId]) usageMap[userId] = {};
    if (!usageMap[userId][cmd]) {
        usageMap[userId][cmd] = {
            usage: [],        // Timestamps for window
            dailyCount: 0,
            lastDailyReset: now,
            lastWarned: 0,
            timestamp: now
        };
    }

    const userData = usageMap[userId][cmd];
    userData.timestamp = now; // Update activity for cleanup

    // 1. CHECK DAILY LIMIT
    if (limitConfig.daily) {
        // Check reset ( Rolling 24h or Fixed? Let's do Rolling 24h reset if passed)
        // Actually, simpler: if now - lastDailyReset > 24h, reset.
        if (now - userData.lastDailyReset > 86400000) {
            userData.dailyCount = 0;
            userData.lastDailyReset = now;
        }

        if (userData.dailyCount >= limitConfig.daily.max) {
            const timeLeft = 86400000 - (now - userData.lastDailyReset);

            // Warn Once Logic
            const warn = (now - userData.lastWarned > 300000); // Warn again after 5 mins? Or strictly once?
            // User asked for "warn once then ignore/react". 
            // Let's strictly warn once per "block session".
            // If we block, we check if we warned recently.

            if (warn) {
                userData.lastWarned = now;
                isDirty = true;
            }

            return { allowed: false, reason: 'daily', timeLeft, warn };
        }
    }

    // 2. CHECK RATE (WINDOW) LIMIT
    if (limitConfig.rate) {
        const windowMs = limitConfig.rate.window;
        const max = limitConfig.rate.max;

        // Filter timestamps within window
        userData.usage = userData.usage.filter(t => now - t < windowMs);

        if (userData.usage.length >= max) {
            const oldest = userData.usage[0] || now;
            const timeLeft = windowMs - (now - oldest);

            const warn = (now - userData.lastWarned > windowMs * 2); // Only warn if fairly new block
            if (warn) {
                userData.lastWarned = now;
                isDirty = true;
            }

            return { allowed: false, reason: 'rate', timeLeft, warn };
        }
    }

    // ALLOWED -> Update Counters
    if (limitConfig.daily) {
        userData.dailyCount++;
    }
    if (limitConfig.rate) {
        userData.usage.push(now);
    }

    isDirty = true;
    return { allowed: true };
};

/**
 * Get limit info for help/debug
 */
export const getLimits = (command) => {
    return LIMITS[command.toLowerCase()] || LIMITS['default'];
};

/**
 * Reset limits for a user/command (e.g. via item)
 */
export const reset = (userId, command) => {
    const cmd = command.toLowerCase();
    if (usageMap[userId] && usageMap[userId][cmd]) {
        usageMap[userId][cmd] = {
            usage: [],
            dailyCount: 0,
            lastDailyReset: Date.now(),
            lastWarned: 0,
            timestamp: Date.now()
        };
        isDirty = true;
        return true;
    }
    return false;
};
export default {
    check,
    getLimits,
    reset
};
