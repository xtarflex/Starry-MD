import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import * as general from '../../lib/core/commands/general.js';
import config from '../../config.js';

describe('General Commands', () => {
    let mockSock;
    let mockBotState;
    let mockSendMessage;

    beforeEach(() => {
        mockSock = createMockSock();
        mockSendMessage = mockSock.sendMessage;
        mockBotState = createMockBotState();
        config.OWNER_ID = 'owner';
    });

    describe('ping command', () => {
        it('should respond with a pong message and speed metrics', async () => {
            const msg = createMockMsg({ text: '.ping' });

            await general.execute(msg, mockSock, [], mockBotState);

            // Should send "Pinging..."
            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringContaining('Pinging...') }),
                expect.anything() // For quoted message param
            );

            // Should react with speed rocket (no extra param)
            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ react: { text: '🚀', key: msg.key } })
            );

            // Should edit the message with final metrics
            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/Pong!.*Response.*Latency/s) })
            );
        });

        it('should apply group rate limit for non-owners', async () => {
            const msg = createMockMsg({ text: '.ping', from: '12345-group@g.us', sender: 'regular@s.whatsapp.net' });

            // Set count to 5 so it triggers the limit
            mockBotState.groupCounts.set('12345-group@g.us', { count: 5, lastReset: Date.now() });

            await general.execute(msg, mockSock, [], mockBotState);

            expect(mockSendMessage).toHaveBeenCalledWith(
                '12345-group@g.us',
                expect.objectContaining({ react: { text: '❄️', key: msg.key } })
            );

            // The ping logic should not run
            expect(mockSendMessage).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ text: expect.stringContaining('Pinging...') }),
                expect.anything()
            );
        });
    });
});