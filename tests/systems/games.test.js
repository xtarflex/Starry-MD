import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import gameZone from '../../lib/games/game-zone.js';
import economy from '../../lib/systems/economy.js';

describe('Game Systems', () => {
    let mockSock;
    let mockBotState;
    let mockSendMessage;

    beforeEach(() => {
        mockSock = createMockSock();
        mockSendMessage = mockSock.sendMessage;
        mockBotState = createMockBotState();

        // Spy on economy to prevent file edits during test execution.
        // Using `getUserProfile` and `updateBalance` properly based on the new economy architecture in Starry 2.0
        jest.spyOn(economy, 'getUserProfile').mockResolvedValue({ financials: { wallet: 1000, bank: 0 }, inventory: { debit_card: 1 } });
        jest.spyOn(economy, 'updateBalance').mockResolvedValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Coinflip', () => {
        it('should prompt for bet amount if none provided', async () => {
            const msg = createMockMsg({ text: '.coinflip' });
            await gameZone.handleCoinflip(msg, mockSock, mockBotState, []);
            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringContaining('❌ Usage: .coinflip <amount>') }),
                expect.anything()
            );
        });

        it('should execute coinflip with valid bet', async () => {
            const msg = createMockMsg({ text: '.coinflip 100' });

            // Mock random so we always know the outcome (win)
            jest.spyOn(Math, 'random').mockReturnValue(0.9); // Returns > 0.5 usually meaning win depending on implementation

            await gameZone.handleCoinflip(msg, mockSock, mockBotState, ['100']);

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/TAILS|HEADS/i) }),
                expect.anything()
            );
        });
    });

    describe('TicTacToe', () => {
        it('should reject ttt against oneself', async () => {
            const msg = createMockMsg({ text: '.ttt @user', sender: 'user@s.whatsapp.net', mentions: ['user@s.whatsapp.net'] });
            await gameZone.handleTicTacToe(msg, mockSock, mockBotState, ['@user']);

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringContaining('❌ You cannot play against yourself!') }),
                expect.anything()
            );
        });

        it('should initiate a new ttt game correctly', async () => {
            const msg = createMockMsg({ text: '.ttt @opponent', sender: 'user@s.whatsapp.net', mentions: ['opponent@s.whatsapp.net'] });
            await gameZone.handleTicTacToe(msg, mockSock, mockBotState, ['@opponent']);

            // Depending on whether it pings opponent directly or in chat
            expect(mockSendMessage).toHaveBeenCalled();
            const lastCallArgs = mockSendMessage.mock.calls[0];
            expect(lastCallArgs[1].text).toMatch(/challenge|start|challenged/i);
        });
    });
});