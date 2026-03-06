import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import funZone from '../../lib/games/fun-zone.js';

describe('Fun Systems', () => {
    let mockSock;
    let mockBotState;
    let mockSendMessage;

    beforeEach(() => {
        mockSock = createMockSock();
        mockSendMessage = mockSock.sendMessage;
        mockBotState = createMockBotState();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('8Ball', () => {
        it('should return a random answer even without a question (edge case)', async () => {
            const msg = createMockMsg({ text: '.8ball' });
            await funZone.handle8Ball(msg, mockSock, mockBotState, []);

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/🎱 \*8-Ball says:\*/i) }),
                expect.anything()
            );
        });

        it('should return a random answer to a question', async () => {
            const msg = createMockMsg({ text: '.8ball am I cool?' });

            // Mock random so we can assert predictability if needed, or just check format
            await funZone.handle8Ball(msg, mockSock, mockBotState, ['am', 'I', 'cool?']);

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/🎱 \*8-Ball says:\*/i) }),
                expect.anything()
            );
        });
    });

    describe('Truth or Dare', () => {
        it('should return a truth question', async () => {
            const msg = createMockMsg({ text: '.truth' });
            await funZone.handleTruth(msg, mockSock, mockBotState);

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/🧠 \*TRUTH:\*/i) }),
                expect.anything()
            );
        });

        it('should return a dare', async () => {
            const msg = createMockMsg({ text: '.dare' });
            await funZone.handleDare(msg, mockSock, mockBotState);

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/🔥 \*DARE:\*/i) }),
                expect.anything()
            );
        });
    });
});