const config = require("../config");
const handler = require("../lib/handler");
const fs = require("fs-extra");

/**
 * Starry MD: Handshake Verification Test
 * --------------------------------------
 * Simulates a stranger messaging the bot and the 10s human-emulation sequence.
 */

async function testHandshake() {
    const logPath = "./database/test_results.log";

    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logPath, msg + "\n");
    };

    log(`\n🤝 Starry MD: Handshake Protocol Test 🤝`);
    log(`----------------------------------------`);
    log(`Simulating a stranger's first message...`);

    const botState = {
        mode: "$private",
        cooldowns: new Map(),
        processedMessages: new Set(),
        handshakeWaiting: new Set(),
        contacts: {},
        ownerLID: "owner-lid",
        ghostBuffer: new Map(),
        sleepCooldowns: new Map(),
        antiLinkGroups: new Set()
    };

    const mockSock = {
        user: { id: "bot-id:1@s.whatsapp.net" },
        sendMessage: async (jid, content) => {
            if (content.contacts) {
                log(`[BOT FEEDBACK] -> Sent VCard (Contact Card) to ${jid}!`);
            } else if (content.text) {
                log(`[BOT REPLY] -> ${JSON.stringify(content.text)}`);
            }
            return { key: { id: "mock-id" } };
        }
    };

    const strangerJid = "999000111@s.whatsapp.net";
    const msg1 = {
        messages: [{
            key: { remoteJid: strangerJid, fromMe: false, id: "HANDSHAKE_1" },
            message: { conversation: "Hello, who is this?" },
            messageTimestamp: Math.floor(Date.now() / 1000),
            pushName: "Mr. Stranger"
        }]
    };

    log(`\n[STRANGER] <- "Hello, who is this?"`);
    log(`[SYSTEM] Bot is "thinking" for 10 seconds (Simulating human delay)...`);
    await handler(msg1, mockSock, botState);

    log(`\n[STRANGER] <- "It's a friend!" (Replying to bot's question)`);
    const msg2 = {
        messages: [{
            key: { remoteJid: strangerJid, fromMe: false, id: "HANDSHAKE_2" },
            message: { conversation: "It's a friend!" },
            messageTimestamp: Math.floor(Date.now() / 1000) + 12,
            pushName: "Mr. Stranger"
        }]
    };
    await handler(msg2, mockSock, botState);

    if (botState.contacts[strangerJid]) {
        log(`\n✅ SUCCESS: Handshake Completed! Stranger added to Contacts.`);
        log(`Contact Identity: ${botState.contacts[strangerJid].name}`);
    } else {
        log(`\n❌ FAILED: Handshake did not register the contact.`);
    }

    log(`\n----------------------------------------`);
    log(`TEST COMPLETE: Final logs saved to ${logPath}`);
}

testHandshake();
