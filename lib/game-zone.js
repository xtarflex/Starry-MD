const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
// keeping utils in case you expand features later
const utils = require('./utils');

// In-Memory Game Store
// Note: This resets if the bot restarts. 
const games = {};

/**
 * Game Zone - Win big or go home!
 */
module.exports = {
    /**
     * Tic-Tac-Toe Manager
     * Usage: .ttt @user | .ttt stop
     */
    handleTicTacToe: async (msg, sock, botState, args = []) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

        // --- 1. Handle Existing Game ---
        if (games[from]) {
            const game = games[from];
            const cmd = args[0] ? args[0].toLowerCase() : '';

            // Force End Command
            if (cmd === 'end' || cmd === 'stop') {
                delete games[from];
                return sock.sendMessage(from, { text: "🛑 Game stopped manually." }, { quoted: msg });
            }

            // Info Command (if game exists)
            return sock.sendMessage(from, {
                text: `⚠️ *Game in Progress!* ⚠️\n\nPlayers: @${game.players[0].split('@')[0]} vs @${game.players[1].split('@')[0]}\n\nType *.move [1-9]* to play.\nType *.ttt stop* to cancel.`,
                mentions: game.players
            }, { quoted: msg });
        }

        // --- 2. Start New Game ---
        if (mentions.length === 0) {
            return sock.sendMessage(from, { text: "❌ Challenge someone! Usage: *.ttt @user*" }, { quoted: msg });
        }

        const opponent = mentions[0];
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // Validation
        if (opponent === sender) {
            return sock.sendMessage(from, { text: "❌ You cannot play against yourself!" }, { quoted: msg });
        }
        if (opponent === botJid) {
            return sock.sendMessage(from, { text: "🤖 I'm too smart for you. Challenge a human!" }, { quoted: msg });
        }

        // Initialize State
        games[from] = {
            room: from,
            type: 'tictactoe',
            players: [sender, opponent], // 0: Challenger, 1: Opponent
            turn: sender, // Challenger starts (X)
            board: [0, 0, 0, 0, 0, 0, 0, 0, 0], // 0: null, 1: X, 2: O
            symbols: ['❌', '⭕'],
            ts: Date.now()
        };

        const boardStr = renderBoard(games[from].board);

        await sock.sendMessage(from, {
            text: `🎮 *TIC-TAC-TOE STARTED*\n\n❌ @${sender.split('@')[0]}\n⭕ @${opponent.split('@')[0]}\n\n${boardStr}\n\n*Turn:* @${sender.split('@')[0]} (X)\nType *.move [1-9]* to play!`,
            mentions: [sender, opponent]
        }, { quoted: msg });
    },

    /**
     * Handle Move (.move [1-9])
     */
    handleMove: async (msg, sock, botState, position) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        // Check if a TTT game exists in this chat
        if (!games[from] || games[from].type !== 'tictactoe') {
            return sock.sendMessage(from, { text: "❌ No game in progress here. Start one with *.ttt @user*" }, { quoted: msg });
        }

        const game = games[from];

        // 1. Validation: Is user a player?
        if (!game.players.includes(sender)) {
            return sock.sendMessage(from, { text: "👀 You are not in this game! Watch from the sidelines." }, { quoted: msg });
        }

        // 2. Validation: Is it their turn?
        if (game.turn !== sender) {
            return sock.sendMessage(from, { text: "⏳ It's not your turn! Wait for your opponent." }, { quoted: msg });
        }

        // 3. Validation: Parse position
        const posIndex = parseInt(position) - 1;
        if (isNaN(posIndex) || posIndex < 0 || posIndex > 8) {
            return sock.sendMessage(from, { text: "❌ Invalid position! Send a number *1-9*." }, { quoted: msg });
        }

        if (game.board[posIndex] !== 0) {
            return sock.sendMessage(from, { text: "❌ That spot is taken!" }, { quoted: msg });
        }

        // --- Apply Move ---
        const playerSymbolIndex = game.players.indexOf(sender); // 0 or 1
        game.board[posIndex] = playerSymbolIndex + 1; // Store as 1 or 2

        // --- Check Win ---
        const winner = checkWin(game.board);
        if (winner) {
            const boardStr = renderBoard(game.board);
            const loser = game.players[1 - playerSymbolIndex];

            // Clean up memory
            delete games[from];

            return sock.sendMessage(from, {
                text: `🏆 *GAME OVER!* 🏆\n\n${boardStr}\n\n🎉 *WINNER:* @${sender.split('@')[0]}\n💀 *LOSER:* @${loser.split('@')[0]}`,
                mentions: game.players
            }, { quoted: msg });
        }

        // --- Check Draw ---
        if (!game.board.includes(0)) {
            const boardStr = renderBoard(game.board);
            delete games[from];

            return sock.sendMessage(from, {
                text: `🤝 *IT'S A DRAW!* 🤝\n\n${boardStr}\n\nNo winner this time.`,
            }, { quoted: msg });
        }

        // --- Switch Turn ---
        game.turn = game.players[1 - playerSymbolIndex]; // Toggle between 0 and 1
        const nextSymbol = game.symbols[1 - playerSymbolIndex];

        const nextBoard = renderBoard(game.board);
        await sock.sendMessage(from, {
            text: `🎮 *TIC-TAC-TOE*\n\n${nextBoard}\n\n*Turn:* @${game.turn.split('@')[0]} ( ${nextSymbol} )`,
            mentions: [game.turn]
        }, { quoted: msg });
    }
};

/**
 * --- Internal Helpers ---
 */

function renderBoard(board) {
    // block numbers 1-9 for empty spots
    const map = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    const emojis = ['⬜', '❌', '⭕']; // 0 is unused in lookup, handled below

    let str = "";
    for (let i = 0; i < 9; i++) {
        const val = board[i];

        // If 0 (empty), show number. If 1/2, show X/O emoji
        if (val === 0) str += map[i];
        else str += emojis[val];

        // Formatting: New line every 3 cols
        if ((i + 1) % 3 === 0) str += "\n";
        else str += "  "; // Double space for visual separation
    }
    return str;
}

function checkWin(board) {
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (let combo of wins) {
        if (board[combo[0]] !== 0 &&
            board[combo[0]] === board[combo[1]] &&
            board[combo[0]] === board[combo[2]]) {
            return true;
        }
    }
    return false;
}
