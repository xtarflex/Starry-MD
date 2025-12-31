const config = require("../config");
const handler = require("../lib/handler");
const utils = require("../lib/utils");
const fs = require("fs-extra");

/**
 * Starry MD: Cooldown & Spam Feedback Test
 * ---------------------------------------
 * Simulates a "Stranger" spamming the bot to verify the ❄️ reaction.
 */

async function testSpam() {
    const logPath = "./database/test_results.log";
    fs.writeFileSync(logPath, `❄️ Starry MD: Cooldown Stress Test ❄️\nStarted: ${new Date().toLocaleString()}\n\n`);

    const log = (msg) => {
        console.log(msg);
        fs.appendFileSync(logPath, msg + "\n");
    };

    log(`Simulating a non-owner spamming messages...`);

    const botState = {
        mode: "$public",
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
        user: { id: "bot-id:1@s.whatsapp.net" },
        sendMessage: async (jid, content) => {
            if (content.react) {
                log(`[BOT FEEDBACK] -> Reacted with "${content.react.text}" to message!`);
            } else if (content.text) {
                log(`[BOT REPLY] -> ${JSON.stringify(content.text)}`);
            }
            return { key: { id: "mock-id" } };
        }
    };

    const friendJid = "12345@s.whatsapp.net";

    for (let i = 1; i <= 3; i++) {
        log(`\n[FRIEND MESSAGE ${i}] <- ".ai Spam Test ${i}"`);

        const mockMsg = {
            messages: [{
                key: { remoteJid: friendJid, fromMe: false, id: "STRESS_" + i },
                message: { conversation: ".ai Spam Test " + i },
                messageTimestamp: Math.floor(Date.now() / 1000),
                pushName: "BestFriend"
            }]
        };

        await handler(mockMsg, mockSock, botState);
        // Minimal delay to simulate realistic rapid input
        await new Promise(r => setTimeout(r, 100));
    }

    log(`\n-------------------------------------`);
    log(`TEST COMPLETE: Results saved to ${logPath}`);
}

testSpam();
