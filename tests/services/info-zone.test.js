import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import infoZone from '../../lib/services/info-zone.js';
import axios from 'axios';

// Mock axios to prevent actual network calls during tests
jest.mock('axios');

describe('Info Zone Services', () => {
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

    describe('Wikipedia', () => {
        it('should require a search query', async () => {
            const msg = createMockMsg({ text: '.wiki' });
            await infoZone.handleWiki(msg, mockSock, mockBotState, '');

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringContaining('❌ Please provide a topic!') }),
                expect.anything()
            );
        });

        it('should return a wikipedia summary for a valid query', async () => {
            const msg = createMockMsg({ text: '.wiki JavaScript' });

            // Mock successful axios response
            axios.get = jest.fn().mockResolvedValue({
                data: {
                    type: 'standard',
                    title: 'JavaScript',
                    extract: 'JavaScript is a programming language.',
                    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/JavaScript' } }
                }
            });

            await infoZone.handleWiki(msg, mockSock, mockBotState, 'JavaScript');

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/\*WIKIPEDIA\*/i) }),
                expect.anything()
            );
        });

        it('should handle "not found" responses from wikipedia gracefully', async () => {
            const msg = createMockMsg({ text: '.wiki fhdjskahfkjds' });

            // Mock not found
            axios.get = jest.fn().mockRejectedValue({
                response: { status: 404 }
            });

            await infoZone.handleWiki(msg, mockSock, mockBotState, 'fhdjskahfkjds');

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringContaining('❌ Failed to fetch Wikipedia article.') }),
                expect.anything()
            );
        });
    });

    describe('Weather', () => {
        it('should return an error if wttr.in fails or returns mock error message', async () => {
            const msg = createMockMsg({ text: '.weather London' });

            // Mock failure
            axios.get = jest.fn().mockRejectedValue(new Error("Network error"));

            await infoZone.handleWeather(msg, mockSock, mockBotState, 'London');

            expect(mockSendMessage).toHaveBeenCalledWith(
                'user@s.whatsapp.net',
                expect.objectContaining({ text: expect.stringMatching(/weather|coming soon/i) }),
                expect.anything()
            );
        });
    });
});