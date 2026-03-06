import { jest } from '@jest/globals';
import { createMockSock, createMockBotState, createMockMsg } from '../utils/mock-utils.js';
import router from '../../lib/core/router.js';
import fs from 'fs-extra';

// Mock fs-extra for router config
jest.spyOn(fs, 'readJSON').mockImplementation(async () => ({
    routes: {
        'kick': {
            allowedGroups: ['12345-group@g.us'],
            groupName: 'Admin Group'
        }
    },
    categories: {}
}));
jest.spyOn(fs, 'writeJSON').mockImplementation(async () => {});

describe('Router', () => {
    beforeEach(async () => {
        // Ensure router config is loaded before tests
        await router.loadRouter();
    });

    it('should allow command in allowed group', async () => {
        const result = await router.checkRoute('kick', '12345-group@g.us');
        expect(result.allowed).toBe(true);
    });

    it('should deny command in unallowed group', async () => {
        const result = await router.checkRoute('kick', 'wrong-group@g.us');
        expect(result.allowed).toBe(false);
        expect(result.redirect).toBeDefined();
        expect(result.redirect.groupName).toBe('Admin Group');
    });

    it('should check if a group is known', () => {
        expect(router.isKnownGroup('12345-group@g.us')).toBe(true);
        expect(router.isKnownGroup('unknown@g.us')).toBe(false);
    });
});