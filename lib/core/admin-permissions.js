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

    isBotAdmin: (groupMetadata, botJid) => {
        if (!groupMetadata || !groupMetadata.participants) return false;
        const participant = groupMetadata.participants.find(p => p.id === botJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    }
};
