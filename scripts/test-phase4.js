/**
 * Starry MD - Phase 4 Verification Script
 * Simulates Info, Fun, and Game commands.
 */

const infoZone = require('../lib/info-zone');
const funZone = require('../lib/fun-zone');
const gameZone = require('../lib/game-zone');
const utils = require('../lib/utils');

// Mock Objects
const mockSock = {
    user: { id: "Bot@s.whatsapp.net" },
    sendMessage: async (jid, content, options) => {
        const type = Object.keys(content)[0];
        let preview = "";

        if (type === 'text') preview = content.text;
        else if (type === 'image') preview = "[Image Buffer]";
        else if (type === 'react') preview = `Reaction: ${content.react.text}`;

        console.log(`   [OUTGOING] -> ${jid} [${type.toUpperCase()}]`);
        if (preview) console.log(`      📝 ${preview.replace(/\n/g, '\n      ')}`);
        return { key: { id: "MOCK_MSG_" + Date.now() } };
    },
    profilePictureUrl: async () => "https://example.com/pp.png",
    groupMetadata: async () => ({
        participants: [
            { id: "123@s.whatsapp.net" },
            { id: "456@s.whatsapp.net" },
            { id: "789@s.whatsapp.net" }
        ]
    })
};

const mockBotState = {
    games: {} // Minimal state
};

// Test Runner
const runTests = async () => {
    console.log("\n🚀 STARRY MD - PHASE 4 VERIFICATION 🚀");
    console.log("==================================================");

    // --- INFO ZONE ---
    console.log("\n[TESTING] Info Zone...");

    // .lyrics
    await testCmd(".lyrics Bohemian Rhapsody", infoZone.handleLyrics, "Bohemian Rhapsody");

    // .wiki
    await testCmd(".wiki OpenAI", infoZone.handleWiki, "OpenAI");

    // .weather
    await testCmd(".weather New York", infoZone.handleWeather, "New York");

    // --- FUN ZONE ---
    console.log("\n[TESTING] Fun Zone...");

    // .ship (Mock mentions)
    const msgShip = createMsg("123@s.whatsapp.net", ".ship @456", ["456@s.whatsapp.net"]);
    console.log(`\n[INCOMING] .ship @456`);
    await funZone.handleShip(msgShip, mockSock, mockBotState);

    // .match (Group context)
    const msgMatch = createMsg("123@g.us", ".match");
    console.log(`\n[INCOMING] .match (Group)`);
    await funZone.handleMatch(msgMatch, mockSock, mockBotState);

    // --- GAME ZONE (TIC-TAC-TOE) ---
    console.log("\n[TESTING] Game Zone (Tic-Tac-Toe)...");

    // 1. Challenge
    const msgChal = createMsg("123@s.whatsapp.net", ".ttt @456", ["456@s.whatsapp.net"]);
    console.log(`\n[INCOMING] .ttt @456`);
    await gameZone.handleTicTacToe(msgChal, mockSock, mockBotState, ["@456"]);

    // 2. Move (Player 1 - X)
    const msgMove1 = createMsg("123@s.whatsapp.net", ".move 5"); // Center
    console.log(`\n[INCOMING] .move 5 (Player 1)`);
    await gameZone.handleMove(msgMove1, mockSock, mockBotState, "5");

    // 3. Move (Player 2 - O) - Switch user in msg
    const msgMove2 = createMsg("456@s.whatsapp.net", ".move 1"); // Top Left
    // Adjust remoteJid to be SAME chat, different participant
    msgMove2.key.remoteJid = "123@s.whatsapp.net";
    msgMove2.key.participant = "456@s.whatsapp.net";

    console.log(`\n[INCOMING] .move 1 (Player 2)`);
    await gameZone.handleMove(msgMove2, mockSock, mockBotState, "1");

    console.log("\n✅ PHASE 4 TEST COMPLETE.");
};

// Helper: Create Mock Message
function createMsg(jid, text, mentions = []) {
    return {
        key: { remoteJid: jid, participant: jid, fromMe: false, id: "TEST_MSG_" + Date.now() },
        message: {
            extendedTextMessage: {
                text: text,
                contextInfo: { mentionedJid: mentions }
            },
            conversation: text
        },
        pushName: "Tester"
    };
}

// Helper: Run Command Wrapper
async function testCmd(cmdText, handler, arg) {
    console.log(`\n[INCOMING] ${cmdText}`);
    const msg = createMsg("123@s.whatsapp.net", cmdText);
    await handler(msg, mockSock, mockBotState, arg);
}

runTests().catch(console.error);
