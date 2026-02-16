const infoZone = require('../lib/info-zone');
const utils = require('../lib/utils');
const searchSession = require('../lib/search-session');

// Mock Utils
utils.smartTyping = async () => { };
utils.simulateTyping = async () => { };
utils.log = (tag, msg) => console.log(`[LOG] [${tag}] ${msg}`);
utils.sendAlbum = async () => console.log("[MOCK] Send Album");

const mockSock = {
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: async (jid, content, options) => {
        console.log(`\n--- MSG to ${jid} ---`);
        if (content.text) console.log("TEXT:", content.text.slice(0, 150).replace(/\n/g, ' '));
        if (content.image) console.log("IMAGE:", content.image.url);
        if (content.caption) console.log("CAPTION:", content.caption.slice(0, 100).replace(/\n/g, ' '));
        return { key: { id: 'MOCK' } };
    }
};

const mockMsg = { key: { remoteJid: 'user@s.whatsapp.net' } };

async function verify() {
    console.log("=== 1. YAHOO CATEGORY 'TECH' ===");
    await infoZone.handleNews(mockMsg, mockSock, {}, "tech 2");

    await utils.delay(1000);
    const session1 = searchSession.getSelection('user@s.whatsapp.net', 1);
    if (session1 && session1.data.source === "Yahoo News") {
        console.log("✅ Correctly routed to Yahoo News");
    } else {
        console.log("❌ Failed Routing (Expected Yahoo):", session1?.data?.source);
    }

    console.log("\n=== 2. GOOGLE SEARCH 'BITCOIN' ===");
    await infoZone.handleNews(mockMsg, mockSock, {}, "bitcoin 2");

    await utils.delay(1000);
    const session2 = searchSession.getSelection('user@s.whatsapp.net', 1);
    if (session2 && session2.data.source === "Google News") {
        console.log("✅ Correctly routed to Google News");
    } else {
        console.log("❌ Failed Routing (Expected Google):", session2?.data?.source);
    }
}

verify();
