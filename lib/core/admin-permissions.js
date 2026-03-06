export default {
    isAdmin: (jid, groupMetadata) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === jid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    },

    isSuperAdmin: (jid, groupMetadata) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === jid);
        return participant && participant.admin === 'superadmin';
    },

    isBotAdmin: (botJid, groupMetadata) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === botJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    },

    canUseAdminCommand: (sender, from, groupMetadata, cmd, isOwner) => {
        if (isOwner) return true;
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === sender);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    },

    isProtected: (targetJid, groupMetadata, ownerJids) => {
        if (ownerJids.includes(targetJid)) return true;
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === targetJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    },

    parseDuration: (durStr) => {
        return 3600000;
    },

    grantTempAdmin: (target, from, sender, duration, scope) => {
        return { expiresAt: Date.now() + duration };
    }
};