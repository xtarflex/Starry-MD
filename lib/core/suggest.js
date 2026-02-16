/* 
 * Command Suggestion Utility
 * Uses Levenshtein distance for fuzzy matching
 */

/* 
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

/* 
 * Get all available commands from menu
 */
function getAllCommands() {
    return [
        // Guardian Protocols
        'ping', 'p', 'reveal', 'huntbuffer',

        // AI Core - Human Personas
        'ai', 'ask', 'yuki', 'fizz', 'jax', 'ren', 'bella', 'vision',

        // AI Core - Classic Personas
        'tech', 'uwu', 'mom', 'pirate',

        // AI Settings
        'aitoggle',

        // Media Forge
        'sticker', 's', 'toimg', 'tovideo', 'ssteal', 'doge', 'cat',
        'meme', 'wasted', 'tourl', 'testalbum',

        // Upload Center
        'upload', 'get', 'list', 'delete', 'mkdir', 'url',

        // Audio Lab
        'play', 'video', 'yts', 'tovn', 'fast', 'slow', 'ytv',

        // Social Lab
        'tiktok', 'tt', 'insta', 'ig',

        // Contact Bridge
        'vcard', 'botvcard', 'sv', 'contacts', 'tempmail',

        // Status Analytics
        'statusinfo', 'statstats', 'statvip', 'statusnotify', 'vs', 'alpha',

        // Diagnostics
        'runtime', 'sys', 'request', 'del', 'block', 'unblock', 'menu',
        'killclean', 'resetmobile', 'jid', 'id', 'ginfo',

        // Control Center (Owner)
        'public', 'private', 'sleep', 'setbio', 'autobio', 'vvmode',
        'addreact', 'delreact', 'listreact', 'setsched', 'setbuffer',

        // Info Zone (Phase 4 & 6)
        'lyrics', 'wiki', 'wikipedia', 'weather', 'pint', 'pinterest', 'define', 'google', 'shorten',

        // Fun Zone (Phase 4)
        'ship', 'match', 'couple', 'gaycheck', 'gay', 'truth', 'dare', '8ball', 'poll', 'debate',

        // Game Zone (Phase 4)
        'ttt', 'tictactoe', 'move',

        // Group Admin Suite
        'kick', 'add', 'promote', 'demote', 'warn', 'unwarn', 'warnings',
        'group', 'setname', 'link', 'admins', 'tagall', 'hidetag', 'bcast',
        'antilink', 'welcome', 'goodbye', 'tempmod', 'spam',

        // Economy System
        'balance', 'daily', 'work', 'deposit', 'withdraw',
        'shop', 'inventory', 'buy', 'sell', 'heal', 'rob', 'gift', 'pay',
        'tasks', 'claim', 'loan', 'drone',
        'crypto', 'buycrypto', 'sellcrypto', 'stock', 'buystock', 'sellstock',
        'forex', 'buyforex', 'sellforex', // Added Forex
        'convert', 'investors', 'rich', 'census', 'leaders', 'advisor',

        // System
        'public', 'private', 'sleep', 'goon',

        // Navigation
        'help', 'start'
    ];
}

/* 
 * Suggest command based on typo
 * @param {string} invalidCmd - The invalid command entered
 * @param {Map} commandsMap - The map of loaded commands
 * @returns {string|null} - Suggested command or null
 */
function suggestCommand(invalidCmd, commandsMap) {
    if (!commandsMap || !(commandsMap instanceof Map)) return null;

    const commandNames = Array.from(commandsMap.keys());
    const bestMatch = { cmd: null, distance: Infinity };

    for (const cmdName of commandNames) {
        const distance = levenshtein(invalidCmd.toLowerCase(), cmdName.toLowerCase());

        // Variable tolerance based on command length
        let dynamicThreshold = 2;
        if (cmdName.length <= 3) dynamicThreshold = 1;
        if (cmdName.length > 6) dynamicThreshold = 3;

        if (distance < bestMatch.distance && distance <= dynamicThreshold) {
            bestMatch.distance = distance;
            bestMatch.cmd = cmdName;
        }
    }

    return bestMatch.cmd;
}

module.exports = { suggestCommand };

