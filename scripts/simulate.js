const config = require("../config");
const handler = require("../lib/handler");
const utils = require("../lib/utils");
const fs = require("fs-extra");

/**
 * Starry MD: Mock Simulator
 * ------------------------
 * This script allows you to test your handler logic without a physical phone.
 * Usage: node scripts/simulate.js "$ping" [senderId]
 */

const mockBody = process.argv[2] || "$ping";
const mockSender = process.argv[3] || config.OWNER_ID + "@s.whatsapp.net";

// 1. Mock botState
let botState = {
    mode: "$private",
    persona: "default",
    awayMessage: "",
    cooldowns: new Map(),
    warns: new Map(),
    sleepCooldowns: new Map(),
    ghostBuffer: new Map(),
    antiLinkGroups: new Set(),
    handshakeWaiting: new Set(),
    processedMessages: new Set(),
    contacts: fs.readJsonSync("./database/contacts.json", { throws: false }) || {},
    reactions: fs.readJsonSync("./database/reactions.json", { throws: false }) || {},
    settings: fs.readJsonSync("./database/bot_settings.json", { throws: false }) || { autoBio: true, customBio: null, viewOnceMode: "chat" },
    memory: {},
    ownerLID: "mock-owner-lid"
};

// 2. Mock sock (Baileys)
const mockSock = {
    user: { id: "mock-bot-id:1@s.whatsapp.net" },
    sendMessage: async (jid, content) => {
        console.log(`\n[OUTGOING] -> ${jid}`);
        console.log(`Content:`, JSON.stringify(content, null, 2));
        return { key: { id: "mock-reply-id" } };
    },
    sendPresenceUpdate: async (type, jid) => {
        console.log(`[PRESENCE] ${type} for ${jid}`);
    },
    readMessages: async (keys) => console.log(`[READ] Viewed status/message.`),
};

// 3. Mock Message Object (Baileys Upsert)
const mockMessage = {
    messages: [{
        key: {
            remoteJid: mockSender.includes("@g.us") ? mockSender : mockSender,
            fromMe: mockSender === botIdGenerator(),
            id: "MOCK_" + Date.now(),
            participant: mockSender.includes("@g.us") ? mockSender : undefined
        },
        message: {
            conversation: mockBody
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "SimulatedUser"
    }],
    type: "notify"
};

function botIdGenerator() {
    return "mock-bot-id@s.whatsapp.net";
}

// 4. Execute
console.log(`\n🌠 Starry MD Simulator 🌠`);
console.log(`--------------------------`);
console.log(`[INCOMING] <- ${mockSender}`);
console.log(`Message: "${mockBody}"\n`);

handler(mockMessage, mockSock, botState).then(() => {
    console.log(`\n--------------------------`);
    console.log(`[SIM] Simulation Complete.`);
});
