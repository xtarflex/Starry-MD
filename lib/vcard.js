/**
 * VCard Generator Utility (v1.0.0)
 * Generates standard VCard 3.0 strings for WhatsApp contact sharing.
 */
module.exports = {
    /**
     * Create a VCard string
     * @param {string} name - Full Name
     * @param {string} phone - Phone number (string)
     * @param {string} org - Organization (optional)
     * @returns {string} - Formatted VCard string
     */
    create: (name, phone, org = "Starry MD User") => {
        // Clean phone number (remove @s.whatsapp.net or @lid and keep DIGITS ONLY)
        const cleanPhone = phone.split('@')[0].replace(/[^0-9]/g, '');

        return [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `N:;${name};;;`,
            `FN:${name}`,
            `ORG:${org};`,
            `TEL;type=CELL;type=VOICE;waid=${cleanPhone}:+${cleanPhone}`,
            "END:VCARD"
        ].join("\n");
    },

    /**
     * Create a VCard for the bot owner/system
     * @param {string} ownerName 
     * @param {string} ownerPhone 
     * @returns {string}
     */
    getOwnerVCard: (ownerName, ownerPhone) => {
        const cleanPhone = ownerPhone.split('@')[0].replace(/[^0-9]/g, '');
        return [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `N:;${ownerName};;;`,
            `FN:${ownerName}`,
            "ORG:Starry MD 2.0;",
            `TEL;type=CELL;type=VOICE;waid=${cleanPhone}:+${cleanPhone}`,
            "END:VCARD"
        ].join("\n");
    }
};
