const config = require("../config");
const handler = require("../lib/handler");
const fs = require("fs-extra");
const path = require("path");

/**
 * Starry MD: Multimedia Suite Verification v2
 * -----------------------------------------
 * This script tests the routing and basic logic of the new multimedia commands.
 * Usage: node scripts/test-multimedia.js
 */

async function runTest() {
    console.log(`\n🚀 STARRY MD - MULTIMEDIA VERIFICATION 🚀`);
    console.log(`${"=".repeat(50)}`);

    // 1. Mock botState
    let botState = {
        mode: "$public",
        settings: { viewOnceMode: "chat" },
        warns: new Map(),
        cooldowns: new Map(),
        processedMessages: new Set(),
        contacts: {},
        reactions: {},
        handshakeWaiting: new Set(),
        chatHistory: new Map(),
        botJid: "bot@s.whatsapp.net",
        ownerID: config.OWNER_ID + "@s.whatsapp.net"
    };

    // 2. Mock sock (Baileys)
    const mockSock = {
        user: { id: config.OWNER_ID + "@s.whatsapp.net" },
        sendMessage: async (jid, content, options) => {
            console.log(`   [OUTGOING] -> ${jid}`);
            if (content.text) console.log(`      📝 Text: ${content.text.substring(0, 100)}${content.text.length > 100 ? '...' : ''}`);
            if (content.image) console.log(`      🖼️  Media: [IMAGE BUFFER]`);
            if (content.audio) console.log(`      🎵 Media: [AUDIO BUFFER]`);
            if (content.sticker) console.log(`      ✨ Media: [STICKER BUFFER]`);
            if (content.react) console.log(`      🎭 Reaction: ${content.react.text}`);
            if (content.edit) console.log(`      ✏️  Edit: ${content.text}`);
            return { key: { id: "mock-id" } };
        },
        groupMetadata: async (jid) => {
            return {
                id: jid,
                participants: [
                    { id: config.OWNER_ID + "@s.whatsapp.net", admin: "admin" },
                    { id: "12345@s.whatsapp.net", admin: null }
                ]
            };
        }
    };

    const testCommands = [
        { cmd: ".yts never gonna give you up", desc: "YouTube Search" },
        { cmd: ".play rickroll", desc: "YouTube Play" },
        { cmd: ".doge", desc: "Random Doge Sticker" },
        { cmd: ".cat", desc: "Random Cat Sticker" },
        {
            cmd: ".toimg",
            desc: "Sticker to Image (Quoted Test)",
            quoted: { stickerMessage: { url: "test", fileLength: 100, isAnimated: false } }
        },
        {
            cmd: ".meme top | bottom",
            desc: "Meme Generator (Quoted Test)",
            quoted: { imageMessage: { url: "test" } }
        },
        {
            cmd: ".tourl",
            desc: "To-URL (Quoted Test)",
            quoted: { imageMessage: { url: "test" } }
        }
    ];

    for (const test of testCommands) {
        console.log(`\n[TESTING] ${test.desc}: "${test.cmd}"`);

        const mockMsg = {
            key: {
                remoteJid: "12345@s.whatsapp.net",
                fromMe: false,
                id: "TEST_" + Date.now()
            },
            message: test.quoted ? {
                extendedTextMessage: {
                    text: test.cmd,
                    contextInfo: {
                        quotedMessage: test.quoted,
                        participant: "12345@s.whatsapp.net"
                    }
                }
            } : {
                conversation: test.cmd
            },
            pushName: "Tester"
        };

        try {
            await handler(mockMsg, mockSock, botState);
        } catch (err) {
            console.log(`   ❌ Handler Error: ${err.message}`);
            console.log(err.stack);
        }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✅ DISPATCHER TEST COMPLETE.`);
    console.log(`Note: Full media processing requires real buffers and FFmpeg.`);
}

runTest();
