const { proto } = require("@whiskeysockets/baileys");

/**
 * Admin Permissions Module
 * Handles group administration checks
 */
module.exports = {
    /**
     * Check if a participant is an admin
     * @param {string} jid - User JID
     * @param {object} groupMetadata - Group Metadata object
     * @returns {boolean}
     */
    isAdmin: (jid, groupMetadata) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === jid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    },

    /**
     * Check if the Bot is an admin
     * @param {string} botJid - Bot's JID
     * @param {object} groupMetadata - Group Metadata object
     * @returns {boolean}
     */
    isBotAdmin: (botJid, groupMetadata) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === botJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    },

    /**
     * Check if a participant is a Super Admin (Global Mod/Owner)
     * @param {string} jid 
     * @param {object} groupMetadata 
     * @returns {boolean}
     */
    isSuperAdmin: (jid, groupMetadata) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === jid);
        return participant && participant.admin === 'superadmin';
    }
};
