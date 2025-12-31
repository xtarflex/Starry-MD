const config = require("../config");
const handler = require("../lib/handler");
const fs = require("fs-extra");

/**
 * Starry MD: Master Test Runner
 * ----------------------------
 * Runs 100 diverse scenarios and generates a foolproof report.
 */

async function runMasterSuite() {
    console.log(`\n🚀 STARRY MD: 100-SCENARIO MASTER SUITE 🚀`);
    console.log(`========================================`);

    const scenarios = fs.readJsonSync('./database/tests.json');

    // Controlled Test State
    const botState = {
        mode: "$public",
        persona: "default",
        cooldowns: new Map(),
        processedMessages: new Set(),
        handshakeWaiting: new Set(),
        contacts: { "123456@s.whatsapp.net": { name: "Test Friend", sync: true } },
        ownerLID: "owner-lid",
        ghostBuffer: new Map(),
        sleepCooldowns: new Map(),
        antiLinkGroups: new Set()
    };

    const mockSock = {
        user: { id: config.OWNER_ID + ":8@s.whatsapp.net" },
        sendMessage: async () => ({ key: { id: "test-id" } }),
        readMessages: async () => { }
    };

    let passed = 0;
    let failed = 0;

    for (const sc of scenarios) {
        process.stdout.write(`Running [${sc.id}/100]... `);

        const mockMsg = {
            messages: [{
                key: {
                    remoteJid: sc.isGroup ? "group@g.us" : sc.sender,
                    fromMe: false,
                    participant: sc.isGroup ? sc.sender : undefined,
                    id: "TEST_" + sc.id
                },
                message: { conversation: sc.body },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "Tester"
            }]
        };

        try {
            await handler(mockMsg, mockSock, botState);
            passed++;
            console.log(`✅`);
        } catch (e) {
            failed++;
            console.log(`❌ (${e.message})`);
        }
    }

    console.log(`\n========================================`);
    console.log(`FINAL MASTER REPORT:`);
    console.log(`TOTAL SCENARIOS: 100`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`SUCCESS RATE: ${(passed / 100) * 100}%`);
}

runMasterSuite();
