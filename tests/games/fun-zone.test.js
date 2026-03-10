import { jest } from '@jest/globals';

jest.unstable_mockModule('../../lib/core/utils.js', () => ({
    simulateTyping: jest.fn(),
    log: jest.fn()
}));

const { handle8Ball } = await import('../../lib/games/fun-zone.js');

describe('fun-zone 8Ball', () => {
    let mockSock;
    let mockMsg;
    let mockBotState;

    beforeEach(() => {
        mockSock = {
            sendMessage: jest.fn(),
        };
        mockMsg = {
            key: {
                remoteJid: '123456789@s.whatsapp.net',
            },
        };
        mockBotState = {};

    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should ask for a question when query is undefined', async () => {
        await handle8Ball(mockMsg, mockSock, mockBotState, undefined);
        expect(mockSock.sendMessage).toHaveBeenCalledWith(
            '123456789@s.whatsapp.net',
            { text: 'Ask a question!' }
        );
    });

    it('should ask for a question when query is null', async () => {
        await handle8Ball(mockMsg, mockSock, mockBotState, null);
        expect(mockSock.sendMessage).toHaveBeenCalledWith(
            '123456789@s.whatsapp.net',
            { text: 'Ask a question!' }
        );
    });

    it('should ask for a question when query is an empty string', async () => {
        await handle8Ball(mockMsg, mockSock, mockBotState, '');
        expect(mockSock.sendMessage).toHaveBeenCalledWith(
            '123456789@s.whatsapp.net',
            { text: 'Ask a question!' }
        );
    });

    it('should ask for a question when query is whitespace', async () => {
        await handle8Ball(mockMsg, mockSock, mockBotState, '   ');
        expect(mockSock.sendMessage).toHaveBeenCalledWith(
            '123456789@s.whatsapp.net',
            { text: 'Ask a question!' }
        );
    });

    it('should send an 8-ball answer when query is valid', async () => {
        const query = 'Will I be rich?';
        await handle8Ball(mockMsg, mockSock, mockBotState, query);

        expect(mockSock.sendMessage).toHaveBeenCalled();
        const callArgs = mockSock.sendMessage.mock.calls[0];
        expect(callArgs[0]).toBe('123456789@s.whatsapp.net');
        expect(callArgs[1].text).toMatch(/🎱 \*8-Ball says:\*\n\n.+/);
        expect(callArgs[2]).toEqual({ quoted: mockMsg });
    });
});
