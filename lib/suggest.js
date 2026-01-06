/**
 * Command Suggestion Utility
 * Uses Levenshtein distance for fuzzy matching
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Get all available commands from menu
 */
function getAllCommands() {
    return [
        // Guardian Protocols
        'ping', 'p', 'reveal', 'huntbuffer',

        // AI Core - Human Personas
        'ai', 'ask', 'yuki', 'fizz', 'jax', 'ren', 'bella',

        // AI Core - Classic Personas
        'tech', 'uwu', 'mom', 'pirate',

        // AI Settings
        'aitoggle',

        // Media Forge
        'sticker', 's', 'toimg', 'tovideo', 'ssteal', 'doge', 'cat',
        'meme', 'wasted', 'tourl',

        // Audio Lab
        'play', 'yts', 'tovn', 'fast', 'slow',

        // Contact Bridge
        'vcard', 'botvcard', 'sv', 'contacts',

        // Status Analytics
        'statusinfo', 'statstats', 'statvip', 'statusnotify', 'vs', 'alpha',

        // Diagnostics
        'runtime', 'sys', 'request', 'del', 'block', 'unblock', 'menu',

        // Control Center (Owner)
        'public', 'private', 'sleep', 'setbio', 'autobio', 'vvmode',
        'addreact', 'delreact', 'listreact', 'setsched', 'setbuffer',

        // Info Zone (Phase 4)
        'lyrics', 'wiki', 'wikipedia', 'weather',

        // Fun Zone (Phase 4)
        'ship', 'match', 'couple', 'gaycheck', 'gay', 'truth', 'dare', '8ball',

        // Game Zone (Phase 4)
        'ttt', 'tictactoe', 'move',

        // Group Admin Suite
        'kick', 'add', 'promote', 'demote', 'warn', 'unwarn', 'warnings',
        'group', 'setname', 'link', 'admins', 'tagall', 'hidetag',
        'antilink', 'welcome', 'goodbye', 'tempmod',

        // Navigation
        'help', 'start'
    ];
}

/**
 * Suggest command based on typo
 * @param {string} invalidCmd - The invalid command entered
 * @returns {string|null} - Suggested command or null
 */
function suggestCommand(invalidCmd) {
    const commands = getAllCommands();
    const threshold = 3; // Maximum distance to suggest

    let bestMatch = null;
    let bestDistance = Infinity;

    for (const cmd of commands) {
        const distance = levenshtein(invalidCmd.toLowerCase(), cmd.toLowerCase());

        if (distance < bestDistance && distance <= threshold) {
            bestDistance = distance;
            bestMatch = cmd;
        }
    }

    return bestMatch;
}

module.exports = { suggestCommand };
