const infoZone = require('../lib/info-zone');
const utils = require('../lib/utils');
const searchSession = require('../lib/search-session');

// Mock tools
utils.smartTyping = async () => console.log("[MOCK] Typing...");
utils.simulateTyping = async () => { };
utils.log = (tag, msg) => console.log(`[LOG] [${tag}] ${msg}`);
const mockSock = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (jid, content) => {
        console.log(`\n--- MSG to ${jid} ---`);
        if (content.text) console.log(content.text);
        if (content.react) console.log(`REACT: ${content.react.text}`);
        return { key: { id: '123' } };
    }
};
const mockMsg = { key: { remoteJid: 'user@s.whatsapp.net' } };

async function debug() {
    console.log("=== TEST 1: .news (No Args) ===");
    // Should default to Top Stories
    await infoZone.handleNews(mockMsg, mockSock, {}, "");

    console.log("\n=== TEST 2: .news sport (Category) ===");
    await infoZone.handleNews(mockMsg, mockSock, {}, "sport");

    console.log("\n=== TEST 3: .news sports (Category Plural) ===");
    await infoZone.handleNews(mockMsg, mockSock, {}, "sports");
}

debug();
