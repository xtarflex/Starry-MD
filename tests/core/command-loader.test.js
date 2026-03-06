import { jest } from '@jest/globals';
import { loadCommands } from '../../lib/core/command-loader.js';

describe('Command Loader', () => {
    it('should successfully load command files from the commands directory', async () => {
        const commands = await loadCommands();
        expect(commands).toBeDefined();
        expect(commands instanceof Map).toBeTruthy();
        // Since we know commands like ping, admin, economy exist
        expect(commands.has('ping')).toBe(true);
        expect(commands.has('admin')).toBe(false); // file is admin.js, commands inside vary

        // Assert the returned map contains command objects with necessary properties
        const pingCmd = commands.get('ping');
        expect(pingCmd).toHaveProperty('name', 'ping');
        expect(pingCmd).toHaveProperty('execute');
        expect(typeof pingCmd.execute).toBe('function');
    });

    it('should register command aliases', async () => {
        const commands = await loadCommands();

        // The ping command has aliases ['p', 'speed']
        expect(commands.has('p')).toBe(true);
        expect(commands.has('speed')).toBe(true);

        const aliasCmd = commands.get('speed');
        expect(aliasCmd.name).toBe('ping');
    });
});