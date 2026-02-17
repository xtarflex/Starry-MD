import goonController from '../lib/core/controllers/goon-controller.js';
import economyBasic from '../lib/systems/economy-basic.js';
import economyShop from '../lib/systems/economy-shop.js';
import funZone from '../lib/games/fun-zone.js';
import gameZone from '../lib/games/game-zone.js';
import infoZone from '../lib/services/info-zone.js';
import { handleGroupCommand } from '../lib/core/admin-commands.js';
import fs from 'fs-extra';
import path from 'path';

// --- SETUP MOCKS ---
const mockSock = {
    user: { id: 'bot@s.whatsapp.net' },
    decodeJid: (id) => id,
    sendMessage: async (jid, content) => {
        console.log(`\n[BOT -> ${jid}]`);
        if (content.text) console.log(`TEXT: ${content.text}`);
        if (content.image) console.log(`IMAGE: [Buffer/Url]`);
        if (content.sticker) console.log(`STICKER: [Buffer]`);
        if (content.mentions) console.log(`MENTIONS: ${content.mentions.join(', ')}`);
        return { key: { id: 'mock_msg_id' } };
    },
    sendPresenceUpdate: async (type, jid) => {
        console.log(`[PRESENCE] ${type} in ${jid}`);
    },
    groupMetadata: async (jid) => {
        if (jid === '12345-group@g.us') {
            return {
                id: jid,
                participants: [
                    { id: '12345@s.whatsapp.net', admin: 'superadmin' },
                    { id: '98765@s.whatsapp.net', admin: null },
                    { id: 'bot@s.whatsapp.net', admin: 'admin' }
                ]
            };
        }
        return {};
    }
};

const botState = {
    mode: '$goon',
    settings: { goonPassword: 'test' },
    activeGoonSession: {},
    cooldowns: new Map(),
    reactions: {},
    groupMetadata: {},
    contacts: {},
    memory: {},
    pendingPH: {}
};

// Helper: Create Mock Message
const createMsg = (text, sender = '12345@s.whatsapp.net', from = '12345@s.whatsapp.net', isGroup = false) => ({
    key: { remoteJid: from, fromMe: false, participant: sender },
    pushName: 'TestUser',
    message: {
        extendedTextMessage: {
            text: text,
            contextInfo: {
                mentionedJid: []
            }
        },
        conversation: text
    }
});

// --- HELPER: MOCK DB ---
// We need to ensure economy writes don't fail.
// Ideally, we'd mock fs.writeJson, but let's just allow it to fail gracefully or ensure the dir exists.
const dbDir = 'c:/StarryMD/lib/database';
fs.ensureDirSync(dbDir); // Ensure DB dir exists

async function runTests() {
    console.log("🚀 STARTING COMPREHENSIVE COMMAND SIMULATION...");

    try {
        // --- 1. GAME ZONE ---
        console.log("\n--- TEST: GAME ZONE ---");
        // Tic-Tac-Toe
        const tttMsg = createMsg('.ttt @opponent');
        tttMsg.message.extendedTextMessage.contextInfo.mentionedJid = ['98765@s.whatsapp.net'];
        try { await gameZone.handleTicTacToe(tttMsg, mockSock, botState, ['@opponent']); } catch (e) { console.error("TTT Error:", e.message); }

        // Coinflip (Mocking user balance might be needed, but let's see if it defaults to 0 and fails or works)
        try { await gameZone.handleCoinflip(createMsg('.coinflip 1'), mockSock, botState, ['1']); } catch (e) { console.error("Coinflip Error:", e.message); }

        // --- 2. ECONOMY ---
        console.log("\n--- TEST: ECONOMY ---");
        // Daily
        try { await economyBasic.handleDaily(createMsg('.daily'), mockSock, botState); } catch (e) { console.error("Daily Error:", e.message); }

        // Balance
        try { await economyBasic.handleBalance(createMsg('.balance'), mockSock, botState); } catch (e) { console.error("Balance Error:", e.message); }

        // Shop (View)
        try { await economyShop.handleShop(createMsg('.shop'), mockSock, botState, []); } catch (e) { console.error("Shop Error:", e.message); }

        // --- 3. ADMIN COMMANDS ---
        console.log("\n--- TEST: ADMIN COMMANDS ---");
        // Kick (Group Context)
        const groupMsg = createMsg('.kick @user', '12345@s.whatsapp.net', '12345-group@g.us', true);
        groupMsg.message.extendedTextMessage.contextInfo.mentionedJid = ['98765@s.whatsapp.net'];
        try {
            // Mocking group check in handleGroupCommand
            await handleGroupCommand(groupMsg, mockSock, botState, 'kick', ['@user']);
        } catch (e) { console.error("Kick Error:", e.message); }

        // --- 4. FUN ZONE ---
        console.log("\n--- TEST: FUN ZONE ---");
        // 8ball
        try { await funZone.handle8Ball(createMsg('.8ball Is this bot working?'), mockSock, botState, ['Is', 'this', 'bot', 'working?']); } catch (e) { console.error("8ball Error:", e.message); }

        // Truth
        try { await funZone.handleTruth(createMsg('.truth'), mockSock, botState); } catch (e) { console.error("Truth Error:", e.message); }

        // --- 5. INFO ZONE ---
        console.log("\n--- TEST: INFO ZONE ---");
        // Lyrics (Mocking search)
        // Note: Real lyrics fetch might fail if API is down, but function call should work.
        try { await infoZone.handleTrends(createMsg('.trends'), mockSock, botState, 'global'); } catch (e) { console.error("Trends Error:", e.message); }

        // Wiki
        try { await infoZone.handleWiki(createMsg('.wiki JavaScript'), mockSock, botState, 'JavaScript'); } catch (e) { console.error("Wiki Error:", e.message); }

        // --- 6. GOON MODE ---
        console.log("\n--- TEST: GOON MODE ---");
        try { await goonController.handleGoon(createMsg('.goon start blonde 1'), mockSock, botState, 'goon', ['start', 'blonde', '1']); } catch (e) { console.error("Goon Error:", e.message); }

    } catch (globalErr) {
        console.error("CRITICAL TEST FAILURE:", globalErr);
    }

    console.log("\n🛑 COMPREHENSIVE VERIFICATION COMPLETE.");
    process.exit(0);
}

runTests().catch(console.error);
