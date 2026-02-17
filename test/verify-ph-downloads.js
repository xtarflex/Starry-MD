import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import phCommand from '../lib/core/commands/ph.js'
import phService from '../lib/services/ph-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../goon_test');
const MEDIA_DIR = path.join(ROOT_DIR, 'media');
const FOLDERS = {
    image: path.join(MEDIA_DIR, 'image'),
    video: path.join(MEDIA_DIR, 'video'),
    gif: path.join(MEDIA_DIR, 'gif'),
    sticker: path.join(MEDIA_DIR, 'sticker')
};

// 1. Setup Directories
async function setup() {
    console.log("📂 Setting up 'goon_test' directory...");
    await fs.remove(ROOT_DIR);
    await fs.ensureDir(ROOT_DIR);
    for (const folder of Object.values(FOLDERS)) {
        await fs.ensureDir(folder);
    }
    console.log("✅ Directories ready.");
}

// 2. Mock Sock
const mockSock = {
    user: { id: 'mock_bot@s.whatsapp.net' },
    sendMessage: async (jid, content, options) => {
        if (content.text) {
            console.log(`📝 [TEXT] ${content.text.split('\n')[0]}...`);
            return { key: { id: 'mock_msg_id' } };
        }

        try {
            const headers = {
                'Referer': 'https://www.pornhub.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            if (content.video) {
                let dest = path.join(FOLDERS.video, `vid_${Date.now()}.mp4`);
                if (content.gifPlayback) {
                    dest = path.join(FOLDERS.gif, `gif_${Date.now()}.mp4`);
                    console.log("🎞️ [GIF] Saving GIF...");
                } else {
                    console.log("🎬 [VIDEO] Saving Video Stream...");
                }

                if (content.video.pipe) {
                    const writer = fs.createWriteStream(dest);
                    content.video.pipe(writer);
                    return new Promise((resolve, reject) => {
                        writer.on('finish', () => {
                            console.log(`✅ Saved to ${dest}`);
                            resolve({ key: { id: 'mock_vid_id' } });
                        });
                        writer.on('error', reject);
                    });
                } else if (content.video.url) {
                    const response = await axios({ url: content.video.url, method: 'GET', responseType: 'stream', headers });
                    const writer = fs.createWriteStream(dest);
                    response.data.pipe(writer);
                    return new Promise((resolve, reject) => {
                        writer.on('finish', () => {
                            console.log(`✅ Saved to ${dest}`);
                            resolve({ key: { id: 'mock_vid_id' } });
                        });
                        writer.on('error', reject);
                    });
                }
            }
        } catch (e) {
            console.error("❌ Failed to save media:", e.message);
        }

        return { key: { id: 'mock_msg_id' } };
    }
};

// 3. Command Execution Helper
async function runCommand(cmd, args) {
    const from = '123456@s.whatsapp.net';
    const msg = {
        key: { remoteJid: from, fromMe: false, id: 'test_msg_id' },
        message: { conversation: `.ph ${cmd} ${args.join(' ')}` },
        pushName: 'Tester'
    };

    // Mock Bot State - Reset for each test
    const botState = {
        pendingPH: {},
        cooldowns: new Map()
    };

    console.log(`\n▶️ RUNNING: .ph ${cmd} ${args.join(' ')}`);
    try {
        await phCommand.execute(msg, mockSock, [cmd, ...args], botState);

        // Handle pending prompts (for photo albums AND videos)
        if (botState.pendingPH[from]) {
            const type = botState.pendingPH[from].type;
            console.log(`🔄 [INTERACTION] Pending ${type} detected. Replying 'yes'...`);

            const replyMsg = { ...msg, message: { conversation: 'yes' } };
            replyMsg.message.extendedTextMessage = {
                contextInfo: {
                    quotedMessage: { conversation: 'Confirmation required' },
                    participant: 'mock_bot@s.whatsapp.net'
                }
            };

            // Re-execute to trigger pending logic
            await phCommand.execute(replyMsg, mockSock, [], botState);
        }
    } catch (e) {
        console.error("❌ Command Failed:", e);
    }
}

// 4. Main Test Sequence
async function start() {
    await setup();

    // Test 4: Video
    await runCommand('video', ['short']);

    console.log("\n🏁 Verification Complete. Checking folders...");

    // Verify results
    const counts = {};
    for (const [type, dir] of Object.entries(FOLDERS)) {
        const files = await fs.readdir(dir);
        counts[type] = files.length;
        console.log(`📁 ${type.toUpperCase()}: ${files.length} files found.`);
    }
}

start();
