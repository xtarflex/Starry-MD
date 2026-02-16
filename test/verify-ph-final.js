
const phCommand = require('../lib/commands/ph');
const axios = require('axios');
const utils = require('../lib/utils');

async function verifyFinal() {
    console.log("--- FINAL VERIFICATION: .PH COMMAND ---");

    // Mock Objects
    const mockSock = {
        sendMessage: async (jid, content, options) => {
            if (content.text && content.edit) {
                console.log(`[MOCK] Editing status to: ${content.text}`);
            } else if (content.text) {
                console.log(`[MOCK] Sending message: ${content.text}`);
                return { key: { id: 'status_key_' + Math.random() } };
            } else if (content.video) {
                console.log(`[MOCK] Sending video: ${content.caption}`);
                return { key: { id: 'video_key' } };
            }
        },
        readMessages: async () => { }
    };

    const mockMsg = {
        key: { remoteJid: 'test@g.us', participant: 'user@s.whatsapp.net' },
        message: { conversation: '.ph fuck' }
    };

    const botState = {};

    console.log("\n1. Testing SEARCH: .ph fuck");
    await phCommand.execute(mockMsg, mockSock, ['fuck'], botState);

    console.log("\n2. Testing URL: .ph <direct link>");
    const testUrl = 'https://www.pornhub.com/view_video.php?viewkey=67be57a6f2eb5';
    await phCommand.execute(mockMsg, mockSock, [testUrl], botState);
}

verifyFinal();
