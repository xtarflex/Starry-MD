const fs = require('fs-extra');
const path = require('path');
const utils = require('./utils');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const imageTools = require('./image-tools');

const UPLOADS_DIR = path.join(__dirname, '../database/uploads');
const HELP_TEXT = `
📦 *UPLOAD MANAGER HELP*

Sub-commands:
• *upload* [folder] [password] - Save media
• *get* <name/ID> [password] - Retrieve file
• *list* [folder] - List files
• *url* <name/ID> - Get web link for file
• *delete* <name/ID> - Delete file
• *mkdir* <name> - Create folder
• *move* <file> <folder> - Move file
`.trim();

/**
 * Upload Metadata Structure (database/upload_metadata.json)
 * {
 *   "uploads": {
 *      "filename.ext": {
 *          "id": "short_id",
 *          "uploader": "234...",
 *          "password": "hashed_or_plain",
 *          "originalName": "file.jpg",
 *          "timestamp": 123456789,
 *          "folder": "root" 
 *      }
 *   },
 *   "folders": ["root", "personal", "work"]
 * }
 */
const METADATA_FILE = path.join(__dirname, '../database/upload_metadata.json');

// Ensure metadata exists
const ensureMetadata = async () => {
    if (!fs.existsSync(METADATA_FILE)) {
        await fs.writeJson(METADATA_FILE, { uploads: {}, folders: ['root'] });
    }
};

const getMetadata = async () => {
    await ensureMetadata();
    return await fs.readJson(METADATA_FILE);
};

const saveMetadata = async (data) => {
    await fs.writeJson(METADATA_FILE, data, { spaces: 2 });
};

// Helper: Resolve file path (handles subfolders)
const getRealFilePath = (filename, folder = 'root') => {
    // Basic security check to prevent directory traversal
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFile = filename.replace(/(\.\.[\/\\])+/g, '');

    if (safeFolder === 'root') {
        return path.join(UPLOADS_DIR, safeFile);
    }
    return path.join(UPLOADS_DIR, safeFolder, safeFile);
};

// Helper: Generate short ID
const generateId = () => Math.random().toString(36).substring(2, 8);

module.exports = {

    // --- UPLOAD COMMAND ---
    handleUpload: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || msg.message;

        // Check for media
        if (!mediaMsg.imageMessage && !mediaMsg.videoMessage && !mediaMsg.audioMessage && !mediaMsg.documentMessage && !mediaMsg.stickerMessage) {
            return sock.sendMessage(from, { text: "❌ Please quote or attach media to upload." }, { quoted: msg });
        }

        const data = await getMetadata();

        let targetFolder = 'root';
        let password = null;

        // Parse args for [password]
        const passwordRegex = /^\[(.+)\]$/;
        const cleanArgs = [];

        args.forEach(arg => {
            const match = arg.match(passwordRegex);
            if (match) {
                password = match[1];
            } else {
                cleanArgs.push(arg);
            }
        });

        // Remaining arg is folder
        if (cleanArgs[0]) {
            if (data.folders.includes(cleanArgs[0])) {
                targetFolder = cleanArgs[0];
            } else {
                // If they provided a folder name that doesn't exist, maybe warn or default to root?
                // For now, let's auto-create if it looks like a folder name, or reject?
                // Let's reject to prevent typos creating junk folders.
                return sock.sendMessage(from, { text: `❌ Folder '${cleanArgs[0]}' does not exist.\nUse \`.mkdir ${cleanArgs[0]}\` first, or check spelling.` }, { quoted: msg });
            }
        }

        await sock.sendMessage(from, { react: { text: "💾", key: msg.key } });

        try {
            const buffer = await utils.withNetworkTimeout(
                downloadMediaMessage(
                    { message: mediaMsg },
                    'buffer',
                    {},
                    { reuploadRequest: sock.updateMediaMessage }
                ),
                300000, // 5 minutes for larger files
                "Media Download Timed Out"
            );

            // Determine extension
            let ext = '.bin';
            if (mediaMsg.imageMessage) ext = '.jpg';
            else if (mediaMsg.videoMessage) ext = '.mp4';
            else if (mediaMsg.audioMessage) ext = '.mp3';
            else if (mediaMsg.stickerMessage) ext = '.webp';
            else if (mediaMsg.documentMessage) ext = path.extname(mediaMsg.documentMessage.fileName || 'file') || '.bin';

            const timestamp = Date.now();
            const id = generateId();
            const safeName = `file_${id}${ext}`;
            const targetPath = getRealFilePath(safeName, targetFolder);

            // Ensure destination exists
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, buffer);

            // Update Metadata
            data.uploads[safeName] = {
                id: id,
                filename: safeName,
                uploader: msg.key.participant || msg.key.remoteJid,
                password: password,
                originalName: mediaMsg.documentMessage?.fileName || safeName,
                timestamp: timestamp,
                folder: targetFolder,
                size: buffer.length
            };
            await saveMetadata(data);

            let resp = `✅ *UPLOAD SAVED*\n\n📄 *ID:* ${id}\n📂 *Folder:* ${targetFolder}`;
            if (password) resp += `\n🔒 *Password:* [${password}]`;
            resp += `\n\n_Use .get ${id} [password] to retrieve._`;

            await sock.sendMessage(from, { text: resp }, { quoted: msg });
            return;

        } catch (err) {
            utils.log("ERROR", `Upload Failed: ${err.message}`);
            return sock.sendMessage(from, { text: `❌ Upload failed: ${err.message}` }, { quoted: msg });
        }
    },

    // --- GET COMMAND ---
    handleGet: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "❌ Usage: `.get <ID/Filename> [password]`" }, { quoted: msg });

        let query = args[0];
        let inputPass = null;

        // Check for password in args
        const passwordRegex = /^\[(.+)\]$/;
        args.forEach(arg => {
            const match = arg.match(passwordRegex);
            if (match) inputPass = match[1];
            else query = arg; // Assume non-password arg is the query
        });

        const data = await getMetadata();

        // Find file by ID or ID substring or Filename
        let targetFile = null;
        for (const key in data.uploads) {
            const f = data.uploads[key];
            if (f.id === query || f.filename === query || key === query) {
                targetFile = f;
                break;
            }
        }

        if (!targetFile) {
            // Fallback: Check physical file system for legacy uploads (pre-metadata)
            // Legacy files are in 'root' (UPLOADS_DIR) directly
            const legacyPath = path.join(UPLOADS_DIR, query);
            if (fs.existsSync(legacyPath)) {
                // Return legacy file without password check
                await sock.sendMessage(from, { react: { text: "📤", key: msg.key } });

                // Try to detect type from extension
                const ext = path.extname(query).toLowerCase();
                if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                    await sock.sendMessage(from, { image: await fs.readFile(legacyPath), caption: `📂 ${query}` }, { quoted: msg });
                } else if (['.mp4', '.avi'].includes(ext)) {
                    await sock.sendMessage(from, { video: await fs.readFile(legacyPath), caption: `📂 ${query}` }, { quoted: msg });
                } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
                    await sock.sendMessage(from, { audio: await fs.readFile(legacyPath), mimetype: 'audio/mp4' }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { document: await fs.readFile(legacyPath), fileName: query, mimetype: 'application/octet-stream' }, { quoted: msg });
                }
                return;
            }
            return sock.sendMessage(from, { text: "❌ File not found." }, { quoted: msg });
        }

        // Check Password
        if (targetFile.password && targetFile.password !== inputPass) {
            return sock.sendMessage(from, { text: `🔒 *Locked File* \n\nThis file is password protected.\nUsage: \`.get ${query} [password]\`` }, { quoted: msg });
        }

        // Send File
        const filePath = getRealFilePath(targetFile.filename, targetFile.folder);
        if (!fs.existsSync(filePath)) {
            return sock.sendMessage(from, { text: "❌ File missing from disk (Corrupt metadata?)." }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "📤", key: msg.key } });

        const ext = path.extname(targetFile.filename).toLowerCase();
        const content = await fs.readFile(filePath);

        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            await sock.sendMessage(from, { image: content, caption: `📄 ${targetFile.originalName}` }, { quoted: msg });
        } else if (['.mp4'].includes(ext)) {
            await sock.sendMessage(from, { video: content, caption: `📄 ${targetFile.originalName}` }, { quoted: msg });
        } else if (['.mp3', '.audio'].includes(ext)) {
            await sock.sendMessage(from, { audio: content, mimetype: 'audio/mp4' }, { quoted: msg });
        } else if (['.webp'].includes(ext)) {
            await sock.sendMessage(from, { sticker: content }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { document: content, fileName: targetFile.originalName, mimetype: 'application/octet-stream' }, { quoted: msg });
        }
    },

    // --- LIST COMMAND ---
    handleList: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const data = await getMetadata();

        let targetFolder = 'root';
        if (args[0] && data.folders.includes(args[0])) targetFolder = args[0];

        // Filter files in this folder
        const files = Object.values(data.uploads).filter(f => f.folder === targetFolder);

        // Also check physical files if root, to include legacy files
        let legacyFiles = [];
        if (targetFolder === 'root') {
            try {
                const diskFiles = await fs.readdir(UPLOADS_DIR);
                // Filter out directories and files that are already in metadata
                legacyFiles = diskFiles
                    .filter(f => !Object.keys(data.uploads).includes(f) && fs.statSync(path.join(UPLOADS_DIR, f)).isFile());
            } catch (e) {
                // Ignore error if dir doesn't exist
            }
        }

        if (files.length === 0 && legacyFiles.length === 0) {
            return sock.sendMessage(from, { text: `📂 *Folder: ${targetFolder}*\n\n(Empty)` }, { quoted: msg });
        }

        let text = `📂 *FILES: ${targetFolder.toUpperCase()}*\n`;
        text += `_Folders: ${data.folders.join(', ')}_\n\n`;

        files.forEach((f, i) => {
            text += `*${i + 1}.* ${f.originalName} (ID: ${f.id}) ${f.password ? '🔒' : ''}\n`;
        });

        // Add legacy (Limit to 10 to avoid spam)
        if (legacyFiles.length > 0) {
            text += `\n*-- Unmanaged Files --*\n`;
            legacyFiles.slice(0, 10).forEach(f => text += `• ${f} \n`);
        }

        text += `\nUse .get <id> or .get <filename> to download.`;

        return sock.sendMessage(from, { text }, { quoted: msg });
    },

    // --- DELETE COMMAND ---
    handleDelete: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "❌ Usage: `.delete <ID/Filename>`" }, { quoted: msg });

        // Only owner or uploader should delete? For now, open to all or check mismatch?
        // Let's restrict to owner for now to be safe, or if uploader matches sender.
        const isOwner = utils.isOwner(msg.key.participant || msg.key.remoteJid);

        const query = args[0];
        const data = await getMetadata();

        let targetFile = null;
        let targetKey = null;

        for (const key in data.uploads) {
            const f = data.uploads[key];
            if (f.id === query || f.filename === query) {
                targetFile = f;
                targetKey = key;
                break;
            }
        }

        if (targetFile) {
            if (!isOwner && targetFile.uploader !== (msg.key.participant || msg.key.remoteJid)) {
                return sock.sendMessage(from, { text: "❌ You can only delete your own uploads." }, { quoted: msg });
            }

            const filePath = getRealFilePath(targetFile.filename, targetFile.folder);
            if (fs.existsSync(filePath)) await fs.unlink(filePath);

            delete data.uploads[targetKey];
            await saveMetadata(data);

            return sock.sendMessage(from, { text: `✅ File ${targetFile.originalName} deleted.` }, { quoted: msg });
        }

        // Check legacy
        const legacyPath = path.join(UPLOADS_DIR, query);
        if (fs.existsSync(legacyPath)) {
            // Legacy deletion - Owner only mainly
            /* if (!isOwner) return sock.sendMessage(from, { text: "❌ Legacy files can only be deleted by Admin." }); */
            await fs.unlink(legacyPath);
            return sock.sendMessage(from, { text: `✅ File ${query} deleted (Unmanaged).` }, { quoted: msg });
        }

        return sock.sendMessage(from, { text: "❌ File not found." }, { quoted: msg });
    },

    // --- FOLDER COMMANDS ---
    handleCreateFolder: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "❌ Usage: `.mkdir <name>`" }, { quoted: msg });

        const folderName = args[0].replace(/[^a-zA-Z0-9_-]/g, ''); // Sanitize
        const data = await getMetadata();

        if (data.folders.includes(folderName)) {
            return sock.sendMessage(from, { text: "❌ Folder already exists." }, { quoted: msg });
        }

        // Create physical dir
        await fs.ensureDir(path.join(UPLOADS_DIR, folderName));

        data.folders.push(folderName);
        await saveMetadata(data);

        return sock.sendMessage(from, { text: `✅ Folder *${folderName}* created.` }, { quoted: msg });
    },

    // --- URL-IZE COMMAND ---
    handleUrlize: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        if (!args[0]) return sock.sendMessage(from, { text: "❌ Usage: `.url <ID/Filename>` to host a stored file." }, { quoted: msg });

        const query = args[0];
        const data = await getMetadata();

        let targetFile = null;
        for (const key in data.uploads) {
            const f = data.uploads[key];
            if (f.id === query || f.filename === query) {
                targetFile = f;
                break;
            }
        }

        let filePath = null;
        if (targetFile) {
            if (targetFile.password) return sock.sendMessage(from, { text: "❌ Cannot url-ize password protected files." }, { quoted: msg });
            filePath = getRealFilePath(targetFile.filename, targetFile.folder);
        } else {
            // Legacy check
            const legacyPath = path.join(UPLOADS_DIR, query);
            if (fs.existsSync(legacyPath)) filePath = legacyPath;
        }

        if (!filePath || !fs.existsSync(filePath)) {
            return sock.sendMessage(from, { text: "❌ File not found." }, { quoted: msg });
        }

        await sock.sendMessage(from, { react: { text: "☁️", key: msg.key } });

        try {
            const url = await imageTools.uploadToWeb(filePath);
            await sock.sendMessage(from, {
                text: `☁️ *FILE HOSTED*\n\n📄 *File:* ${targetFile ? targetFile.originalName : query}\n🔗 *Link:* ${url}`
            }, { quoted: msg });
        } catch (err) {
            return sock.sendMessage(from, { text: `❌ Failed to host file: ${err.message}` }, { quoted: msg });
        }
    }
};
