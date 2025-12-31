const config = require("../config");
const handler = require("../lib/handler");
const fs = require("fs-extra");

/**
 * Starry MD: Known Contact Bypass Test
 * -----------------------------------
 * Verifies that the bot recognizes existing contacts and doesn't trigger a handshake.
 */

async function testKnown() {
    const logPath = "./database/test_results.log";

    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logPath, msg + "\n");
    };

    log(`\n👥 Starry MD: Known Contact Test 👥`);
    log(`-----------------------------------`);
    log(`Simulating a message from an existing friend...`);

    const friendJid = "123456789@s.whatsapp.net";

    const botState = {
        mode: "$public",
        cooldowns: new Map(),
        processedMessages: new Set(),
        handshakeWaiting: new Set(),
        contacts: {
            "123456789@s.whatsapp.net": { name: "Best Friend", sync: true }
        },
        ownerLID: "owner-lid",
        ghostBuffer: new Map(),
        sleepCooldowns: new Map(),
        antiLinkGroups: new Set()
    };

    const mockSock = {
        user: { id: "bot-id:1@s.whatsapp.net" },
        sendMessage: async (jid, content) => {
            log(`[BOT REPLY] -> ${JSON.stringify(content.text)}`);
            return { key: { id: "mock-id" } };
        }
    };

    const mockMsg = {
        messages: [{
            key: { remoteJid: friendJid, fromMe: false, id: "KNOWN_MSG_1" },
            message: { conversation: "$ping" },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: "Best Friend"
        }]
    };

    log(`\n[FRIEND] <- "$ping"`);

    // We expect NO "Handshake started" log here.
    await handler(mockMsg, mockSock, botState);

    log(`\n[RESULT] Verification Check:`);
    if (botState.handshakeWaiting.has(friendJid)) {
        log(`❌ FAILED: Handshake was incorrectly triggered for a known contact.`);
    } else {
        log(`✅ SUCCESS: Bot recognized the contact and bypassed the handshake.`);
    }

    log(`\n-----------------------------------`);
    log(`TEST COMPLETE: Results saved to ${logPath}`);
}

testKnown();
