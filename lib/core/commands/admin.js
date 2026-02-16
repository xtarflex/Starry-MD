import { handleGroupCommand } from '../admin-commands';

/**
 * @type {import('../../types').Command[]}
 */
export default [
    {
        name: 'kick',
        description: 'Kick a member from the group.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'kick', args)
    },
    {
        name: 'add',
        description: 'Add a user to the group.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'add', args)
    },
    {
        name: 'promote',
        description: 'Promote a member to admin.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'promote', args)
    },
    {
        name: 'demote',
        description: 'Demote an admin to member.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'demote', args)
    },
    {
        name: 'group',
        description: 'Change group settings (open/close).',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'group', args)
    },
    {
        name: 'antilink',
        description: 'Activate/Deactivate Antilink protocol.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'antilink', args)
    },
    {
        name: 'welcome',
        description: 'Toggle welcome messages.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'welcome', args)
    },
    {
        name: 'goodbye',
        description: 'Toggle goodbye messages.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'goodbye', args)
    },
    {
        name: 'tagall',
        description: 'Mention all group members.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'tagall', args)
    },
    {
        name: 'hidetag',
        description: 'Mention all members invisibly.',
        category: 'admin',
        adminOnly: true,
        execute: async (msg, sock, args, botState) => handleGroupCommand(msg, sock, botState, 'hidetag', args)
    }
];
