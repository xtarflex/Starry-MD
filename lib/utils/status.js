import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs-extra';
import path from 'path';
import config from '../../config.js';
import utils from '../core/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATUS_DB = path.join(__dirname, '../../database/status_store.json');
const SETTINGS_DB = path.join(__dirname, '../../database/bot_settings.json');

/* 
 * Status Management Module
 */
const status = {
    /* 
     * Get active status settings (from DB or config)
     */
    getSettings: () => {
        const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};
        return {
            schedule: settings.statusSchedule || config.STATUS_SCHEDULE,
            bufferMin: settings.statusBufferMin || config.STATUS_BUFFER_MIN,
            bufferMax: settings.statusBufferMax || config.STATUS_BUFFER_MAX
        };
    },

    /* 
     * Save status settings to DB
     */
    updateSettings: (updates) => {
        const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};
        const newSettings = { ...settings, ...updates };
        fs.writeJsonSync(SETTINGS_DB, newSettings);
        return newSettings;
    },

    /* 
     * Get count of pending statuses
     */
    getPendingCount: () => {
        const store = fs.readJsonSync(STATUS_DB, { throws: false }) || [];
        return store.length;
    },

    /* 
     * Save incoming status metadata to database
     * @param {object} msg - The status message object
     */
    saveStatus: async (msg, sock) => {
        try {
            const sender = msg.key.participant || msg.key.remoteJid;
            const pushName = msg.pushName || "Unknown";
            const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};

            // --- 1. VIP HANDLING (Auto-View Immediately) ---
            const vipList = settings.statusVipList || [];
            if (vipList.includes(sender)) {
                // View Immediately
                await utils.delay(Math.random() * 2000 + 1000); // 1-3s random buffer
                await sock.readMessages([msg.key]);

                // Like Immediately
                await utils.delay(1000);
                await sock.sendMessage(msg.key.remoteJid, {
                    react: { text: "💚", key: msg.key }
                }, { statusJidList: [sender] });

                utils.log("STATUS", `VIP Status processed from ${pushName}`);
                return; // Don't save to bulk store
            }

            // --- 2. BULK STORE (Standard Schedule) ---
            const store = fs.readJsonSync(STATUS_DB, { throws: false }) || [];

            // Avoid duplicates
            if (store.some(s => s.key.id === msg.key.id)) return;

            store.push({
                key: msg.key,
                sender: sender,
                pushName: pushName,
                timestamp: Date.now()
            });

            fs.writeJsonSync(STATUS_DB, store);
        } catch (e) {
            utils.log("ERROR", `Failed to save status: ${e.message}`);
        }
    },

    /* 
     * Process stored statuses (View 75%, Like 40% of viewed)
     * @param {object} sock - Baileys socket
     */
    processStatuses: async (sock) => {
        utils.log("STATUS", "Initiating batch status processing...");

        // Notify owner (Saved Messages)
        try {
            const selfJid = utils.decodeJid(sock.user.id);
            await sock.sendMessage(selfJid, { text: "🔄 *Status Scheduler:* Starting batch processing cycle..." });
        } catch (e) {
            utils.log("WARN", "Failed to send scheduler start notification.");
        }

        let store = fs.readJsonSync(STATUS_DB, { throws: false }) || [];
        if (store.length === 0) {
            utils.log("STATUS", "No pending statuses to process.");
            return 0; // Return count for feedback
        }

        const settings = status.getSettings();

        // Shuffle
        store = store.sort(() => Math.random() - 0.5);

        // Select 75% for viewing (3/4)
        const viewCount = Math.ceil(store.length * 0.75);
        const toView = store.slice(0, viewCount);

        // Select 50% of viewed for liking (2/5)
        const likeCount = Math.ceil(toView.length * 0.5);
        const toLike = toView.slice(0, likeCount);

        utils.log("STATUS", `Stats: Found ${store.length} total. Viewing ${viewCount}, Liking ${likeCount}.`);

        // Process viewed items
        for (const item of toView) {
            try {
                // 1. View Status
                await sock.readMessages([item.key]);

                // 2. Like Status (if selected)
                if (toLike.some(l => l.key.id === item.key.id)) {
                    await utils.delay(2000); // Small gap before reaction
                    await sock.sendMessage(item.key.remoteJid, {
                        react: { text: "💚", key: item.key }
                    }, { statusJidList: [item.sender] });
                    utils.log("STATUS", `Liked status from ${item.pushName}`);
                } else {
                    utils.log("STATUS", `Viewed status from ${item.pushName}`);
                }

                // Randomized Buffer Delay
                const delay = Math.floor(Math.random() * (settings.bufferMax - settings.bufferMin + 1)) + settings.bufferMin;
                await utils.delay(delay);

            } catch (err) {
                if (err.message.includes('Connection Closed') || err.message.includes('Connection Terminated')) {
                    utils.log("WARN", `Status processing aborted: Connection Lost.`);
                    break; // Stop processing to avoid spam
                }
                utils.log("ERROR", `Failed to process status from ${item.pushName}: ${err.message}`);
            }
        }

        // Cleanup
        fs.writeJsonSync(STATUS_DB, []);
        utils.log("STATUS", "Batch processing complete. Database cleared.");
        return viewCount;
    },

    /* 
     * Get VIP Status List
     */
    getVipList: () => {
        const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};
        return settings.statusVipList || [];
    },

    /* 
     * Manage VIP List
     */
    updateVipList: (action, jid) => {
        const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};
        const vipList = settings.statusVipList || [];

        if (action === 'add' && !vipList.includes(jid)) {
            vipList.push(jid);
            fs.writeJsonSync(SETTINGS_DB, { ...settings, statusVipList: vipList });
            return true;
        } else if (action === 'del' && vipList.includes(jid)) {
            const newList = vipList.filter(id => id !== jid);
            fs.writeJsonSync(SETTINGS_DB, { ...settings, statusVipList: newList });
            return true;
        }
        return false;
    },

    /* 
     * Notification Toggle
     */
    setNotify: (enabled) => {
        const settings = fs.readJsonSync(SETTINGS_DB, { throws: false }) || {};
        fs.writeJsonSync(SETTINGS_DB, { ...settings, statusNotify: enabled });
        return enabled;
    },

    /* 
     * Process a specific user's statuses immediately (Manual View)
     */
    processSpecificUser: async (sock, targetJid) => {
        const store = fs.readJsonSync(STATUS_DB, { throws: false }) || [];
        if (store.length === 0) return 0;

        // Filter statuses for this user (flexible matching for LID/PN)
        const targetStatuses = store.filter(s => {
            const sId = s.sender.split('@')[0];
            const tId = targetJid.split('@')[0];
            return s.sender === targetJid || s.key?.remoteJidAlt === targetJid || sId === tId;
        });

        let count = 0;
        for (const statusItem of targetStatuses) {
            try {
                // View
                await sock.readMessages([statusItem.key]);

                // Like (Always like for manual view)
                await utils.delay(1000);
                await sock.sendMessage(statusItem.key.remoteJid, {
                    react: { text: "💚", key: statusItem.key }
                }, { statusJidList: [statusItem.sender] });

                count++;
                utils.log("STATUS", `Manually viewed status from ${statusItem.pushName}`);
            } catch (e) {
                utils.log("ERROR", `Manual view failed: ${e.message}`);
            }
        }
        return count;
    },

    /* 
     * Initialize the scheduler
     * @param {object} sock - Baileys socket
     */
    initScheduler: (sock) => {
        utils.log("SYSTEM", "Status Scheduler Initialized.");
        let lastTriggerHour = -1;

        setInterval(async () => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const settings = status.getSettings();
            const schedule = Array.isArray(settings.schedule) ? settings.schedule : [];

            // Trigger on the first minute of the target hours
            if (schedule.includes(hour) && hour !== lastTriggerHour && minute === 0) {
                lastTriggerHour = hour;
                await status.processStatuses(sock);
            }
        }, 60000); // Check every minute
    }
};

export default status;
