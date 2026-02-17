import path from 'path';
import { fileURLToPath } from 'url';
import goonController from '../lib/core/controllers/goon-controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    // Simulate valid start command
    await goonController.handleGoon(mockMsg, mockSock, botState, 'goon', ['start', 'blonde', '1']);

    console.log("\n--- TEST: Safety Check (Zero/Negative Interval) ---");
    // Simulate malicious/accidental zero interval
    const maliciousMsg = { ...mockMsg, message: { conversation: '.goon start blonde 0' } };
    await goonController.handleGoon(maliciousMsg, mockSock, botState, 'goon', ['start', 'blonde', '0']);

    // VERIFY: Did it default to 5?
    console.log("Session Interval (should be 5):", botState.activeGoonSession['12345@s.whatsapp.net'].interval);

    console.log("\n--- TEST: .edge ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'edge', []);

    console.log("\n--- TEST: .goonroulette ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'goonroulette', []);

    console.log("\n--- TEST: .stash view ---");
    await goonController.handleGoon(mockMsg, mockSock, botState, 'stash', ['view']);

    console.log("\n🛑 VERIFICATION COMPLETE. CLEANING UP...");
    if (botState.activeGoonSession['12345@s.whatsapp.net']) {
        const session = botState.activeGoonSession['12345@s.whatsapp.net'];
        clearTimeout(session.timer);
        session.active = false;
    }
}

verifyGoonMode().catch(console.error);
