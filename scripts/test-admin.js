const config = require("../config");
const handler = require("../lib/handler");
const utils = require("../lib/utils");
const fs = require("fs-extra");

/**
 * Test Admin Commands
 */

const mockGroupJid = "120363424578509423@g.us";
const mockOwnerJid = config.OWNER_ID + "@s.whatsapp.net";
const mockUserJid = "2348141680626@s.whatsapp.net";

// Mock botState
let botState = {
    mode: "$public",
    cooldowns: new Map(),
    settings: fs.readJsonSync("./database/bot_settings.json", { throws: false }) || {},
    ownerID: config.OWNER_ID + "@s.whatsapp.net",
};

// Mock sock
const mockSock = {
    user: { id: "mock-bot-id:1@s.whatsapp.net" },
    sendMessage: async (jid, content) => {
        console.log(`\n[OUTGOING] -> ${jid.split('@')[0]}`);
        if (content.text) {
            console.log(`${content.text}\n`);
        }
        return { key: { id: "mock-reply-id" } };
    },
    groupMetadata: async (jid) => {
        return {
            id: jid,
            subject: "Test Group",
            participants: [
                { id: mockOwnerJid, admin: "superadmin" },
                { id: "mock-bot-id@s.whatsapp.net", admin: "admin" },
                { id: mockUserJid, admin: null }
            ]
        };
    }
};

async function testCommand(description, body, from = mockGroupJid, sender = mockOwnerJid) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 ${description}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Command: "${body}"\n`);

    const mockMsg = {
        key: {
            remoteJid: from,
            fromMe: sender === mockOwnerJid,
            id: "MOCK_" + Date.now(),
            participant: sender
        },
        message: {
            conversation: body,
            extendedTextMessage: {
                text: body,
                contextInfo: {
                    mentionedJid: body.includes('@') ? [mockUserJid] : []
                }
            }
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "TestOwner"
    };

    try {
        await handler(mockMsg, mockSock, botState);
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

async function runTests() {
    console.log(`\n⚡ ADMIN COMMANDS TEST SUITE ⚡`);
    console.log(`${"=".repeat(60)}\n`);

    // Test 1: Temp Admin - List (empty)
    await testCommand("List Temp Admins (Empty)", ".tempmod list");

    // Test 2: Temp Admin - Grant
    await testCommand("Grant Temp Admin", ".tempmod @user 30m kick,warn");

    // Test 3: Temp Admin - List (with entry)
    await testCommand("List Temp Admins (With Entry)", ".tempmod list");

    // Test 4: Kick (should fail - user is temp admin now, but command works)
    await testCommand("Kick User", ".kick @user");

    // Test 5: Promote
    await testCommand("Promote User", ".promote @user");

    // Test 6: Warn
    await testCommand("Warn User", ".warn @user spamming");

    // Test 7: Temp Admin - Revoke
    await testCommand("Revoke Temp Admin", ".tempmod @user revoke");

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ All tests completed!`);
    console.log(`${"=".repeat(60)}\n`);
}

runTests();
