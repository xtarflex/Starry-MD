import { jest } from '@jest/globals';

// Create a reusable mock for Baileys/Socket
export const createMockSock = () => ({
    user: { id: 'bot@s.whatsapp.net' },
    sendMessage: jest.fn().mockResolvedValue({ key: { id: 'mock-msg-id', remoteJid: 'test@s.whatsapp.net' } }),
    decodeJid: jest.fn((jid) => {
        if (!jid) return jid;
        return jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;
    }),
    groupMetadata: jest.fn().mockResolvedValue({
        id: '12345-group@g.us',
        participants: [
            { id: 'admin@s.whatsapp.net', admin: 'superadmin' },
            { id: 'user@s.whatsapp.net', admin: null },
            { id: 'bot@s.whatsapp.net', admin: 'admin' }
        ],
        subject: 'Mock Group'
    }),
    simulateTyping: jest.fn(),
    simulateAudio: jest.fn(),
    delay: jest.fn(),
    groupParticipantsUpdate: jest.fn(),
    groupUpdateSubject: jest.fn(),
    groupUpdateDescription: jest.fn(),
    sendPresenceUpdate: jest.fn()
});

// Create a reusable mock for botState
export const createMockBotState = () => ({
    mode: '$public',
    bannedChats: [],
    contacts: {
        'bot@s.whatsapp.net': { name: 'Starry Bot', sync: true },
        'admin@s.whatsapp.net': { name: 'Admin', sync: true },
        'user@s.whatsapp.net': { name: 'User', sync: true }
    },
    cooldowns: new Map(),
    groupCounts: new Map(),
    handshakeWaiting: new Set(),
    reactions: {
        '🔥': ['lit', 'fire'],
        '❤️': ['love', 'heart']
    },
    groupMetadata: {},
    groupSettings: {},
    statusPosters: {},
    activeGoonSession: {},
    memory: {},
    pendingPH: {}
});

// Create a mock Baileys message object
export const createMockMsg = ({
    text = '',
    from = 'user@s.whatsapp.net',
    sender = 'user@s.whatsapp.net',
    pushName = 'Test User',
    isMe = false,
    mentions = []
} = {}) => ({
    key: { remoteJid: from, fromMe: isMe, participant: sender, id: 'msg-' + Math.random().toString(36).substr(2, 9) },
    message: {
        extendedTextMessage: {
            text: text,
            contextInfo: {
                mentionedJid: mentions
            }
        },
        conversation: text
    },
    pushName: pushName
});
