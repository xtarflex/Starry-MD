const handler = require('../lib/handler');
const utils = require('../lib/utils');
const path = require('path');

// Mock socket
const mockSock = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (jid, content, options) => {
        console.log(`[MOCK SEND] To ${jid}:`, JSON.stringify(content, null, 2));
        return { key: { id: 'mock-msg-id', remoteJid: jid } };
    },
    decodeJid: (jid) => {
        if (!jid) return jid;
        return jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;
    },
    groupMetadata: async (jid) => ({ id: jid, participants: [], subject: 'Mock Group' }),
    simulateTyping: async () => { },
    simulateAudio: async () => { },
    delay: async () => { }
};

// Mock message creator
function createMockMsg(from, text, pushName = 'Tester', isMe = false) {
    return {
        key: { remoteJid: from, fromMe: isMe, id: 'msg-' + Math.random().toString(36).substr(2, 9) },
        message: { conversation: text },
        pushName: pushName
    };
}

// Mock botState
const botState = {
    mode: '$public',
    bannedChats: [],
    contacts: {
        'bot@s.whatsapp.net': { name: 'Starry Bot' },
        '123@s.whatsapp.net': { name: 'Tester' }
    },
    cooldowns: new Map(),
    handshakeWaiting: new Set(),
    reactions: {
        '🔥': ['lit', 'fire'],
        '❤️': ['love', 'heart']
    },
    groupMetadata: {},
    groupSettings: {},
    statusPosters: {}
};

async function runTests() {
    console.log("🚀 Starting Router Verification Tests...\n");

    // Test 1: Basic Command (.ping)
    console.log("--- TEST 1: Basic Command (.ping) ---");
    await handler(createMockMsg('123@s.whatsapp.net', '.ping'), mockSock, botState);

    // Test 2: Alias Command (.s for sticker)
    console.log("\n--- TEST 2: Alias Command (.s) ---");
    // Sticker command might fail without a real image, but we want to see if it triggers
    await handler(createMockMsg('123@s.whatsapp.net', '.s'), mockSock, botState);

    // Test 3: Unknown Command with Suggestion (.piig)
    console.log("\n--- TEST 3: Unknown Command with Suggestion (.piig) ---");
    await handler(createMockMsg('123@s.whatsapp.net', '.piig'), mockSock, botState);

    // Test 4: Auto-Reaction
    console.log("\n--- TEST 4: Auto-Reaction (fire) ---");
    await handler(createMockMsg('123@s.whatsapp.net', 'That is fire!'), mockSock, botState);

    // Test 5: Handshake Protocol (New User)
    console.log("\n--- TEST 5: Handshake Protocol (Stranger) ---");
    const strangerJid = '999@s.whatsapp.net';
    await handler(createMockMsg(strangerJid, 'Hello?'), mockSock, botState);

    console.log("\n--- TEST 5.1: Handshake Response ---");
    await handler(createMockMsg(strangerJid, 'I am good'), mockSock, botState);

    // Test 6: Owner Only Command (.eval)
    console.log("\n--- TEST 6: Owner Only Command (.eval) ---");
    await handler(createMockMsg('123@s.whatsapp.net', '.eval console.log("hi")'), mockSock, botState);

    console.log("\n✅ Verification Tests Completed.");
}

// Run the tests
runTests().catch(err => {
    console.error("❌ Test Runner Failed:", err);
    process.exit(1);
});
