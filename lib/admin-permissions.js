const fs = require('fs-extra');
const path = require('path');

/**
 * Admin Permissions System
 * Handles permission checks, temp admin, and authorization
 */

const TEMP_ADMINS_FILE = './database/temp_admins.json';

/**
 * Helper: Extract bare number from JID (handles multi-device suffixes)
 */
const getBareId = (jid) => jid ? jid.split('@')[0].split(':')[0] : null;

/**
 * Load temp admins from database
 */
function loadTempAdmins() {
    return fs.readJsonSync(TEMP_ADMINS_FILE, { throws: false }) || {};
}

/**
 * Save temp admins to database
 */
function saveTempAdmins(data) {
    fs.writeJsonSync(TEMP_ADMINS_FILE, data, { spaces: 2 });
}

/**
 * Check if user is a temp admin
 */
function isTempAdmin(userJid, groupJid, command = null) {
    const tempAdmins = loadTempAdmins();
    const key = `${groupJid}_${userJid}`;
    const tempAdmin = tempAdmins[key];

    if (!tempAdmin) return false;

    // Check if expired
    if (Date.now() > tempAdmin.expiresAt) {
        // Auto-cleanup expired
        delete tempAdmins[key];
        saveTempAdmins(tempAdmins);
        return false;
    }

    // Check if command is allowed
    if (command) {
        if (tempAdmin.allowedCommands === 'all') return true;
        if (Array.isArray(tempAdmin.allowedCommands) &&
            tempAdmin.allowedCommands.includes(command)) {
            return true;
        }
        return false;
    }

    return true;
}

/**
 * Check if user can use admin command
 */
function canUseAdminCommand(userJid, groupJid, groupMetadata, command, isOwner) {
    // 1. Check if owner
    if (isOwner) return true;

    // 2. Check if real admin (must check for string values 'admin' or 'superadmin')
    const bareUserId = getBareId(userJid);
    const participants = groupMetadata?.participants || [];
    const participant = participants.find(p => getBareId(p.id) === bareUserId);
    if (participant?.admin === 'admin' || participant?.admin === 'superadmin') return true;

    // 3. Check temp admin
    if (isTempAdmin(userJid, groupJid, command)) return true;

    return false;
}

/**
 * Check if bot is admin
 */
function isBotAdmin(botJid, groupMetadata) {
    const bareBotId = getBareId(botJid);
    const participants = groupMetadata?.participants || [];
    const botParticipant = participants.find(p => getBareId(p.id) === bareBotId);
    return (botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin');
}

/**
 * Check if target is protected (admin or owner)
 */
function isProtected(targetJid, groupMetadata, ownerJid) {
    // Owner is always protected
    if (targetJid === ownerJid) return true;

    // Check if admin
    const bareTargetId = getBareId(targetJid);
    const participants = groupMetadata?.participants || [];
    const participant = participants.find(p => getBareId(p.id) === bareTargetId);
    return participant?.admin ? true : false;
}

/**
 * Grant temporary admin
 */
function grantTempAdmin(userJid, groupJid, grantedBy, duration, allowedCommands) {
    const tempAdmins = loadTempAdmins();
    const key = `${groupJid}_${userJid}`;

    const now = Date.now();
    const expiresAt = now + duration;

    tempAdmins[key] = {
        grantedBy,
        grantedAt: now,
        expiresAt,
        allowedCommands,
        usageCount: 0
    };

    saveTempAdmins(tempAdmins);
    return tempAdmins[key];
}

/**
 * Revoke temporary admin
 */
function revokeTempAdmin(userJid, groupJid) {
    const tempAdmins = loadTempAdmins();
    const key = `${groupJid}_${userJid}`;

    if (tempAdmins[key]) {
        delete tempAdmins[key];
        saveTempAdmins(tempAdmins);
        return true;
    }
    return false;
}

/**
 * Get temp admin info
 */
function getTempAdmin(userJid, groupJid) {
    const tempAdmins = loadTempAdmins();
    const key = `${groupJid}_${userJid}`;
    return tempAdmins[key] || null;
}

/**
 * List all temp admins in group
 */
function listTempAdmins(groupJid) {
    const tempAdmins = loadTempAdmins();
    const groupTempAdmins = [];

    for (const [key, data] of Object.entries(tempAdmins)) {
        if (key.startsWith(groupJid + '_')) {
            const userJid = key.split('_')[1];
            groupTempAdmins.push({
                userJid,
                ...data
            });
        }
    }

    return groupTempAdmins;
}

/**
 * Cleanup expired temp admins
 */
function cleanupExpiredTempAdmins() {
    const tempAdmins = loadTempAdmins();
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of Object.entries(tempAdmins)) {
        if (now > data.expiresAt) {
            delete tempAdmins[key];
            cleaned++;
        }
    }

    if (cleaned > 0) {
        saveTempAdmins(tempAdmins);
    }

    return cleaned;
}

/**
 * Increment usage count for temp admin
 */
function incrementTempAdminUsage(userJid, groupJid) {
    const tempAdmins = loadTempAdmins();
    const key = `${groupJid}_${userJid}`;

    if (tempAdmins[key]) {
        tempAdmins[key].usageCount = (tempAdmins[key].usageCount || 0) + 1;
        saveTempAdmins(tempAdmins);
    }
}

/**
 * Parse duration string (e.g., "30m", "1h", "2d")
 */
function parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([mhd])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        'm': 60 * 1000,           // minutes
        'h': 60 * 60 * 1000,      // hours
        'd': 24 * 60 * 60 * 1000  // days
    };

    return value * multipliers[unit];
}

module.exports = {
    isTempAdmin,
    canUseAdminCommand,
    isBotAdmin,
    isProtected,
    grantTempAdmin,
    revokeTempAdmin,
    getTempAdmin,
    listTempAdmins,
    cleanupExpiredTempAdmins,
    incrementTempAdminUsage,
    parseDuration
};
