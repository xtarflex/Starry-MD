/**
 * Economy Core Module
 * Handles user profiles, balance management, XP, cooldowns
 */

const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');

const DB_PATH = path.join(__dirname, '../database/economy.json');

// Load economy database
let economyDB = null;

/**
 * Load database from disk
 */
async function loadDB() {
    try {
        economyDB = await fs.readJSON(DB_PATH);
        return economyDB;
    } catch (err) {
        // If DB doesn't exist, create default structure
        economyDB = {
            users: {},
            config: {
                daily_reward: 100,
                work_min: 50,
                work_max: 150,
                work_cooldown: 3600000, // 1 hour
                daily_cooldown: 86400000, // 24 hours
                fish_min: 300,
                fish_max: 800,
                fish_cooldown: 300000, // 5 min
                mine_cooldown: 600000, // 10 min
                hunt_cooldown: 900000, // 15 min
                rob_cooldown: 3600000, // 1 hour
                jail_time: 1800000 // 30 min
            }
        };
        await saveDB();
        return economyDB;
    }
}

/**
 * Save database to disk
 */
async function saveDB() {
    try {
        await fs.writeJSON(DB_PATH, economyDB, { spaces: 2 });
        return true;
    } catch (err) {
        utils.log("ERROR", `Failed to save economy DB: ${err.message}`);
        return false;
    }
}

/**
 * Get user profile (create if doesn't exist)
 * @param {string} jid - User's WhatsApp JID
 * @param {string} name - User's name
 * @returns {object} User profile
 */
async function getUserProfile(jid, name = null) {
    if (!economyDB) await loadDB();

    if (!economyDB.users[jid]) {
        // Capture a valid initial name
        let initialName = name;
        if (!initialName || initialName === "User") {
            initialName = "Wandering Star";
        }

        // Create new user
        economyDB.users[jid] = {
            name: initialName,
            wallet: 0,
            bank: 0,
            xp: 0,
            level: 1,
            premium: false,
            bio: "Exploring the cosmos with Starry MD.",
            titles: [],
            health: 100,
            max_health: 100,
            inventory: {
                rod: 0,
                pickaxe: 0,
                sword: 0,
                shield: 0,
                potion: 0,
                idcard: 0,
                exp_scroll: 0,
                premium_title: 0
            },
            durability: {
                pickaxe: 0
            },
            cooldowns: {
                daily: 0,
                work: 0,
                fish: 0,
                mine: 0,
                hunt: 0,
                rob: 0
            },
            stats: {
                total_earned: 0,
                crimes_committed: 0,
                successful_robs: 0,
                times_robbed: 0,
                fish_caught: 0,
                gems_mined: 0,
                name_changes: 0
            },
            jail_until: 0,
            bank_capacity: 10000
        };
        await saveDB();
        utils.log("ECONOMY", `New user registered: ${initialName} (${jid})`);
    }

    return economyDB.users[jid];
}

/**
 * Update user's RPG name
 * @param {string} jid 
 * @param {string} newName 
 */
async function setRPGName(jid, newName) {
    const user = await getUserProfile(jid);
    user.name = newName;
    user.stats.name_changes = (user.stats.name_changes || 0) + 1;
    await saveDB();
    return true;
}

/**
 * Update user balance (wallet or bank)
 * @param {string} jid - User JID
 * @param {number} amount - Amount to add/subtract (negative to subtract)
 * @param {string} type - 'wallet' or 'bank'
 * @returns {boolean} Success
 */
async function updateBalance(jid, amount, type = 'wallet') {
    const user = await getUserProfile(jid);

    user[type] += amount;

    // Prevent negative balances
    if (user[type] < 0) user[type] = 0;

    // Check bank capacity
    if (type === 'bank' && user.bank > user.bank_capacity) {
        user.bank = user.bank_capacity;
    }

    await saveDB();
    return true;
}

/**
 * Check if user is on cooldown
 * @param {string} jid - User JID
 * @param {string} type - Cooldown type (daily, work, fish, etc.)
 * @returns {object} {onCooldown: boolean, remaining: number (ms)}
 */
async function checkCooldown(jid, type) {
    const user = await getUserProfile(jid);
    const now = Date.now();
    const cooldownEnd = user.cooldowns[type] || 0;

    if (now < cooldownEnd) {
        return {
            onCooldown: true,
            remaining: cooldownEnd - now
        };
    }

    return {
        onCooldown: false,
        remaining: 0
    };
}

/**
 * Set cooldown for user
 * @param {string} jid - User JID
 * @param {string} type - Cooldown type
 * @param {number} duration - Duration in milliseconds
 */
async function setCooldown(jid, type, duration) {
    const user = await getUserProfile(jid);
    user.cooldowns[type] = Date.now() + duration;
    await saveDB();
}

/**
 * Add XP and handle level-ups
 * @param {string} jid - User JID  
 * @param {number} xp - XP to add
 * @returns {object} {leveled_up: boolean, new_level: number, xp_added: number}
 */
async function addXP(jid, xp) {
    const user = await getUserProfile(jid);

    user.xp += xp;

    // Check for level up (XP needed = level * 100)
    const xpNeeded = user.level * 100;
    let leveledUp = false;
    let newLevel = user.level;

    while (user.xp >= xpNeeded) {
        user.xp -= xpNeeded;
        user.level++;
        newLevel = user.level;
        leveledUp = true;

        // Increase bank capacity on level up
        user.bank_capacity += 5000;

        utils.log("ECONOMY", `Level up! ${user.name} is now level ${newLevel}`);
    }

    await saveDB();

    return {
        leveled_up: leveledUp,
        new_level: newLevel,
        xp_added: xp
    };
}

/**
 * Format time remaining for cooldown
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string
 */
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

module.exports = {
    loadDB,
    saveDB,
    getUserProfile,
    updateBalance,
    setRPGName,
    checkCooldown,
    setCooldown,
    addXP,
    formatTime
};
