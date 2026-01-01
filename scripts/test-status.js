const config = require("../config");
const handler = require("../lib/handler");
const utils = require("../lib/utils");
const fs = require("fs-extra");

/**
 * Starry MD: Status Saver Test Suite
 * ---------------------------------
 * Mocks a Status-quote message to verify dual-routing logic.
 * Usage: 
 *   node scripts/test-status.js dm (Default)
 *   node scripts/test-status.js me (Saved Messages)
 */

const targetMode = process.argv[2] || "dm";
const mockSender = config.OWNER_ID + "@s.whatsapp.net";

let botState = {
    mode: "$public",
    cooldowns: new Map(),
    processedMessages: new Set(),
    handshakeWaiting: new Set(),
    contacts: {},
    ownerID: config.OWNER_ID + "@s.whatsapp.net",
    settings: { autoBio: true, customBio: null, viewOnceMode: "chat" },
    memory: {},
    warns: new Map(),
    groupCounts: new Map(),
    reactions: {}
};

const mockSock = {
    user: { id: "bot-id@s.whatsapp.net" },
    sendMessage: async (jid, content) => {
        console.log(`\n[OUTGOING] -> ${jid}`);
        if (content.image) console.log(`[MEDIA] Sending Image Buffer...`);
        if (content.video) console.log(`[MEDIA] Sending Video Buffer...`);
        if (content.text) console.log(`[TEXT] -> ${content.text}`);
        return { key: { id: "reply-id" } };
    },
    sendPresenceUpdate: async (type, jid) => { },
    updateMediaMessage: async (msg) => msg
};

// Mock Baileys downloadMediaMessage (CLEAN MOCK)
const baileysPath = require.resolve('@whiskeysockets/baileys');
const realBaileys = require('@whiskeysockets/baileys');
require.cache[baileysPath] = {
    id: baileysPath,
    filename: baileysPath,
    loaded: true,
    exports: {
        ...realBaileys,
        downloadMediaMessage: async () => {
            console.log("[MOCK] Intercepted downloadMediaMessage request.");
            return Buffer.from("fake-media-data");
        }
    }
};

const mockMessage = {
    messages: [{
        key: {
            remoteJid: mockSender,
            fromMe: false,
            id: "STATUS_TEST_" + Date.now()
        },
        message: {
            extendedTextMessage: {
                text: `.save ${targetMode}`,
                contextInfo: {
                    remoteJid: "status@broadcast",
                    participant: "target-user@s.whatsapp.net",
                    quotedMessage: {
                        imageMessage: {
                            caption: "Testing status steal",
                            mimetype: "image/jpeg"
                        }
                    }
                }
            }
        },
        pushName: "Tester"
    }],
    type: "notify"
};

console.log(`\n🌠 Starry MD: Status Saver Test Suite 🌠`);
console.log(`--------------------------------------`);
console.log(`Testing Route: ${targetMode.toUpperCase()}`);

handler(mockMessage, mockSock, botState).then(() => {
    console.log(`\n[VERIFICATION] Status Saver Test Complete.`);
});
