const axios = require('axios');
const utils = require('../core/utils');

/**
 * Lyrics Module
 * Fetches lyrics from LRCLIB API
 */
module.exports = {
    /**
     * Get lyrics for a song
     * @param {string} query - Song title and artist
     * @returns {Promise<string|null>} Lyrics text or null if not found
     */
    getLyrics: async (query) => {
        if (!query) return null;

        const makeRequest = async (retries = 3) => {
            try {
                const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
                // User-Agent is polite to include
                return await axios.get(url, {
                    headers: { 'User-Agent': 'StarryBot/2.0' },
                    timeout: 10000
                });
            } catch (err) {
                if (retries > 0 && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT')) {
                    utils.log("WARN", `Lyrics Fetch Warning: ${err.message}. Retrying... (${retries} left)`);
                    await new Promise(res => setTimeout(res, 1000)); // Wait 1s
                    return makeRequest(retries - 1);
                }
                throw err;
            }
        };

        try {
            const response = await makeRequest();
            const results = response.data;
            if (results && results.length > 0) {
                // Return the first result's plain lyrics
                // Fallback to synced lyrics if plain is missing (rare but possible)
                return results[0].plainLyrics || results[0].syncedLyrics || null;
            }
            return null;
        } catch (err) {
            utils.log("ERROR", `Lyrics Fetch Failed: ${err.message}`);
            return null;
        }
    }
};
