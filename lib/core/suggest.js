/* 
 * Command Suggestion Utility
 * Uses Levenshtein distance for fuzzy matching
 */

import config from '../../config.js';

// Predefined command list (Cache)
let commandList = [];

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

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
 * Initialize suggestion engine with available commands
 * @param {Array} commands - List of command objects
 */
export function initSuggestions(commands) {
    if (Array.isArray(commands)) {
        commandList = commands;
    } else if (commands instanceof Map) {
        commandList = Array.from(commands.keys());
    } else {
        commandList = Object.keys(commands || {});
    }
}

/**
 * Suggest a command based on user input (Typo Fixer)
 * @param {string} input - User input (e.g., "stikcer")
 * @returns {string|null} - Suggested command or null
 */
export function suggestCommand(input) {
    if (!input || input.length < 2) return null;
    if (commandList.length === 0) return null;

    let bestMatch = null;
    let minDistance = 3; // Tolerance

    for (const cmd of commandList) {
        const distance = levenshtein(input, cmd);

        // Dynamic tolerance based on length
        const tolerance = cmd.length < 5 ? 1 : 2;

        if (distance <= tolerance && distance < minDistance) {
            minDistance = distance;
            bestMatch = cmd;
        }
    }

    return bestMatch;
}

export default {
    initSuggestions,
    suggestCommand
};
