/*
 * Search Session Store
 * Keeps track of the last search results for each user to enable
 * "reply with number" functionality.
 */
const sessions = {};

/*
 * Save a search result session
 * @param { string } userJid - The user's ID
 * @param { Array } results - Array of video objects { url, title, duration, author }
 * @param { string } provider - 'youtube' or 'tiktok'
 */

const saveSession = (userJid, results, provider = 'youtube') => {
    sessions[userJid] = {
        results: results,
        provider: provider,
        timestamp: Date.now()
    };
};

/*
 * Get a search result by index
 * @param {string} userJid
 * @param {number} index - 1-based index (e.g. 1 for first result)
 * @returns {Object|null} - The video object or null if expired/not found
 */
const getSelection = (userJid, index) => {
    const session = sessions[userJid];
    if (!session) return null;

    // Expire after 5 minutes
    if (Date.now() - session.timestamp > 300000) {
        delete sessions[userJid];
        return null;
    }

    const arrayIndex = index - 1;
    if (arrayIndex >= 0 && arrayIndex < session.results.length) {
        return {
            data: session.results[arrayIndex],
            provider: session.provider || 'youtube'
        };
    }
    return null;
};

module.exports = {
    saveSession,
    getSelection
};
