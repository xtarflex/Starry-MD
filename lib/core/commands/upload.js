const uploadManager = require('../upload-manager');

/**
 * @type {import('../../types').Command[]}
 */
module.exports = [
    {
        name: 'upload',
        aliases: ['savefile'],
        description: 'Save a media file or document to the bot\'s storage.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return uploadManager.handleUpload(msg, sock, botState, args);
        }
    },
    {
        name: 'uploads',
        aliases: ['listuploads', 'ls'],
        description: 'List all your saved files.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return uploadManager.handleList(msg, sock, botState, args);
        }
    },
    {
        name: 'getupload',
        aliases: ['get'],
        description: 'Retrieve a saved file by name.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return uploadManager.handleGet(msg, sock, botState, args);
        }
    },
    {
        name: 'deleteupload',
        aliases: ['delupload', 'rm'],
        description: 'Delete a saved file.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return uploadManager.handleDelete(msg, sock, botState, args);
        }
    },
    {
        name: 'mkdir',
        aliases: ['createfolder'],
        description: 'Create a folder in storage.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return uploadManager.handleCreateFolder(msg, sock, botState, args);
        }
    },
    {
        name: 'url',
        aliases: ['web'],
        description: 'Get a temporary public URL for a stored file.',
        category: 'upload',
        execute: async (msg, sock, args, botState) => {
            return uploadManager.handleUrlize(msg, sock, botState, args);
        }
    }
];
