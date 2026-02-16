import { proto, initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import dbManager from './db-manager.js';
import utils from './utils.js';

/**
 * Custom Database Auth Adapter for Baileys
 * Stores authentication state in a single JSON file managed by db-manager.
 * 
 * @param {string} sessionId - The ID of the session (e.g., 'default')
 * @returns {Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }>}
 */
export const useDatabaseAuth = async (sessionId) => {
    const fileName = `database/session_${sessionId}.json`;

    // Load existing state or initialize defaults
    // We use BufferJSON reviver to restore Buffer objects from JSON
    let state = await dbManager.load(fileName, {}, { reviver: BufferJSON.reviver });

    // Initialize creds if missing
    if (!state.creds) {
        state.creds = initAuthCreds();
        state.keys = {}; // Ensure keys object exists
    }

    return {
        state: {
            creds: state.creds,
            keys: {
                get: (type, ids) => {
                    const keyType = state.keys[type];
                    return ids.reduce((dict, id) => {
                        let value = keyType ? keyType[id] : null;
                        if (value) {
                            if (type === 'app-state-sync-key') {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            dict[id] = value;
                        }
                        return dict;
                    }, {});
                },
                set: (data) => {
                    for (const type in data) {
                        state.keys[type] = state.keys[type] || {};
                        for (const id in data[type]) {
                            state.keys[type][id] = data[type][id];
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            // throttled save handled by db-manager queue, but here we call explicitly
            // We use BufferJSON replacer to serialize Buffers to JSON
            await dbManager.save(fileName, state, { replacer: BufferJSON.replacer });
        }
    };
};
