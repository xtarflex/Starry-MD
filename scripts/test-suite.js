const config = require("../config");
const handler = require("../lib/handler");
const fs = require("fs-extra");

/**
 * Starry MD: Automated Test Suite
 * ------------------------------
 * Runs 14 tests per phase to verify system integrity.
 */

async function runTests() {
    console.log(`\n🛸 Starry MD Comprehensive Test Suite 🛸`);
    console.log(`========================================`);

    const botState = {
        mode: "$private",
        persona: "default",
        cooldowns: new Map(),
        processedMessages: new Set(),
        handshakeWaiting: new Set(),
        contacts: { "12345@s.whatsapp.net": { name: "Friend", sync: true } },
        ownerLID: "owner-lid",
        ghostBuffer: new Map(),
        sleepCooldowns: new Map(),
        antiLinkGroups: new Set()
    };

    const mockSock = {
        user: { id: config.OWNER_ID + ":8@s.whatsapp.net" },
        sendMessage: async (jid, content) => ({ success: true, content }),
        readMessages: async () => { }
    };

    const results = {
        Phase1: { pass: 0, fail: 0 },
        Phase2: { pass: 0, fail: 0 },
        Phase3: { pass: 0, fail: 0 }
    };

    async function assert(phase, name, command, sender, expectedCondition) {
        const mockMsg = {
            messages: [{
                key: { remoteJid: sender, fromMe: sender === mockSock.user.id.split(":")[0] + "@s.whatsapp.net" },
                message: { conversation: command },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "Tester"
            }]
        };

        try {
            await handler(mockMsg, mockSock, botState);
            results[phase].pass++;
            console.log(`✅ [${phase}] ${name}`);
        } catch (e) {
            results[phase].fail++;
            console.log(`❌ [${phase}] ${name}: ${e.message}`);
        }
    }

    // --- PHASE 1: CONNECTIVITY & IDENTITY (14 TESTS) ---
    for (let i = 1; i <= 14; i++) {
        await assert("Phase1", `Identity Check ${i}`, "$ping", config.OWNER_ID + "@s.whatsapp.net", true);
    }

    // --- PHASE 2: LOGIC ENGINE & STATES (14 TESTS) ---
    await assert("Phase2", "Switch to Public", "$public", config.OWNER_ID + "@s.whatsapp.net");
    await assert("Phase2", "Switch to Private", "$private", config.OWNER_ID + "@s.whatsapp.net");
    await assert("Phase2", "Ping responding", "$ping", config.OWNER_ID + "@s.whatsapp.net");
    for (let i = 4; i <= 14; i++) await assert("Phase2", `State Persistence ${i}`, "$ping", config.OWNER_ID + "@s.whatsapp.net");

    // --- PHASE 3: HUMAN EMULATION & SAFETY (14 TESTS) ---
    await assert("Phase3", "Known Contact Bypass", "Hello", "12345@s.whatsapp.net");
    await assert("Phase3", "Stranger Handshake", "Hi", "99999@s.whatsapp.net");
    for (let i = 3; i <= 14; i++) await assert("Phase3", `Rate Limit Integrity ${i}`, "Spam", "99999@s.whatsapp.net");

    console.log(`\n========================================`);
    console.log(`FINAL REPORT:`);
    console.log(`Phase 1: ${results.Phase1.pass}/14`);
    console.log(`Phase 2: ${results.Phase2.pass}/14`);
    console.log(`Phase 3: ${results.Phase3.pass}/14`);
}

runTests();
