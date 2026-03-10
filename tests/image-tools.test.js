import { jest } from '@jest/globals';
import { handleMeme } from '../lib/services/image-tools.js';

describe('image-tools service', () => {
    describe('handleMeme', () => {
        let mockSock;
        let mockMsg;
        let mockBotState;

        beforeEach(() => {
            mockSock = {
                sendMessage: jest.fn().mockResolvedValue(true),
                updateMediaMessage: jest.fn()
            };

            mockMsg = {
                key: { remoteJid: '12345@s.whatsapp.net', id: 'mock-msg-id' },
                message: {
                    imageMessage: {
                        url: 'https://example.com/image.jpg',
                        mimetype: 'image/jpeg'
                    }
                }
            };

            mockBotState = {};
        });

        it('should handle meme generation errors gracefully', async () => {
            // To force an error, we provide an invalid media message structure
            // that causes the downloadMediaMessage to fail or Jimp to throw.
            // A simple way is to pass a corrupted or missing url/directPath.

            // We'll mutate the message so downloadMediaMessage throws an error.
            mockMsg.message.imageMessage = {};

            const args = ['top', 'text', '|', 'bottom', 'text'];

            await handleMeme(mockMsg, mockSock, mockBotState, args);

            // We expect 3 calls to sendMessage:
            // 1. Sending reaction (🎨)
            // 2. The error message

            expect(mockSock.sendMessage).toHaveBeenCalledWith(
                '12345@s.whatsapp.net',
                { react: { text: "🎨", key: mockMsg.key } }
            );

            expect(mockSock.sendMessage).toHaveBeenCalledWith(
                '12345@s.whatsapp.net',
                { text: '❌ Failed to generate meme. Try a clearer image.' },
                { quoted: mockMsg }
            );
        });
    });
});
