import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import * as adminCommands from '../../lib/core/commands/admin.js';

describe('Admin Commands', () => {
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

    it('should prevent execution in DMs', async () => {
        const kickCmd = adminCommands.default.find(c => c.name === 'kick');
        const msg = createMockMsg({ text: '.kick', from: 'user@s.whatsapp.net', sender: 'user@s.whatsapp.net' }); // DM

        await kickCmd.execute(msg, mockSock, [], mockBotState);
        expect(mockSendMessage).toHaveBeenCalledWith(
            'user@s.whatsapp.net',
            expect.objectContaining({ text: expect.stringContaining('❌ This command can only be used in groups!') }),
            expect.anything()
        );
    });

    it('should prevent execution if sender is not admin', async () => {
        const kickCmd = adminCommands.default.find(c => c.name === 'kick');
        const msg = createMockMsg({ text: '.kick', from: '12345-group@g.us', sender: 'user@s.whatsapp.net' });

        // Return group metadata where user is not admin
        mockSock.groupMetadata.mockResolvedValue({
            participants: [{ id: 'user@s.whatsapp.net', admin: null }, { id: 'bot@s.whatsapp.net', admin: 'admin' }]
        });

        await kickCmd.execute(msg, mockSock, ['@someone'], mockBotState);
        expect(mockSendMessage).toHaveBeenCalledWith(
            '12345-group@g.us',
            expect.objectContaining({ text: expect.stringContaining('❌ Only admins can use this command!') }),
            expect.anything()
        );
    });

    it('should prevent execution if bot is not admin', async () => {
        const kickCmd = adminCommands.default.find(c => c.name === 'kick');
        const msg = createMockMsg({ text: '.kick', from: '12345-group@g.us', sender: 'admin@s.whatsapp.net' });

        // Return group metadata where bot is not admin but user is
        mockSock.groupMetadata.mockResolvedValue({
            participants: [{ id: 'admin@s.whatsapp.net', admin: 'admin' }, { id: 'bot@s.whatsapp.net', admin: null }]
        });

        await kickCmd.execute(msg, mockSock, ['@someone'], mockBotState);
        expect(mockSendMessage).toHaveBeenCalledWith(
            '12345-group@g.us',
            expect.objectContaining({ text: expect.stringContaining('I need to be an admin to perform this action!') }),
            expect.anything()
        );
    });
});