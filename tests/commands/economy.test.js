import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import * as economyCommands from '../../lib/core/commands/economy.js';
import economyBasic from '../../lib/systems/economy-basic.js';

describe('Economy Commands', () => {
    let mockSock;
    let mockBotState;
    let mockSendMessage;

    beforeEach(() => {
        mockSock = createMockSock();
        mockSendMessage = mockSock.sendMessage;
        mockBotState = createMockBotState();

        // Spy on economy modules
        jest.spyOn(economyBasic, 'handleBalance').mockResolvedValue();
        jest.spyOn(economyBasic, 'handleDaily').mockResolvedValue();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should route .balance correctly', async () => {
        // Because economy.js exposes an array of commands, we need to find the specific command
        const balanceCmd = economyCommands.default.find(c => c.name === 'balance');
        const msg = createMockMsg({ text: '.balance' });

        await balanceCmd.execute(msg, mockSock, [], mockBotState);
        expect(economyBasic.handleBalance).toHaveBeenCalledWith(msg, mockSock, mockBotState); // Removed extra args array based on trace
    });

    it('should route .daily correctly', async () => {
        const dailyCmd = economyCommands.default.find(c => c.name === 'daily');
        const msg = createMockMsg({ text: '.daily' });

        await dailyCmd.execute(msg, mockSock, [], mockBotState);
        expect(economyBasic.handleDaily).toHaveBeenCalledWith(msg, mockSock, mockBotState);
    });
});