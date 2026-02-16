const utils = require('../core/utils');

/**
 * Connect 4 Game Logic
 */

const EMPTY = 0;
const P1 = 1; // Red
const P2 = 2; // Yellow
const ROWS = 6;
const COLS = 7;

module.exports = {
    /**
     * Initialize a new game state
     */
    createGame: (p1, p2, bet) => {
        return {
            type: 'connect4',
            players: [p1, p2],
            turn: p1,
            board: Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY)),
            bet: bet || 0,
            lastMove: null // { row, col }
        };
    },

    /**
     * Drop a piece into a column
     * @param {Object} game Game object
     * @param {string} player JID of player moving
     * @param {number} col Column 1-7 (user input)
     * @returns {Object} { valid: boolean, win: boolean, draw: boolean, reason: string }
     */
    dropPiece: (game, player, col) => {
        // 1. Validate Turn
        if (game.turn !== player) {
            return { valid: false, reason: "It's not your turn!" };
        }

        // 2. Validate Column
        const c = parseInt(col) - 1;
        if (isNaN(c) || c < 0 || c >= COLS) {
            return { valid: false, reason: "Invalid column! Choose 1-7." };
        }

        // 3. Find empty slot
        let r = -1;
        for (let i = ROWS - 1; i >= 0; i--) {
            if (game.board[i][c] === EMPTY) {
                r = i;
                break;
            }
        }

        if (r === -1) {
            return { valid: false, reason: "Column is full!" };
        }

        // 4. Apply Move
        const playerVal = game.players.indexOf(player) + 1; // 1 or 2
        game.board[r][c] = playerVal;
        game.lastMove = { row: r, col: c };

        // 5. Check Win
        if (checkWin(game.board, r, c, playerVal)) {
            return { valid: true, win: true };
        }

        // 6. Check Draw (Board Full)
        if (game.board.every(row => row.every(cell => cell !== EMPTY))) {
            return { valid: true, draw: true };
        }

        // 7. Switch Turn
        game.turn = game.players[1 - (playerVal - 1)];
        return { valid: true };
    },

    /**
     * Render the board to string
     */
    renderBoard: (game) => {
        const symbols = {
            [EMPTY]: '⚪',
            [P1]: '🔴',
            [P2]: '🟡'
        };

        let str = "\n1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣\n";
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                str += symbols[game.board[r][c]] + " ";
            }
            str += "\n";
        }
        return str;
    }
};

/**
 * Check for 4 in a row
 */
function checkWin(board, r, c, player) {
    // Directions: Horizontal, Vertical, Diagonal /, Diagonal \
    const directions = [
        [0, 1],  // Horizontal
        [1, 0],  // Vertical
        [1, 1],  // Diag \
        [1, -1]  // Diag /
    ];

    for (let [dr, dc] of directions) {
        let count = 1;

        // Check forward
        for (let i = 1; i < 4; i++) {
            const nr = r + (dr * i);
            const nc = c + (dc * i);
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
            count++;
        }

        // Check backward
        for (let i = 1; i < 4; i++) {
            const nr = r - (dr * i);
            const nc = c - (dc * i);
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
            count++;
        }

        if (count >= 4) return true;
    }
    return false;
}
