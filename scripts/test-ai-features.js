const config = require("../config");
const handler = require("../lib/handler");
const utils = require("../lib/utils");
const fs = require("fs-extra");

/**
 * Test AI Features
 * Tests: .aitoggle, mention AI, dynamic help
 */

const mockSender = config.OWNER_ID + "@s.whatsapp.net";

// Mock botState
let botState = {
    mode: "$public",
    persona: "default",
    cooldowns: new Map(),
    warns: new Map(),
    sleepCooldowns: new Map(),
    ghostBuffer: new Map(),
    antiLinkGroups: new Set(),
    handshakeWaiting: new Set(),
    processedMessages: new Set(),
    contacts: fs.readJsonSync("./database/contacts.json", { throws: false }) || {},
    reactions: fs.readJsonSync("./database/reactions.json", { throws: false }) || {},
    settings: fs.readJsonSync("./database/bot_settings.json", { throws: false }) || {},
    memory: {},
    ownerID: config.OWNER_ID + "@s.whatsapp.net",
    botJid: "mock-bot-id@s.whatsapp.net",
    chatHistory: new Map()
};

// Mock sock
const mockSock = {
    user: { id: "mock-bot-id:1@s.whatsapp.net" },
    sendMessage: async (jid, content) => {
        console.log(`\n[OUTGOING] -> ${jid}`);
        if (content.text) {
            console.log(`📨 Response:\n${"-".repeat(50)}\n${content.text}\n${"-".repeat(50)}\n`);
        } else if (content.react) {
            console.log(`[REACT] ${content.react.text}`);
        }
        return { key: { id: "mock-reply-id" } };
    },
    sendPresenceUpdate: async (type, jid) => {
        console.log(`[PRESENCE] ${type}`);
    },
    readMessages: async (keys) => { },
};

async function testCommand(description, body) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 TEST: ${description}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Command: "${body}"\n`);

    const mockMsg = {
        key: {
            remoteJid: mockSender,
            fromMe: false,
            id: "MOCK_" + Date.now(),
            participant: undefined
        },
        message: {
            conversation: body
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "TestUser"
    };

    try {
        await handler(mockMsg, mockSock, botState);
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

async function runTests() {
    console.log(`\n⚡ AI FEATURES TEST SUITE ⚡`);
    console.log(`${"=".repeat(60)}\n`);

    // Test 1: Check AI toggle status
    await testCommand("Check AI Toggle Status", ".aitoggle");

    // Test 2: Set persona to yuki
    await testCommand("Set Persona to Yuki", ".aitoggle yuki");

    // Test 3: Enable AI mentions
    await testCommand("Enable AI Mentions", ".aitoggle on");

    // Test 4: Test dynamic help
    await testCommand("Dynamic Help - Question", ".help how do I save status?");

    // Test 5: Test normal help
    await testCommand("Normal Help - Category", ".help ai");

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ All tests completed!`);
    console.log(`${"=".repeat(60)}\n`);
}

runTests();
