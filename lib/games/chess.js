/**
 * Chess Game Logic (Simplified)
 * Supported: Standard Moves, Captures, Promotion (Queen only)
 * Missing: Castling, En Passant, Check/Checkmate detection (Manual end required)
 */

const WHITE = 'w';
const BLACK = 'b';

// Initial Board Setup
const INITIAL_BOARD = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'], // 8 (Black)
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'], // 7
    [null, null, null, null, null, null, null, null], // 6
    [null, null, null, null, null, null, null, null], // 5
    [null, null, null, null, null, null, null, null], // 4
    [null, null, null, null, null, null, null, null], // 3
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], // 2 (White)
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']  // 1
];

module.exports = {
    createGame: (p1, p2, bet) => {
        return {
            type: 'chess',
            players: [p1, p2], // p1 = White, p2 = Black
            turn: p1,
            colorTurn: WHITE,
            board: JSON.parse(JSON.stringify(INITIAL_BOARD)), // Deep copy
            bet: bet || 0,
            checked: false
        };
    },

    /**
     * Parse move string from algebraic notation (e.g. "e2e4")
     */
    parseMove: (moveStr) => {
        if (!moveStr || moveStr.length < 4) return null;
        const map = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };

        const c1 = map[moveStr[0].toLowerCase()];
        const r1 = 8 - parseInt(moveStr[1]);
        const c2 = map[moveStr[2].toLowerCase()];
        const r2 = 8 - parseInt(moveStr[3]);

        if ([r1, c1, r2, c2].some(x => isNaN(x) || x < 0 || x > 7)) return null;

        return { from: { r: r1, c: c1 }, to: { r: r2, c: c2 } };
    },

    /**
     * Execute a move
     */
    move: (game, player, moveStr) => {
        // 1. Turn Validation
        if (game.turn !== player) return { valid: false, reason: "Not your turn!" };

        const move = module.exports.parseMove(moveStr);
        if (!move) return { valid: false, reason: "Invalid format! Use long algebraic (e.g., e2e4)." };

        const { from, to } = move;
        const piece = game.board[from.r][from.c];
        const target = game.board[to.r][to.c];

        // 2. Piece Validation
        if (!piece) return { valid: false, reason: "No piece at that square." };

        const pieceColor = piece === piece.toUpperCase() ? WHITE : BLACK;
        if (pieceColor !== game.colorTurn) return { valid: false, reason: "That's not your piece!" };

        // 3. Move Logic Validation (Simplified)
        if (!isValidMove(game.board, from, to, piece)) {
            return { valid: false, reason: "Illegal move for that piece." };
        }

        // 4. Execute Move
        game.board[to.r][to.c] = piece;
        game.board[from.r][from.c] = null;

        // Auto-Promote Pawn to Queen
        if (piece.toLowerCase() === 'p') {
            if ((pieceColor === WHITE && to.r === 0) || (pieceColor === BLACK && to.r === 7)) {
                game.board[to.r][to.c] = pieceColor === WHITE ? 'Q' : 'q';
            }
        }

        // 5. Switch Turn
        game.turn = game.players[1 - game.players.indexOf(player)];
        game.colorTurn = game.colorTurn === WHITE ? BLACK : WHITE;

        return { valid: true };
    },

    renderBoard: (game) => {
        const symbols = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙', // White
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟', // Black
            'null': '◻️'
        };

        // Add spacing for better visibility on WhatsApp
        // Using Ideographic Space (U+3000) for alignment or just simple spaces
        // WhatsApp font is variable, but simple spaces usually work best with emojis
        let str = "    Ａ Ｂ Ｃ Ｄ Ｅ Ｆ Ｇ Ｈ\n";
        for (let r = 0; r < 8; r++) {
            str += `${8 - r}  `; // Row Number
            for (let c = 0; c < 8; c++) {
                const cell = game.board[r][c];
                str += (cell ? symbols[cell] : ((r + c) % 2 === 0 ? '◻️' : '◼️')) + " ";
            }
            str += ` ${8 - r}\n`;
        }
        str += "    Ａ Ｂ Ｃ Ｄ Ｅ Ｆ Ｇ Ｈ";
        return str;
    }
};

// --- Internal Helper: Move Rules ---
function isValidMove(board, from, to, piece) {
    const dr = to.r - from.r;
    const dc = to.c - from.c;
    const type = piece.toLowerCase();
    const target = board[to.r][to.c];

    // Friendly Fire Check
    if (target) {
        const isWhite = piece === piece.toUpperCase();
        const isTargetWhite = target === target.toUpperCase();
        if (isWhite === isTargetWhite) return false;
    }

    // Pawn
    if (type === 'p') {
        const dir = piece === 'P' ? -1 : 1; // White moves up (-row), Black moves down (+row)

        // Move Forward 1
        if (dc === 0 && dr === dir && !target) return true;

        // Move Forward 2 (Start)
        const startRow = piece === 'P' ? 6 : 1;
        if (dc === 0 && dr === 2 * dir && from.r === startRow && !target && !board[from.r + dir][from.c]) return true;

        // Capture Diagonal
        if (Math.abs(dc) === 1 && dr === dir && target) return true;

        return false;
    }

    // Rook (Straight)
    if (type === 'r') {
        if (dr !== 0 && dc !== 0) return false;
        return isPathClear(board, from, to);
    }

    // Bishop (Diagonal)
    if (type === 'b') {
        if (Math.abs(dr) !== Math.abs(dc)) return false;
        return isPathClear(board, from, to);
    }

    // Queen (Straight or Diagonal)
    if (type === 'q') {
        if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
        return isPathClear(board, from, to);
    }

    // Knight (L-Shape)
    if (type === 'n') {
        return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    }

    // King (1 step)
    if (type === 'k') {
        return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    }

    return false;
}

function isPathClear(board, from, to) {
    const dr = Math.sign(to.r - from.r);
    const dc = Math.sign(to.c - from.c);

    let r = from.r + dr;
    let c = from.c + dc;

    while (r !== to.r || c !== to.c) {
        if (board[r][c]) return false;
        r += dr;
        c += dc;
    }
    return true;
}
