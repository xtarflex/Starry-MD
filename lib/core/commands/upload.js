import { handleUpload, handleList, handleGet, handleDelete, handleCreateFolder, handleUrlize } from '../upload-manager.js';

/**
 * @type {import('../../types').Command[]}
 */
export default [
    {
        name: 'upload',
        aliases: ['savefile'],
        description: 'Save a media file or document to the bot\'s storage.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return handleUpload(msg, sock, botState, args);
        }
    },
    {
        name: 'uploads',
        aliases: ['listuploads', 'ls'],
        description: 'List all your saved files.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return handleList(msg, sock, botState, args);
        }
    },
    {
        name: 'getupload',
        aliases: ['get'],
        description: 'Retrieve a saved file by name.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return handleGet(msg, sock, botState, args);
        }
    },
    {
        name: 'deleteupload',
        aliases: ['delupload', 'rm'],
        description: 'Delete a saved file.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return handleDelete(msg, sock, botState, args);
        }
    },
    {
        name: 'mkdir',
        aliases: ['createfolder'],
        description: 'Create a folder in storage.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return handleCreateFolder(msg, sock, botState, args);
        }
    },
    {
        name: 'url',
        aliases: ['web'],
        description: 'Get a temporary public URL for a stored file.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return handleUrlize(msg, sock, botState, args);
        }
    }
];
