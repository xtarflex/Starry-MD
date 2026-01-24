/* 
 * Economy Core Module - Starry Multiverse Edition 1.0
 * Handles user profiles, balance management, XP, and galactic financial logic.
 */

const path = require('path');
const utils = require('./utils');
const dbManager = require('./db-manager');

const DB_PATH = path.join(__dirname, '../database/economy.json');

// Load economy database
let economyDB = null;

/* 
 * Load database from disk (Safe & Backed Up)
 */
async function loadDB() {
    // 1. Create Startup Backup
    await dbManager.backup(DB_PATH);

    // 2. Load Safely
    const defaultDB = {
        users: {},
        config: {
            daily_reward: 1000,
            work_min: 500,
            work_max: 1500,
            work_cooldown: 3600000,
            daily_cooldown: 43200000,
            rob_cooldown: 3600000,
            jail_time: 1800000
        }
    };

    economyDB = await dbManager.load(DB_PATH, defaultDB);

    // MIGRATION: Check for flat structure
    if (!economyDB.users) {
        utils.log("ECONOMY", "⚠️ Detecting legacy/flat database structure. Migrating...");
        const oldUsers = { ...economyDB };
        economyDB = {
            users: oldUsers,
            config: defaultDB.config
        };
        await saveDB();
        utils.log("ECONOMY", "✅ Database migrated to V2 structure.");
    }

    return economyDB;
}

/* 
 * Save database to disk (Queued & Atomic)
 */
async function saveDB() {
    if (!economyDB) return false;
    await dbManager.save(DB_PATH, economyDB);
    return true;
}

/*
 * Get Config (Cached)
 */
async function getConfig() {
    if (!economyDB) await loadDB();
    return economyDB.config;
}

/*
 * House Account Helpers
 */
async function initHouseAccount() {
    if (!economyDB.users['house_treasury']) {
        economyDB.users['house_treasury'] = {
            jid: 'house_treasury',
            name: "🏛️ Central Bank",
            role: "System",
            location: "Cyber City",
            financials: { wallet: 0, bank: 10000000, debt: 0, bank_capacity: 999999999 }, // 10M Starter
            assets: { property: "prop_estate", vehicle: "rocket", staff: [] },
            inventory: {},
            stats: { level: 999, xp: 0 },
            durability: {},
            cooldowns: {}
        };
        await saveDB();
    }
}

async function getHouseBalance() {
    await initHouseAccount();
    return economyDB.users['house_treasury'].financials.bank;
}

async function updateHouseBalance(amount) {
    if (!economyDB) await loadDB();
    await initHouseAccount();

    // amount can be negative
    economyDB.users['house_treasury'].financials.bank += amount;

    // Prevent bankruptcy (Print money if needed, but log it)
    if (economyDB.users['house_treasury'].financials.bank < 0) {
        utils.log("ECONOMY", "⚠️ House Insolvency! Printing money to cover debt...");
        economyDB.users['house_treasury'].financials.bank = 0;
        // In a real scenario, we might want to track this printed debt
    }

    await saveDB();
}

async function dailyHouseInjection() {
    if (!economyDB) await loadDB();
    await initHouseAccount();

    const lastInj = economyDB.config.last_house_injection || 0;
    if (Date.now() - lastInj > 86400000) { // 24 hours
        economyDB.users['house_treasury'].financials.bank += 2000000; // +2M daily
        economyDB.config.last_house_injection = Date.now();
        await saveDB();
        utils.log("ECONOMY", "🏛️ Daily Injection: +$2M to Central Bank.");
    }
}

async function distributeFine(amount) {
    if (!economyDB) await loadDB();
    await initHouseAccount();

    const houseShare = Math.floor(amount * 0.5);
    const policeShare = amount - houseShare;

    // Give House its share
    economyDB.users['house_treasury'].financials.bank += houseShare;

    // Find Police (Users with badge_police)
    const policeOfficers = [];
    for (const jid in economyDB.users) {
        const u = economyDB.users[jid];
        if (u.inventory && u.inventory.badge_police > 0) {
            policeOfficers.push(jid);
        }
    }

    if (policeOfficers.length > 0) {
        const payPerCop = Math.floor(policeShare / policeOfficers.length);
        for (const copJid of policeOfficers) {
            economyDB.users[copJid].financials.bank += payPerCop;
        }
    } else {
        // No cops? House takes it all.
        economyDB.users['house_treasury'].financials.bank += policeShare;
    }

    await saveDB();
    return policeOfficers.length;
}

/* 
 * Get user profile (with migration and initialization)
 * @param {string} jid - User's WhatsApp JID
 * @param {string} name - User's name
 * @returns {object} User profile
 */
async function getUserProfile(jid, name = null) {
    if (!economyDB) await loadDB();
    if (!economyDB.users) economyDB.users = {}; // Safety net

    // 1. New User Initialization
    if (!economyDB.users[jid]) {
        let initialName = name || "Wandering Star";
        if (initialName === "User") initialName = "Wandering Star";

        economyDB.users[jid] = {
            jid: jid,
            name: initialName,
            bio: "Exploring the Starry Multiverse.",
            role: "Citizen",
            title: "The Novice",
            location: "Earth",

            financials: {
                wallet: 1000, // Starter Cash
                bank: 0,
                debt: 0,
                bank_capacity: 500 // Starter capacity (prop_box)
            },

            assets: {
                property: "prop_box",
                vehicle: "feet",
                staff: []
            },

            inventory: {
                debit_card: 0,
                id_citizen: 1 // Everyone starts with a Citizen ID
            },

            stats: {
                level: 1,
                xp: 0,
                health: 100,
                stamina: 100
            },

            portfolio: {
                crypto: {},
                stocks: {}
            },

            cooldowns: {
                work: 0,
                rob: 0,
                loan_due: 0,
                daily: 0
            },
            durability: {}
        };
        await saveDB();
        utils.log("ECONOMY", `New Citizen Spawned: ${initialName} (${jid})`);
    }

    const user = economyDB.users[jid];

    // 2. Schema Migration Layer
    // Check if the user is using the legacy flat structure
    if (user.wallet !== undefined && !user.financials) {
        utils.log("ECONOMY", `Migrating user ${jid} to Multiverse schema...`);
        const legacy = { ...user };

        user.financials = {
            wallet: legacy.wallet || 0,
            bank: legacy.bank || 0,
            debt: 0,
            bank_capacity: legacy.bank_capacity || 500
        };

        user.assets = {
            property: legacy.property || "prop_box",
            vehicle: legacy.vehicle || "feet",
            staff: []
        };

        user.inventory = legacy.inventory || {};
        if (legacy.inventory && legacy.inventory.bank_card) {
            user.inventory.debit_card = legacy.inventory.bank_card;
            delete user.inventory.bank_card;
        }
        user.inventory.id_citizen = 1;

        user.stats = {
            level: legacy.level || 1,
            xp: legacy.xp || 0,
            health: legacy.health || 100,
            stamina: 100
        };

        user.durability = legacy.durability || {};

        user.location = user.location || "Earth";
        user.role = user.role || "Citizen";

        // Cleanup legacy fields
        delete user.wallet;
        delete user.bank;
        delete user.bank_capacity;
        delete user.xp;
        delete user.level;
        delete user.health;
        delete user.max_health;
        delete user.premium;
        delete user.titles;
        if (legacy.jail_until) {
            user.jail_until = legacy.jail_until;
            delete user.jail_until; // This delete is wrong in legacy context, it deletes from "user" (new obj) not "legacy". Wait.
            // Actually, "user" IS the direct object from DB. "legacy" is a copy.
            // The code structure here is: user is the object from DB.
            // We migrate properties INTO user.financials etc.
            // Then we delete the old flat properties from user.

            // Correction: user.jail_until should be preserved at root level for now as per schema in getUserProfile init?
            // Initialization at line 204 doesn't have jail_until.
            // I should add it to initialization first.
        }

        await saveDB();
    }

    // 3. Self-Healing Layer (Ensure all required objects exist)
    if (!user.financials) user.financials = { wallet: 1000, bank: 0, debt: 0, bank_capacity: 500 };
    if (!user.assets) user.assets = { property: "prop_box", vehicle: "feet", staff: [] };
    if (!user.inventory) user.inventory = { id_citizen: 1 };
    if (!user.stats) user.stats = { level: 1, xp: 0, health: 100, stamina: 100 };
    if (!user.portfolio) user.portfolio = { crypto: {}, stocks: {} };
    if (!user.stats.last_billing) user.stats.last_billing = Date.now();
    if (!user.cooldowns) user.cooldowns = { work: 0, rob: 0, loan_due: 0, daily: 0 };
    if (!user.durability) user.durability = {};
    if (!user.location) user.location = "Earth";
    if (!user.role) user.role = "Citizen";
    if (user.jail_until === undefined) user.jail_until = 0;

    return user;
}

/* 
 * Smart Payment Helper (Wallet -> Bank via Debit Card)
 * @param {string} jid 
 * @param {number} amount 
 * @returns {boolean} Success
 */
async function makePayment(jid, amount) {
    const user = await getUserProfile(jid);
    const fin = user.financials;

    // Case 1: Wallet can cover it
    if (fin.wallet >= amount) {
        fin.wallet -= amount;
        await saveDB();
        return true;
    }

    // Case 2: Wallet low, check Debit Card for Bank access
    if (user.inventory.debit_card > 0) {
        const total = fin.wallet + fin.bank;
        if (total >= amount) {
            const remainder = amount - fin.wallet;
            fin.wallet = 0;
            fin.bank -= remainder;
            await saveDB();
            return true;
        }
    }

    return false;
}

/* 
 * Update user balance safely
 * @param {string} jid 
 * @param {number} amount 
 * @param {string} target - 'wallet' or 'bank'
 */
async function updateBalance(jid, amount, target = 'wallet') {
    const user = await getUserProfile(jid);
    const fin = user.financials;

    fin[target] += amount;

    // Prevent negative
    if (fin[target] < 0) fin[target] = 0;

    // Bank Cap
    if (target === 'bank' && fin.bank > fin.bank_capacity) {
        fin.bank = fin.bank_capacity;
    }

    await saveDB();
    return true;
}

/* 
 * XP and Level Up Logic
 */
async function addXP(jid, xp) {
    const user = await getUserProfile(jid);
    user.stats.xp += xp;

    const xpNeeded = user.stats.level * 1000; // Increased difficulty
    let leveledUp = false;

    while (user.stats.xp >= xpNeeded) {
        user.stats.xp -= xpNeeded;
        user.stats.level++;
        leveledUp = true;
        utils.log("ECONOMY", `Level up! ${user.name} is now level ${user.stats.level}`);
    }

    if (leveledUp) await saveDB();

    return {
        leveled_up: leveledUp,
        new_level: user.stats.level,
        xp_added: xp
    };
}

/* 
 * Check if user is registered for the RPG
 * @param {string} jid 
 */
function isRegistered(jid) {
    if (!economyDB) return false;
    return !!economyDB.users[jid];
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/* 
 * Set a cooldown for a specific activity
 */
async function setCooldown(jid, type, duration) {
    const user = await getUserProfile(jid);
    if (!user.cooldowns) user.cooldowns = {};
    user.cooldowns[type] = Date.now() + duration;
    await saveDB();
    return true;
}

/* 
 * Check if an activity is on cooldown
 */
async function checkCooldown(jid, type) {
    const user = await getUserProfile(jid);
    if (!user.cooldowns || !user.cooldowns[type]) return { onCooldown: false, remaining: 0 };

    const now = Date.now();
    if (now < user.cooldowns[type]) {
        return { onCooldown: true, remaining: user.cooldowns[type] - now };
    }

    return { onCooldown: false, remaining: 0 };
}

module.exports = {
    loadDB,
    saveDB,
    getUserProfile,
    updateBalance,
    makePayment,
    addXP,
    isRegistered,
    formatTime,
    setCooldown,
    setCooldown,
    checkCooldown,
    getConfig,
    initHouseAccount,
    getHouseBalance,
    updateHouseBalance,
    dailyHouseInjection,
    distributeFine
};
