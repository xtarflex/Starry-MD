require('dotenv').config();
const handler = require('../lib/handler');
const utils = require('../lib/utils');

async function runStressTest() {
    process.env.OWNER_ID = "123456789"; // Force consistent ID for test
    const ownerJid = "123456789@s.whatsapp.net";

    console.log("🚀 STARTING SHIELD STRESS TEST...");

    const botState = {
        mode: "$public",
        cooldowns: new Map(),
        groupCounts: new Map(),
        ownerID: ownerJid
    };

    let responses = 0;
    let reactions = 0;

    const mockSock = {
        sendMessage: async (from, content) => {
            if (content.text) responses++;
            else if (content.react) reactions++;
        },
        user: { id: "bot:0@s.whatsapp.net" }
    };

    const groupID = "test_group@g.us";

    // --- SCENARIO A: 15 Pings in 1 sec (Group) ---
    console.log("\n📡 SCENARIO A: Group Raid (15 members)");
    for (let i = 0; i < 15; i++) {
        const mockMsg = {
            messages: [{
                key: { remoteJid: groupID, participant: `user${i}@s.whatsapp.net`, fromMe: false },
                message: { conversation: ".ping" },
                pushName: `User${i}`
            }]
        };
        await handler(mockMsg, mockSock, botState);
    }
    console.log(`   -> Responses: ${responses} (Expected 5)`);
    console.log(`   -> Reactions: ${reactions} (Expected 10)`);

    // --- SCENARIO B: Owner Bypass ---
    responses = 0;
    reactions = 0;
    console.log("\n👑 SCENARIO B: Owner Bypass (10 fast pings)");
    for (let i = 0; i < 10; i++) {
        const mockMsg = {
            messages: [{
                key: { remoteJid: groupID, participant: ownerJid, fromMe: false },
                message: { conversation: ".ping" },
                pushName: `Owner`
            }]
        };
        await handler(mockMsg, mockSock, botState);
    }
    console.log(`   -> Responses: ${responses} (Expected 10)`);
    console.log(`   -> Reactions: ${reactions} (Expected 0)`);

    console.log("\n🎉 TEST COMPLETE.");
}

runStressTest().catch(console.error);
