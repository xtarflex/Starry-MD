import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import handler from '../../lib/core/handler.js';
import config from '../../config.js';
import utils from '../../lib/core/utils.js';
import economy from '../../lib/systems/economy.js';

describe('Handler Dispatcher', () => {
    let mockSock;
    let mockBotState;
    let mockSendMessage;

    beforeEach(() => {
        mockSock = createMockSock();
        mockSendMessage = mockSock.sendMessage;
        mockBotState = createMockBotState();
        config.OWNER_ID = 'owner';
        config.PREFIX_TOOL = '.';
        config.PREFIX_SYSTEM = '$';

        // Mock economy user profile so it doesn't try to read actual DB files in handler
        jest.spyOn(economy, 'getUserProfile').mockImplementation(async () => ({ jail_until: 0 }));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should ignore messages without remoteJid', async () => {
        const msg = { key: {} };
        await handler(msg, mockSock, mockBotState);
        expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should enforce blacklist correctly', async () => {
        const msg = createMockMsg({ text: '.ping', from: 'banned@s.whatsapp.net', sender: 'banned@s.whatsapp.net' });
        mockBotState.bannedChats = ['banned@s.whatsapp.net'];

        await handler(msg, mockSock, mockBotState);

        // Should delete the message, not respond
        expect(mockSendMessage).toHaveBeenCalledWith('banned@s.whatsapp.net', expect.objectContaining({ delete: msg.key }), undefined);
    });

    it('should ignore non-owners when mode is $sleep', async () => {
        mockBotState.mode = '$sleep';
        const msg = createMockMsg({ text: '.ping', sender: 'regular@s.whatsapp.net' });

        await handler(msg, mockSock, mockBotState);

        expect(mockSendMessage).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ text: expect.stringMatching(/Pong/i) }));
    });

    it('should trigger auto-reactions on keywords', async () => {
        const msg = createMockMsg({ text: 'this is so lit!' });

        await handler(msg, mockSock, mockBotState);

        expect(mockSendMessage).toHaveBeenCalledWith(
            'user@s.whatsapp.net',
            expect.objectContaining({ react: { text: '🔥', key: msg.key } }),
            undefined
        );
    });

    it('should execute known command if permitted', async () => {
        const msg = createMockMsg({ text: '.ping', sender: 'owner@s.whatsapp.net' }); // Owner bypasses any limits

        await handler(msg, mockSock, mockBotState);

        // Given that we loaded commands in handler (via loadCommands), it should find and execute .ping
        expect(mockSendMessage).toHaveBeenCalledWith(
            'user@s.whatsapp.net',
            expect.objectContaining({ text: expect.stringMatching(/Pinging/) }),
            expect.anything()
        );
    });
});