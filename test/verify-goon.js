const path = require('path');
const fs = require('fs-extra');
const goonController = require(path.join(__dirname, '../lib/core/controllers/goon-controller'));
const handler = require(path.join(__dirname, '../lib/core/handler'));

/**
 * Mocking a verification flow for Goon Mode
 */
async function verifyGoonMode() {
    console.log("🚀 STARTING GOON MODE VERIFICATION...");

    const botState = {
        mode: '$goon',
        settings: { goonPassword: 'test' },
        activeGoonSession: {},
        cooldowns: {},
        reactions: {},
        groupMetadata: {},
        contacts: {},
        memory: {},
        pendingPH: {}
    };

    const mockSock = {
        decodeJid: (id) => id,
        sendMessage: async (jid, content) => {
            console.log(`[MOCK SOCK] Sending to ${jid}:`, content.text || (content.video ? "Video Media" : "Other Media"));
            return { key: { id: 'mock_msg_id' } };
        }
    };

    const mockMsg = {
        key: { remoteJid: '12345@s.whatsapp.net', fromMe: false },
        pushName: 'TestUser',
        message: { conversation: '.goon start blonde 1' }
    };

    console.log("\n--- TEST: .goon start ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'goon', ['start', 'blonde', '1']);

    console.log("\n--- TEST: .edge ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'edge', []);

    console.log("\n--- TEST: .goonroulette ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'goonroulette', []);

    console.log("\n--- TEST: .stash view ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'stash', ['view']);

    console.log("\n🛑 VERIFICATION COMPLETE. CLEANING UP...");
    if (botState.activeGoonSession['12345@s.whatsapp.net']) {
        clearInterval(botState.activeGoonSession['12345@s.whatsapp.net'].timer);
    }
}

verifyGoonMode().catch(console.error);
