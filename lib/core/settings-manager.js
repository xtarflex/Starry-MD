import fs from 'fs-extra';
import { join } from 'path';
import utils from './utils';
import { load, save } from './db-manager'; // Re-use the existing robust DB manager

const SETTINGS_FILE = join(__dirname, '../../database/user_settings.json');

class SettingsManager {
    constructor() {
        this.cache = {};
        this.init();
    }

    async init() {
        this.cache = await load(SETTINGS_FILE, {});
    }

    /**
     * Get a setting for a user
     * @param {string} jid - User JID
     * @param {string} key - Setting key
     * @param {*} defaultValue - Default value if not set
     */
    get(jid, key, defaultValue) {
        if (!this.cache[jid]) return defaultValue;
        return this.cache[jid][key] !== undefined ? this.cache[jid][key] : defaultValue;
    }

    /**
     * Set a setting for a user
     * @param {string} jid - User JID
     * @param {string} key - Setting key
     * @param {*} value - Value to set
     */
    async set(jid, key, value) {
        if (!this.cache[jid]) this.cache[jid] = {};
        this.cache[jid][key] = value;

        // Save using the robust dbManager
        await save(SETTINGS_FILE, this.cache);
        return true;
    }
}

export default new SettingsManager();
