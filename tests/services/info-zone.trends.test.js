import { jest } from '@jest/globals';

// Create the mock functions we will use to assert
export const mockAxiosGet = jest.fn();
export const mockLog = jest.fn();

// Register the mocks before any other code imports them
jest.unstable_mockModule('axios', () => ({
    default: {
        get: mockAxiosGet
    }
}));

jest.unstable_mockModule('../../lib/core/utils.js', () => ({
    default: {
        log: mockLog,
        smartTyping: jest.fn()
    }
}));

// Now dynamically import the module we want to test
const { default: infoZone } = await import('../../lib/services/info-zone.js');
const { handleTrends } = infoZone;

describe('InfoZone Service - handleTrends', () => {
    let mockSock;
    let mockMsg;
    let mockBotState;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();
        mockAxiosGet.mockReset();
        mockLog.mockReset();

        mockSock = {
            sendMessage: jest.fn().mockResolvedValue(true)
        };

        mockMsg = {
            key: {
                remoteJid: '12345@s.whatsapp.net',
                id: 'MSG-ID-123'
            }
        };

        mockBotState = {};
    });

    it('should successfully fetch and format default US trends when no query provided', async () => {
        const mockXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <rss>
            <channel>
                <item>
                    <title>Test Trend 1</title>
                    <ht:approx_traffic>100K+</ht:approx_traffic>
                    <ht:news_item>
                        <ht:news_item_title>Test News Title</ht:news_item_title>
                        <ht:news_item_url>https://test.news/url</ht:news_item_url>
                    </ht:news_item>
                </item>
            </channel>
        </rss>`;

        mockAxiosGet.mockResolvedValueOnce({ data: mockXml });

        await handleTrends(mockMsg, mockSock, mockBotState, '');

        expect(mockAxiosGet).toHaveBeenCalledWith('https://trends.google.com/trending/rss', {
            params: { geo: 'US' }
        });

        expect(mockSock.sendMessage).toHaveBeenCalledWith('12345@s.whatsapp.net', {
            react: { text: "📈", key: mockMsg.key }
        });

        const responseCall = mockSock.sendMessage.mock.calls[1];
        expect(responseCall[0]).toBe('12345@s.whatsapp.net');
        expect(responseCall[1].text).toContain('📈 *GOOGLE TRENDS (US)*');
        expect(responseCall[1].text).toContain('*1. Test Trend 1*');
        expect(responseCall[1].text).toContain('📊 Volume: 100K+');
        expect(responseCall[1].text).toContain('📰 News: Test News Title');
        expect(responseCall[1].text).toContain('🔗 https://test.news/url');
    });

    it('should fetch trends for a specific region code', async () => {
        const mockXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <rss>
            <channel>
                <item>
                    <title>GB Trend</title>
                </item>
            </channel>
        </rss>`;

        mockAxiosGet.mockResolvedValueOnce({ data: mockXml });

        await handleTrends(mockMsg, mockSock, mockBotState, 'GB');

        expect(mockAxiosGet).toHaveBeenCalledWith('https://trends.google.com/trending/rss', {
            params: { geo: 'GB' }
        });

        const responseCall = mockSock.sendMessage.mock.calls[1];
        expect(responseCall[1].text).toContain('📈 *GOOGLE TRENDS (GB)*');
        expect(responseCall[1].text).toContain('*1. GB Trend*');
    });

    it('should handle missing fields in the RSS item gracefully', async () => {
        const mockXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <rss>
            <channel>
                <item>
                    <title>Basic Trend</title>
                </item>
            </channel>
        </rss>`;

        mockAxiosGet.mockResolvedValueOnce({ data: mockXml });

        await handleTrends(mockMsg, mockSock, mockBotState, 'US');

        const responseCall = mockSock.sendMessage.mock.calls[1];
        expect(responseCall[1].text).toContain('*1. Basic Trend*');
        expect(responseCall[1].text).toContain('📊 Volume: N/A');
        expect(responseCall[1].text).not.toContain('📰 News:'); // Should skip news if missing
    });

    it('should return error message for invalid region (400 or 404 response)', async () => {
        const error = new Error('Bad Request');
        error.response = { status: 400 };
        mockAxiosGet.mockRejectedValueOnce(error);

        await handleTrends(mockMsg, mockSock, mockBotState, 'INVALID');

        expect(mockSock.sendMessage).toHaveBeenCalledWith('12345@s.whatsapp.net', {
            text: '❌ Invalid region code: INVALID. Please use a valid 2-letter country code (e.g., US, IN, GB).'
        }, { quoted: mockMsg });
        expect(mockLog).toHaveBeenCalledWith('ERROR', expect.stringContaining('Trends Failed: Bad Request'));
    });

    it('should return a generic error message if API fails with other errors', async () => {
        const error = new Error('Network Error');
        mockAxiosGet.mockRejectedValueOnce(error);

        await handleTrends(mockMsg, mockSock, mockBotState, 'US');

        expect(mockSock.sendMessage).toHaveBeenCalledWith('12345@s.whatsapp.net', {
            text: '❌ Failed to fetch Google Trends data.'
        }, { quoted: mockMsg });
    });

    it('should handle empty items array in the valid RSS XML', async () => {
        const mockXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <rss>
            <channel></channel>
        </rss>`; // Empty channel

        mockAxiosGet.mockResolvedValueOnce({ data: mockXml });

        await handleTrends(mockMsg, mockSock, mockBotState, 'US');

        const responseCall = mockSock.sendMessage.mock.calls[1];
        expect(responseCall[1].text).toContain('❌ No trending data found for region: US.');
    });
});
