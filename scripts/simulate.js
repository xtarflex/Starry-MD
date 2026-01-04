const config = require("../config");
const handler = require("../lib/handler");
const utils = require("../lib/utils");
const fs = require("fs-extra");

/**
 * Starry MD: Mock Simulator - Groq AI Test
 * ------------------------
 * This script tests the Groq AI functionality
 * Usage: node scripts/simulate.js
 */

const mockBody = ".ai hello, tell me about yourself";
const mockSender = config.OWNER_ID + "@s.whatsapp.net";

// 1. Mock botState
let botState = {
    mode: "$public",
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
    ownerID: config.OWNER_ID + "@s.whatsapp.net",
    botJid: "mock-bot-id@s.whatsapp.net",
    chatHistory: new Map()
};

// 2. Mock sock (Baileys)
const mockSock = {
    user: { id: "mock-bot-id:1@s.whatsapp.net" },
    sendMessage: async (jid, content) => {
        console.log(`\n[OUTGOING] -> ${jid}`);
        if (content.text) {
            console.log(`\n📨 AI Response:\n${"-".repeat(50)}\n${content.text}\n${"-".repeat(50)}\n`);
        } else if (content.react) {
            console.log(`[REACT] ${content.react.text}`);
        } else {
            console.log(`Content:`, JSON.stringify(content, null, 2));
        }
        return { key: { id: "mock-reply-id" } };
    },
    sendPresenceUpdate: async (type, jid) => {
        console.log(`[PRESENCE] ${type}`);
    },
    readMessages: async (keys) => { },
};

// 3. Mock Message Object (Baileys Upsert)
const mockMsg = {
    key: {
        remoteJid: mockSender,
        fromMe: false,
        id: "MOCK_" + Date.now(),
        participant: undefined
    },
    message: {
        conversation: mockBody
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: "SimulatedUser"
};

// 4. Execute
console.log(`\n⚡ Starry MD - Groq AI Test ⚡`);
console.log(`${"=".repeat(50)}`);
console.log(`[INCOMING] <- ${mockSender}`);
console.log(`Message: "${mockBody}"\n`);
console.log(`Testing Groq AI (DeepSeek R1 Model)...`);
console.log(`${"=".repeat(50)}\n`);

handler(mockMsg, mockSock, botState).then(() => {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`[TEST] Simulation Complete.`);
    console.log(`\nIf you see an AI response above, Groq is working! ✅`);
    console.log(`If you see an error, check the error message for details.`);
    console.log(`\n💡 Make sure GROQ_API_KEY is set in your .env file`);
    console.log(`   Get free key from: https://console.groq.com`);
}).catch(err => {
    console.error(`\n❌ Simulation Error:`, err.message);
    console.error(`\nFull Error:`, err);
});
