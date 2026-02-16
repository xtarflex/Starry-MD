
const assert = require('assert');

// Mock Data
const TARGET_LID = "123456789@lid";
const TARGET_PN = "123456789@s.whatsapp.net";
const GROUP_JID = "1234567890@g.us";

// Mock Bot State
const botState = {
    groupMetadata: {}
};

// Mock Sock
const sock = {
    store: {
        contacts: {} // Empty for this test to force fallback
    },
    groupMetadata: async (jid) => {
        console.log(`[Mock] Fetching metadata for ${jid}...`);
        return {
            id: jid,
            participants: [
                { id: "987654321@s.whatsapp.net", admin: null },
                { id: TARGET_PN, lid: TARGET_LID, admin: null } // The user we want
            ]
        };
    }
};

// The Logic being tested (Extracted from handler.js)
async function resolveLid(targetJid, from, isGroup) {
    console.log(`\nTesting Resolution for: ${targetJid}`);

    // Layer 1: Status Store (Skipped/Failed simulation)
    // ... logic would go here ...

    // Layer 2: Sock Store (Skipped/Failed simulation)
    if (sock.store?.contacts[targetJid]) {
        return sock.store.contacts[targetJid].id;
    }

    // Layer 3: Group Metadata (The new fix)
    if (targetJid.includes('@lid') && isGroup) {
        try {
            console.log("-> Layer 3: Searching Group Metadata...");
            const meta = botState.groupMetadata[from] || await sock.groupMetadata(from);
            if (meta) {
                const member = meta.participants.find(p => p.lid === targetJid || p.id === targetJid);
                if (member && member.id && member.id.includes('@s.whatsapp.net')) {
                    console.log(`   FOUND: ${member.id}`);
                    return member.id;
                }
            }
        } catch (err) {
            console.log("Error:", err.message);
        }
    }

    return targetJid; // Return original if fail
}

(async () => {
    console.log("=== VERIFYING LID RESOLUTION FALLBACK ===");

    // Test Case: Ghost User in Group (Status Store failed, Sock Store failed)
    const result = await resolveLid(TARGET_LID, GROUP_JID, true);

    if (result === TARGET_PN) {
        console.log("\n✅ SUCCESS: logic correctly resolved LID to Phone Number via Group Metadata.");
    } else {
        console.error(`\n❌ FAILED: Expected ${TARGET_PN}, got ${result}`);
        process.exit(1);
    }
})();
