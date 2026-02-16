/* 
 * VCard Generator Utility (v1.0.0)
 * Generates standard VCard 3.0 strings for WhatsApp contact sharing.
 */
module.exports = {
    /* 
     * Create a VCard string
     * @param {string} name - Full Name
     * @param {string} phone - Phone number (string)
     * @param {string} org - Organization (optional)
     * @returns {string} - Formatted VCard string
     */
    create: (name, phone, org = "Starry MD User") => {
        // Clean phone number: Extract User ID part, remove device/server, keep digits
        // Handles: 123:1@s.wa.net, 123@lid, 123@s.wa.net -> 123
        const cleanPhone = (phone.split('@')[0] || "").split(':')[0].replace(/\D/g, '');

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

    /* 
     * Create a VCard for the bot owner/system
     * @param {string} ownerName
     * @param {string} ownerPhone
     * @returns {string}
     */
    getOwnerVCard: (ownerName, ownerPhone) => {
        const phones = ownerPhone.toString().split(',').map(p => p.trim());

        let vcard = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `N:;${ownerName};;;`,
            `FN:${ownerName}`,
            "ORG:Starry MD 2.0;"
        ];

        phones.forEach(phone => {
            const cleanPhone = (phone.split('@')[0] || "").split(':')[0].replace(/\D/g, '');
            if (cleanPhone) {
                vcard.push(`TEL;type=CELL;type=VOICE;waid=${cleanPhone}:+${cleanPhone}`);
            }
        });

        vcard.push("END:VCARD");
        return vcard.join("\n");
    }
};
