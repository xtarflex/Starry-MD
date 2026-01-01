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
        'ping', 'p',

        // Arsenal
        'sticker', 's', 'imagine', 'draw', 'ai', 'ask', 'rude', 'pirate', 'mom',
        'vv', 'viewonce', 'hunt', 'save', 'sv',

        // Contact Bridge
        'vcard', 'botvcard', 'contacts',

        // Status & Analytics
        'statinfo', 'alpha', 'statstats',

        // Diagnostics
        'runtime', 'uptime', 'sys', 'db', 'database', 'pullreq', 'logs',
        'clearlog', 'request', 'del', 'block', 'unblock', 'report',

        // Control Center
        'public', 'private', 'sleep', 'setbio', 'autobio', 'vvmode',
        'addreact', 'delreact', 'listreact', 'setsched', 'setbuffer',

        // Group Commands
        'tagall', 'kick', 'warn', 'promote', 'demote', 'add', 'mute',
        'unmute', 'antilink', 'mem', 'memghost',

        // Navigation
        'menu', 'help', 'start'
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
