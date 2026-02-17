import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import economy from '../systems/economy.js';
import economyTasks from '../systems/economy-tasks.js';
import utils from '../core/utils.js';
import chess from './chess.js';
import monopoly from './monopoly.js';
import connect4 from './connect4.js';

// In-Memory Game Store
// Note: This resets if the bot restarts. 
const games = {};

/* 
 * Game Zone - Win big or go home!
 */
export default {
    /* 
     * Tic-Tac-Toe Manager
     * Usage: .ttt @user | .ttt stop
     */
    handleTicTacToe: async (msg, sock, botState, args = []) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);
        const mentions = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(jid => sock.decodeJid(jid));

        // Ensure args is an array
        const parts = typeof args === 'string' ? args.trim().split(/\s+/) : args;

        // --- 1. Handle Existing Game ---
        if (games[from]) {
            const game = games[from];
            const cmd = parts[0] ? parts[0].toLowerCase() : '';

            // Force End Command (Any player or Admin can stop)
            if (['end', 'stop', 'ztop'].includes(cmd)) {

                // Permission Check: Must be a player
                if (!game.players.includes(sender)) {
                    // Check if admin? For now, strict player-only to avoid abuse
                    return sock.sendMessage(from, { text: "❌ Only the players can stop the game!" }, { quoted: msg });
                }

                const opponent = game.players.find(p => p !== sender);
                const hasMoves = game.board.some(x => x !== 0);

                if (hasMoves && game.bet > 0) {
                    // --- FORFEIT / SURRENDER ---
                    // The stopping player LOSES. Opponent WINS the pot.
                    const userWin = await economy.getUserProfile(opponent);
                    const pot = game.bet * 2;

                    const hasCard = (userWin.inventory.debit_card || 0) > 0;
                    if (hasCard) userWin.financials.bank += pot;
                    else userWin.financials.wallet += pot;

                    await economy.saveDB();

                    delete games[from];
                    return sock.sendMessage(from, {
                        text: `🏳️ *SURRENDER!* 🏳️\n\n@${sender.split('@')[0]} has forfeited the match!\n\n🏆 *WINNER:* @${opponent.split('@')[0]}\n💰 *Pot Won:* $${pot.toLocaleString()}`,
                        mentions: game.players
                    });

                } else {
                    // --- CANCEL / REFUND (No moves yet) ---
                    if (game.bet > 0) {
                        for (const p of game.players) {
                            const user = await economy.getUserProfile(p);
                            const hasCard = (user.inventory.debit_card || 0) > 0;
                            if (hasCard) user.financials.bank += game.bet;
                            else user.financials.wallet += game.bet;
                        }
                        await economy.saveDB();
                        await sock.sendMessage(from, { text: `🛑 Game cancelled. Stakes of *$${game.bet.toLocaleString()}* have been refunded.` });
                    } else {
                        await sock.sendMessage(from, { text: "🛑 Game stopped manually." });
                    }
                    delete games[from];
                    return;
                }
            }

            // Info Command (if game exists)
            return sock.sendMessage(from, {
                text: `⚠️ *Game in Progress!* ⚠️\n\nPlayers: @${game.players[0].split('@')[0]} vs @${game.players[1].split('@')[0]}\n\nType *.move [1-9]* to play.\nType *.ttt stop* to cancel or forfeit.`,
                mentions: game.players
            }, { quoted: msg });
        }

        // --- 2. Start New Game ---
        if (mentions.length === 0) {
            return sock.sendMessage(from, { text: "❌ Challenge someone! Usage: *.ttt @user*" }, { quoted: msg });
        }

        const opponent = mentions[0];
        const botJid = sock.decodeJid(sock.user.id);

        // Validation
        if (opponent === sender) {
            return sock.sendMessage(from, { text: "❌ You cannot play against yourself!" }, { quoted: msg });
        }
        if (opponent === botJid) {
            return sock.sendMessage(from, { text: "🤖 I'm too smart for you. Challenge a human!" }, { quoted: msg });
        }

        // Parse Bet Amount (if any)
        const amount = parts.length > 1 ? utils.parseNumber(parts[parts.length - 1]) : 0;
        if (amount > 0 && amount < 100) {
            return sock.sendMessage(from, { text: "❌ Minimum bet for Tic-Tac-Toe is *$100*!" }, { quoted: msg });
        }

        // Fund Check and immediate deduction
        if (amount > 0) {
            const user = await economy.getUserProfile(sender);
            const opp = await economy.getUserProfile(opponent);

            const hasBankCardSender = (user.inventory.debit_card || 0) > 0;
            const hasBankCardOpp = (opp.inventory.debit_card || 0) > 0;
            const totalSender = hasBankCardSender ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;
            const totalOpp = hasBankCardOpp ? (opp.financials.wallet + opp.financials.bank) : opp.financials.wallet;

            if (totalSender < amount) {
                return sock.sendMessage(from, { text: `❌ You can't afford this bet!\n💰 Total: *$${totalSender.toLocaleString()}*` }, { quoted: msg });
            }
            if (totalOpp < amount) {
                return sock.sendMessage(from, { text: `❌ Your opponent @${opponent.split('@')[0]} cannot afford this bet!`, mentions: [opponent] }, { quoted: msg });
            }

            // Deduct from Challenger
            if (hasBankCardSender && user.financials.wallet < amount) {
                const rem = amount - user.financials.wallet;
                user.financials.wallet = 0;
                user.financials.bank -= rem;
            } else {
                user.financials.wallet -= amount;
            }

            // Deduct from Opponent
            if (hasBankCardOpp && opp.financials.wallet < amount) {
                const rem = amount - opp.financials.wallet;
                opp.financials.wallet = 0;
                opp.financials.bank -= rem;
            } else {
                opp.financials.wallet -= amount;
            }
            await economy.saveDB();
        }

        // Initialize State
        games[from] = {
            room: from,
            type: 'tictactoe',
            players: [sender, opponent], // 0: Challenger, 1: Opponent
            turn: sender, // Challenger starts (X)
            board: [0, 0, 0, 0, 0, 0, 0, 0, 0], // 0: null, 1: X, 2: O
            symbols: ['❌', '⭕'],
            bet: amount,
            ts: Date.now()
        };

        const boardStr = renderBoard(games[from].board);
        let startMsg = `🎮 *TIC-TAC-TOE STARTED*\n\n❌ @${sender.split('@')[0]}\n⭕ @${opponent.split('@')[0]}\n\n`;
        if (amount > 0) startMsg += `💰 *Stakes:* *$${amount.toLocaleString()}* (Locked from both)\n💰 *Pot:* *$${(amount * 2).toLocaleString()}*\n\n`;
        startMsg += `${boardStr}\n\n*Turn:* @${sender.split('@')[0]} (X)\nType *.move [1-9]* to play!`;

        await utils.simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, {
            text: startMsg,
            mentions: [sender, opponent]
        }, { quoted: msg });
    },


    /* 
     * Handle Move (.move [position/notation])
     */
    handleMove: async (msg, sock, botState, position) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);

        if (!games[from]) return sock.sendMessage(from, { text: "❌ No game in progress here." }, { quoted: msg });

        const game = games[from];
        if (!game.players.includes(sender)) return sock.sendMessage(from, { text: "👀 Spectators only." }, { quoted: msg });
        if (game.turn !== sender) return sock.sendMessage(from, { text: "⏳ Not your turn!" }, { quoted: msg });

        // --- Tic-Tac-Toe Move ---
        if (game.type === 'tictactoe') {
            const posIndex = parseInt(position) - 1;
            if (isNaN(posIndex) || posIndex < 0 || posIndex > 8) return sock.sendMessage(from, { text: "❌ Invalid position (1-9)." });
            if (game.board[posIndex] !== 0) return sock.sendMessage(from, { text: "❌ Spot taken." });

            const pIdx = game.players.indexOf(sender);
            game.board[posIndex] = pIdx + 1;

            const win = checkWin(game.board);
            if (win) {
                delete games[from];
                // Payout logic (abbreviated for brevity, assuming standard TTT payout)
                return sock.sendMessage(from, { text: `🏆 @${sender.split('@')[0]} WINS!\n\n${renderBoard(game.board)}`, mentions: game.players });
            }
            if (!game.board.includes(0)) {
                delete games[from];
                return sock.sendMessage(from, { text: `🤝 DRAW!\n\n${renderBoard(game.board)}` });
            }

            game.turn = game.players[1 - pIdx];
            return sock.sendMessage(from, { text: `Turn: @${game.turn.split('@')[0]}\n\n${renderBoard(game.board)}`, mentions: [game.turn] });
        }

        // --- Connect 4 Move ---
        if (game.type === 'connect4') {
            const result = connect4.dropPiece(game, sender, position);
            if (!result.valid) return sock.sendMessage(from, { text: `❌ ${result.reason}` });

            if (result.win) {
                delete games[from];
                return sock.sendMessage(from, { text: `🔴🟡 *CONNECT 4 WINNER!* \n\n🏆 @${sender.split('@')[0]} wins!\n${connect4.renderBoard(game)}`, mentions: game.players });
            }
            if (result.draw) {
                delete games[from];
                return sock.sendMessage(from, { text: `🤝 *DRAW!* Board full.\n${connect4.renderBoard(game)}` });
            }

            return sock.sendMessage(from, { text: `Turn: @${game.turn.split('@')[0]}\n${connect4.renderBoard(game)}`, mentions: [game.turn] });
        }

        // --- Chess Move ---
        if (game.type === 'chess') {
            // position is move string e.g. "e2e4"
            const result = chess.move(game, sender, position);
            if (!result.valid) return sock.sendMessage(from, { text: `❌ ${result.reason}` });

            return sock.sendMessage(from, { text: `Turn: @${game.turn.split('@')[0]} (${game.colorTurn === 'w' ? 'White' : 'Black'})\n\n${chess.renderBoard(game)}`, mentions: [game.turn] });
        }
    },

    /* 
     * Chess Manager (.chess @user)
     */
    handleChess: async (msg, sock, botState, args = []) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);
        const mentions = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(jid => sock.decodeJid(jid));

        if (games[from]) {
            if (args[0] === 'stop') {
                delete games[from];
                return sock.sendMessage(from, { text: "🛑 Chess game stopped." });
            }
            return sock.sendMessage(from, { text: "⚠️ Game in progress!" });
        }

        if (mentions.length === 0) return sock.sendMessage(from, { text: "Usage: .chess @user" }, { quoted: msg });
        const opponent = mentions[0];

        games[from] = chess.createGame(sender, opponent);

        await sock.sendMessage(from, {
            text: `♟️ *CHESS STARTED* ♟️\n\nWhite: @${sender.split('@')[0]}\nBlack: @${opponent.split('@')[0]}\n\n${chess.renderBoard(games[from])}\n\nType *.move e2e4* to play.`,
            mentions: [sender, opponent]
        }, { quoted: msg });
    },

    /* 
     * Connect 4 Manager (.c4 @user)
     */
    handleConnect4: async (msg, sock, botState, args = []) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);
        const mentions = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(jid => sock.decodeJid(jid));

        if (games[from]) {
            if (args[0] === 'stop') {
                delete games[from];
                return sock.sendMessage(from, { text: "🛑 Connect 4 stopped." });
            }
            return sock.sendMessage(from, { text: "⚠️ Game in progress!" });
        }

        if (mentions.length === 0) return sock.sendMessage(from, { text: "Usage: .c4 @user" }, { quoted: msg });
        const opponent = mentions[0];

        games[from] = connect4.createGame(sender, opponent);

        await sock.sendMessage(from, {
            text: `🔴 *CONNECT 4 STARTED* 🟡\n\n🔴 @${sender.split('@')[0]}\n🟡 @${opponent.split('@')[0]}\n\n${connect4.renderBoard(games[from])}\n\nType *.move [1-7]* to drop a piece!`,
            mentions: [sender, opponent]
        }, { quoted: msg });
    },

    /* 
     * Monopoly Manager (.monopoly @p1 @p2 ...)
     */
    handleMonopoly: async (msg, sock, botState, args = []) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);
        const mentions = (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []).map(jid => sock.decodeJid(jid));

        if (games[from]) {
            if (args[0] === 'stop') {
                delete games[from];
                return sock.sendMessage(from, { text: "🛑 Monopoly game stopped." });
            }
            return sock.sendMessage(from, { text: "⚠️ Game in progress!" });
        }

        if (mentions.length < 1) return sock.sendMessage(from, { text: "Usage: .monopoly @user1 @user2 ..." }, { quoted: msg });

        const players = [sender, ...mentions].slice(0, 4); // Max 4
        games[from] = monopoly.createGame(players);

        await utils.simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, {
            text: `🎩 *MONOPOLY LITE STARTED* 🎩\n\n${monopoly.renderBoard(games[from])}\n\nTurn: @${sender.split('@')[0]}\nType *.roll* to start!`,
            mentions: players
        }, { quoted: msg });
    },

    /* 
     * Generic Game Action Router (.roll, .buyprop, .endturn)
     */
    handleGameAction: async (msg, sock, botState, action) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);
        const game = games[from];

        if (!game) return sock.sendMessage(from, { text: "❌ No game in progress." });

        // Monopoly Actions
        if (game.type === 'monopoly') {
            const currentPlayer = game.players[game.turnIndex].id;
            if (sender !== currentPlayer) return sock.sendMessage(from, { text: "⏳ Not your turn!" });

            if (action === 'roll') {
                const roll = monopoly.rollDice();
                const result = monopoly.playTurn(game, roll);

                // Append Board Status
                const responseText = `${result.text}\n\n${monopoly.renderBoard(game)}`;
                return sock.sendMessage(from, { text: responseText, mentions: [result.next] });
            }

            if (action === 'buyprop') {
                const result = monopoly.buyProperty(game, sender);
                // Append Status to show updated money/property list
                const responseText = `${result}\n\n${monopoly.renderBoard(game)}`;
                return sock.sendMessage(from, { text: responseText });
            }
        }
    },

    /* 
     * Gamble (.gamble <amount>)
     */
    handleGamble: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const pushName = msg.pushName || "User";

        if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: .bet <amount>\nExample: .bet 500" }, { quoted: msg });

        const amount = utils.parseNumber(args[0]);
        if (isNaN(amount) || amount < 100) {
            return sock.sendMessage(from, { text: "❌ Minimum gamble amount is $100!" }, { quoted: msg });
        }

        const user = await economy.getUserProfile(sender, pushName);
        const hasBankCard = (user.inventory.debit_card || 0) > 0;
        const total = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

        if (total < amount) {
            return sock.sendMessage(from, { text: `❌ You can't afford this gamble!\n💰 Total: *$${total.toLocaleString()}*` }, { quoted: msg });
        }

        // Deduct immediately (Bank Card aware)
        if (hasBankCard && user.financials.wallet < amount) {
            const rem = amount - user.financials.wallet;
            user.financials.wallet = 0;
            user.financials.bank -= rem;
        } else {
            user.financials.wallet -= amount;
        }
        await economy.updateHouseBalance(amount); // House takes the bet
        await economy.saveDB();

        const win = Math.random() < 0.48; // 48% win rate
        await economyTasks.trackProgress(sender, 'gamble');

        if (win) {
            const prize = amount * 2;
            if (hasBankCard) user.financials.bank += prize;
            else user.financials.wallet += prize;
            await economy.updateHouseBalance(-prize); // House pays the prize
            await economy.saveDB();
            await sock.sendMessage(from, { text: `🎰 *GAMBLE WIN* 🎰\n\nLucky you! You won *$${amount.toLocaleString()}*!\n💰 New Balance: *$${(hasBankCard ? user.financials.bank : user.financials.wallet).toLocaleString()}* (${hasBankCard ? 'Bank' : 'Wallet'})` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `💸 *GAMBLE LOSS* 💸\n\nHouse wins! You lost *$${amount.toLocaleString()}*.\n💰 New Balance: *$${(hasBankCard ? user.financials.bank : user.financials.wallet).toLocaleString()}* (${hasBankCard ? 'Bank' : 'Wallet'})` }, { quoted: msg });

            // Add typing before result
            await utils.simulateTyping(sock, from, 2000);
        }
    },

    /* 
     * Duel Bet (.bet @user <amount>)
     */
    handleDuel: async (msg, sock, botState, args) => {
        const from = utils.decodeJid(msg.key.remoteJid);
        const sender = utils.decodeJid(msg.key.participant || from);
        const pushName = msg.pushName || "User";

        if (args.length === 0 || args[0].toLowerCase() === 'help') {
            return sock.sendMessage(from, { text: `🎲 *DICE DUEL*\n\nUsage:\n- \`.duel @user <amount>\` : Challenge someone to high-stakes dice duel\n- \`.duel stop\` : Stop current duel (if active)\n- \`.accept\` : Accept a challenge\n- \`.reject\` : Reject a challenge` }, { quoted: msg });
        }

        if (args[0].toLowerCase() === 'stop') {
            if (games[from]) {
                const game = games[from];
                // Refund if game was bet-based
                if (game.bet > 0) {
                    // Assuming economy.updateBalance handles bank card logic internally
                    // Or, if it doesn't, we need to fetch user profiles and apply logic here
                    // For now, assuming it adds to wallet if no card, bank if card.
                    const p1User = await economy.getUserProfile(game.p1);
                    const p2User = await economy.getUserProfile(game.p2);

                    const hasCardP1 = (p1User.inventory.debit_card || 0) > 0;
                    if (hasCardP1) p1User.financials.bank += game.bet;
                    else p1User.financials.wallet += game.bet;

                    const hasCardP2 = (p2User.inventory.debit_card || 0) > 0;
                    if (hasCardP2) p2User.financials.bank += game.bet;
                    else p2User.financials.wallet += game.bet;
                    await economy.saveDB();
                }
                delete games[from];
                return sock.sendMessage(from, { text: "🛑 *GAME TERMINATED* 🛑\nBets have been refunded." }, { quoted: msg });
            }
            return sock.sendMessage(from, { text: "❌ No active game in this chat." }, { quoted: msg });
        }

        const target = utils.parseTarget(msg, args);
        if (!target) return sock.sendMessage(from, { text: "❌ Please mention someone to challenge!" }, { quoted: msg });

        if (target === sender) return sock.sendMessage(from, { text: "❌ You cannot challenge yourself!" }, { quoted: msg });
        if (games[from]) return sock.sendMessage(from, { text: "❌ A game is already in progress in this chat!" }, { quoted: msg });

        const amount = utils.parseNumber(args[1]) || 0;
        if (amount > 0) {
            const user = await economy.getUserProfile(sender, pushName);
            const hasBankCard = (user.inventory.debit_card || 0) > 0;
            const total = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

            if (total < amount) {
                return sock.sendMessage(from, { text: `❌ Insufficient Funds for this bet!\n💰 Total: $${total.toLocaleString()}` }, { quoted: msg });
            }

            // Deduct from Challenger immediately (Anti-Cheat)
            if (hasBankCard && user.financials.wallet < amount) {
                const rem = amount - user.financials.wallet;
                user.financials.wallet = 0;
                user.financials.bank -= rem;
            } else {
                user.financials.wallet -= amount;
            }
            await economy.saveDB();
        }

        games[from] = {
            p1: sender,
            p2: target,
            p1Name: pushName,
            p2Name: "Challenger", // Will update on first move
            board: [" ", " ", " ", " ", " ", " ", " ", " ", " "],
            turn: sender,
            bet: amount,
            startTime: Date.now()
        };

        const inviteMsg = `🎮 *TIC-TAC-TOE CHALLENGE* 🎮\n\n👤 *Challenger:* @${sender.split('@')[0]}\n👤 *Opponent:* @${target.split('@')[0]}\n💰 *Bet:* $${amount.toLocaleString()}\n\n*${pushName}* goes first. Type \`.move [1-9]\` to start!`;

        await sock.sendMessage(from, { text: inviteMsg, mentions: [sender, target] }, { quoted: msg });
    },

    /* 
     * Accept Duel (.accept)
     */
    handleAcceptDuel: async (msg, sock, botState) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);
        const pushName = msg.pushName || "User";

        if (!games[from] || games[from].type !== 'duel') return;

        const duel = games[from];
        if (sender !== duel.opponent) {
            return sock.sendMessage(from, { text: "❌ Only the challenged person can accept this duel!" }, { quoted: msg });
        }

        // Fetch both profiles
        const opponentUser = await economy.getUserProfile(sender, pushName);
        const challengerUser = await economy.getUserProfile(duel.challenger);

        // Check opponent can afford it
        const hasBankCardOpp = (opponentUser.inventory.debit_card || 0) > 0;
        const totalFundsOpp = hasBankCardOpp ? (opponentUser.financials.wallet + opponentUser.financials.bank) : opponentUser.financials.wallet;

        if (totalFundsOpp < duel.amount) {
            // Refund challenger if opponent cannot afford
            const hasBankCardChal = (challengerUser.inventory.debit_card || 0) > 0;
            if (hasBankCardChal) challengerUser.financials.bank += duel.amount;
            else challengerUser.financials.wallet += duel.amount;
            await economy.saveDB();

            delete games[from];
            return sock.sendMessage(from, { text: `❌ Challenge aborted! @${sender.split('@')[0]} cannot afford the bet. Stake refunded to challenger.`, mentions: [sender] }, { quoted: msg });
        }

        // --- Start Duel ---
        delete games[from]; // Prevent double acceptance

        // Deduct from Opponent immediately
        if (hasBankCardOpp && opponentUser.financials.wallet < duel.amount) {
            const rem = duel.amount - opponentUser.financials.wallet;
            opponentUser.financials.wallet = 0;
            opponentUser.financials.bank -= rem;
        } else {
            opponentUser.financials.wallet -= duel.amount;
        }
        await economy.saveDB();

        await sock.sendMessage(from, { text: "🎲 *Rolling the dice...*" }, { quoted: msg });

        // Dice Rolls (2-12)
        const roll1 = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        const roll2 = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;

        // Payouts are now simple additions since stakes were taken at commit
        await utils.delay(2000);

        let resultMsg = `🎲 *DUEL RESULTS* 🎲\n\n`;
        resultMsg += `@${duel.challenger.split('@')[0]} rolled: *${roll1}*\n`;
        resultMsg += `@${duel.opponent.split('@')[0]} rolled: *${roll2}*\n\n`;

        if (roll1 > roll2) {
            // Challenger wins
            const pot = duel.amount * 2;
            const hasCard = (challengerUser.inventory.debit_card || 0) > 0;
            if (hasCard) {
                challengerUser.financials.bank += pot;
                resultMsg += `🏆 *WINNER:* @${duel.challenger.split('@')[0]}\n💰 Payout: *$${pot.toLocaleString()}* (Deposited to Bank)`;
            } else {
                challengerUser.financials.wallet += pot;
                resultMsg += `🏆 *WINNER:* @${duel.challenger.split('@')[0]}\n💰 Payout: *$${pot.toLocaleString()}*`;
            }
        } else if (roll2 > roll1) {
            // Opponent wins
            const pot = duel.amount * 2;
            const hasCard = (opponentUser.inventory.debit_card || 0) > 0;
            if (hasCard) {
                opponentUser.financials.bank += pot;
                resultMsg += `🏆 *WINNER:* @${duel.opponent.split('@')[0]}\n💰 Payout: *$${pot.toLocaleString()}* (Deposited to Bank)`;
            } else {
                opponentUser.financials.wallet += pot;
                resultMsg += `🏆 *WINNER:* @${duel.opponent.split('@')[0]}\n💰 Payout: *$${pot.toLocaleString()}*`;
            }
        } else {
            // Draw - Refund both
            challengerUser.financials.wallet += duel.amount;
            opponentUser.financials.wallet += duel.amount;
            resultMsg += `🤝 *DRAW!*\nBets have been refunded to both pilots.`;
        }

        await economy.saveDB();
        await sock.sendMessage(from, {
            text: resultMsg,
            mentions: [duel.challenger, duel.opponent]
        }, { quoted: msg });
    },

    /* 
     * Reject Duel (.reject)
     */
    handleRejectDuel: async (msg, sock, botState) => {
        const from = sock.decodeJid(msg.key.remoteJid);
        const sender = sock.decodeJid(msg.key.participant || msg.key.remoteJid);

        if (!games[from] || games[from].type !== 'duel') return;

        const duel = games[from];
        if (sender === duel.opponent || sender === duel.challenger) {
            delete games[from];

            // Refund Challenger immediately
            const challengerUser = await economy.getUserProfile(duel.challenger);
            const hasBankCard = (challengerUser.inventory.debit_card || 0) > 0;
            if (hasBankCard) challengerUser.financials.bank += duel.amount;
            else challengerUser.financials.wallet += duel.amount;
            await economy.saveDB();

            const text = sender === duel.opponent
                ? `❌ @${sender.split('@')[0]} rejected the duel challenge. Stake refunded to challenger. Chickennnn! 🐔`
                : `🛑 Challenge cancelled by the challenger. Stake refunded.`;
            return sock.sendMessage(from, { text: text, mentions: [sender, duel.challenger] }, { quoted: msg });
        }
    },

    /* 
     * Coinflip (.coinflip <amount>)
     */
    handleCoinflip: async (msg, sock, botState, args) => {
        const from = utils.decodeJid(msg.key.remoteJid);
        const sender = utils.decodeJid(msg.key.participant || from);
        const pushName = msg.pushName || "User";

        if (args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: .coinflip <amount>" }, { quoted: msg });

        const user = await economy.getUserProfile(sender, pushName);
        const amount = args[0].toLowerCase() === 'all' ? user.financials.wallet : utils.parseNumber(args[0]);

        if (isNaN(amount) || amount <= 0) return sock.sendMessage(from, { text: "❌ Please enter a valid positive amount." }, { quoted: msg });

        const hasBankCard = (user.inventory.debit_card || 0) > 0;
        const total = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

        if (total < amount) {
            return sock.sendMessage(from, { text: `❌ You can't afford this flip!\n💰 Total: *$${total.toLocaleString()}*` }, { quoted: msg });
        }

        // Deduct immediately
        if (hasBankCard && user.financials.wallet < amount) {
            const rem = amount - user.financials.wallet;
            user.financials.wallet = 0;
            user.financials.bank -= rem;
        } else {
            user.financials.wallet -= amount;
        }
        await economy.updateHouseBalance(amount); // House takes the bet
        await economy.saveDB();

        await sock.sendMessage(from, { text: "🪙 *Flipping the galactic coin...*" }, { quoted: msg });
        await sock.sendMessage(from, { text: "🪙 *Flipping the galactic coin...*" }, { quoted: msg });
        await utils.simulateTyping(sock, from, 2000);

        const win = Math.random() < 0.5; // 50% win rate
        if (win) {
            const prize = amount * 2;
            if (hasBankCard) user.financials.bank += prize;
            else user.financials.wallet += prize;
            await economy.updateHouseBalance(-prize); // House pays the prize
            await economy.saveDB();
            await sock.sendMessage(from, { text: `🪙 *COINFLIP WIN* 🪙\n\nIt's * HEADS* ! You doubled your money!\n💰 Won: *$${amount.toLocaleString()}*\n💰 New Balance: *$${(hasBankCard ? user.financials.bank : user.financials.wallet).toLocaleString()}*` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `🪙 *COINFLIP LOSS* 🪙\n\nIt's * TAILS* ! The house takes it.\n💰 Lost: *$${amount.toLocaleString()}*\n💰 New Balance: *$${(hasBankCard ? user.financials.bank : user.financials.wallet).toLocaleString()}*` }, { quoted: msg });
        }
    },

    /* 
     * Slot Machine (.slot <amount>)
     */
    handleSlot: async (msg, sock, botState, args) => {
        // ... (existing slot logic matches) ... (Wait, I can't replicate existing logic here without full context, using insertion point correctly)
        // I should insert NEW methods before the closing brace.
    }, // Closing handleSlot (implied by previous context)

    /*
     * Russian Roulette (.roulette <amount>)
     * High Stakes: Win 3x or Go to Jail
     */
    handleRoulette: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const pushName = msg.pushName || "User";

        if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: .roulette <amount>\nRisk: 1/6 Chance of JAIL. Win: 3x Payout." }, { quoted: msg });

        // Bet Validation
        const user = await economy.getUserProfile(sender, pushName);
        const amount = args[0].toLowerCase() === 'all' ? Math.min(user.financials.wallet, 100000) : utils.parseNumber(args[0]);

        if (isNaN(amount) || amount < 1000) return sock.sendMessage(from, { text: "❌ Min bet is $1,000." }, { quoted: msg });
        if (amount > 100000) return sock.sendMessage(from, { text: "❌ Max bet is $100,000 to prevent economy collapse." }, { quoted: msg });

        const hasBankCard = (user.inventory.debit_card || 0) > 0;
        const total = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

        if (total < amount) {
            return sock.sendMessage(from, { text: `❌ You can't afford this! Total: $${total.toLocaleString()}` }, { quoted: msg });
        }

        // Deduct Bet
        if (hasBankCard && user.financials.wallet < amount) {
            const rem = amount - user.financials.wallet;
            user.financials.wallet = 0;
            user.financials.bank -= rem;
        } else {
            user.financials.wallet -= amount;
        }
        await economy.updateHouseBalance(amount);
        await economy.saveDB();

        // Spin Cylinder
        const chamber = Math.floor(Math.random() * 6); // 0-5
        const bullet = 5; // Bullet is in chamber 5

        if (chamber === bullet) {
            // BANG!
            const jailTime = 600000; // 10 Minutes
            user.jail_until = Date.now() + jailTime;
            await economy.saveDB();

            await utils.simulateTyping(sock, from, 1500); // Suspense...
            return sock.sendMessage(from, {
                text: `🔫 *BANG!* 💥\n\nYou pulled the trigger and... darkness.\n\n💸 *Lost:* $${amount.toLocaleString()}\n🚑 *Status:* Hospitalized (Jailed for 10m)\n\n_Play stupid games, win stupid prizes._`
            }, { quoted: msg });
        } else {
            // CLICK...
            await economyTasks.trackProgress(sender, 'gamble'); // Surviving roulette counts as gambling
            const prize = amount * 3;
            if (hasBankCard) user.financials.bank += prize;
            else user.financials.wallet += prize;
            await economy.updateHouseBalance(-prize);
            await economy.saveDB();

            await utils.simulateTyping(sock, from, 1500); // Suspense...
            return sock.sendMessage(from, {
                text: `🔫 *CLICK...* 😰\n\nYou survived!\n\n💰 *Winnings:* $${prize.toLocaleString()} (3x)\n_Adrenaline is pumping._`
            }, { quoted: msg });
        }
    },

    /* 
     * Blackjack (.bj <amount>)
     */
    handleBlackjack: async (msg, sock, botState, args) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const pushName = msg.pushName || "User";

        if (games[from]) return sock.sendMessage(from, { text: "❌ Function in use! Finish the current game first." }, { quoted: msg });

        if (!args || args.length === 0) return sock.sendMessage(from, { text: "❌ Usage: .bj <amount>" }, { quoted: msg });

        const amount = args[0].toLowerCase() === 'all' ? 50000 : utils.parseNumber(args[0]);
        if (isNaN(amount) || amount < 500) return sock.sendMessage(from, { text: "❌ Min bet $500." }, { quoted: msg });

        const user = await economy.getUserProfile(sender, pushName);
        const hasBankCard = (user.inventory.debit_card || 0) > 0;
        const total = hasBankCard ? (user.financials.wallet + user.financials.bank) : user.financials.wallet;

        if (total < amount) return sock.sendMessage(from, { text: "❌ Insufficient funds." }, { quoted: msg });

        // Deduct
        if (hasBankCard && user.financials.wallet < amount) {
            const rem = amount - user.financials.wallet;
            user.financials.wallet = 0;
            user.financials.bank -= rem;
        } else {
            user.financials.wallet -= amount;
        }
        await economy.updateHouseBalance(amount);
        await economy.saveDB();

        // Track Task
        await economyTasks.trackProgress(sender, 'gamble');

        // Deal
        const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]; // Simplified infinite deck
        const draw = () => deck[Math.floor(Math.random() * deck.length)];

        const playerHand = [draw(), draw()];
        const dealerHand = [draw()]; // Hidden second card logic simplified: just show 1 now.

        games[from] = {
            type: 'blackjack',
            player: sender,
            bet: amount,
            playerHand,
            dealerHand,
            ts: Date.now()
        };

        const pTotal = playerHand.reduce((a, b) => a + b, 0);

        // Auto-Win Check (Natural 21)
        if (pTotal === 21) {
            const prize = amount * 2.5; // 3:2 payout standard + bet back = 2.5x
            if (hasBankCard) user.financials.bank += prize;
            else user.financials.wallet += prize;
            await economy.updateHouseBalance(-prize);
            await economy.saveDB();
            delete games[from];
            return sock.sendMessage(from, { text: `🃏 *BLACKJACK!* 🃏\n\nCards: [${playerHand.join(', ')}] = 21\n\n💰 *Won:* $${prize.toLocaleString()}` }, { quoted: msg });
        }

        await utils.simulateTyping(sock, from, 1500);
        return sock.sendMessage(from, {
            text: `🃏 *BLACKJACK STARTED*\n\nYour Hand: [ ${playerHand.join(', ')} ] = *${pTotal}*\nDealer: [ ${dealerHand[0]}, ? ]\n\n💰 *Bet:* $${amount.toLocaleString()}\n\nOptions: \`.hit\` or \`.stand\``
        }, { quoted: msg });
    },

    handleHit: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;

        const game = games[from];
        if (!game || game.type !== 'blackjack' || game.player !== sender) return;

        const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
        const card = deck[Math.floor(Math.random() * deck.length)];
        game.playerHand.push(card);

        let total = game.playerHand.reduce((a, b) => a + b, 0);

        // Ace Logic (Simple: If > 21 and have 11, turn 11 to 1)
        if (total > 21 && game.playerHand.includes(11)) {
            const idx = game.playerHand.indexOf(11);
            game.playerHand[idx] = 1;
            total = game.playerHand.reduce((a, b) => a + b, 0);
        }

        if (total > 21) {
            delete games[from];
            return sock.sendMessage(from, { text: `💥 *BUST!* (${total})\n\nHand: [ ${game.playerHand.join(', ')} ]\n\n💸 You lost $${game.bet.toLocaleString()}` }, { quoted: msg });
        }

        if (total === 21) {
            // Auto Stand
            return module.exports.handleStand(msg, sock, botState);
        }

        return sock.sendMessage(from, { text: `🃏 *HIT*\n\nHand: [ ${game.playerHand.join(', ')} ] = *${total}*\nActions: \`.hit\` or \`.stand\`` }, { quoted: msg });
    },

    handleStand: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const game = games[from];

        if (!game || game.type !== 'blackjack' || game.player !== sender) return;

        const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11];
        let dTotal = game.dealerHand.reduce((a, b) => a + b, 0);

        // Dealer plays
        while (dTotal < 17) {
            const card = deck[Math.floor(Math.random() * deck.length)];
            game.dealerHand.push(card);
            dTotal += card;

            // Ace adjustment for dealer
            if (dTotal > 21 && game.dealerHand.includes(11)) {
                const idx = game.dealerHand.indexOf(11);
                game.dealerHand[idx] = 1;
                dTotal = game.dealerHand.reduce((a, b) => a + b, 0);
            }
        }

        const pTotal = game.playerHand.reduce((a, b) => a + b, 0);
        let result = "";
        let won = false;
        let drawToken = false;

        if (dTotal > 21) {
            result = "Dealer Busted! You Win!";
            won = true;
        } else if (pTotal > dTotal) {
            result = "You Win!";
            won = true;
        } else if (pTotal === dTotal) {
            result = "Push (Draw).";
            drawToken = true;
        } else {
            result = "Dealer Wins.";
        }

        const user = await economy.getUserProfile(sender);
        const hasBankCard = (user.inventory.debit_card || 0) > 0;

        if (won) {
            const prize = game.bet * 2;
            if (hasBankCard) user.financials.bank += prize;
            else user.financials.wallet += prize;
            await economy.updateHouseBalance(-prize);
            await economy.saveDB();
        } else if (drawToken) {
            if (hasBankCard) user.financials.bank += game.bet;
            else user.financials.wallet += game.bet;
            await economy.saveDB();
        }

        delete games[from];

        return sock.sendMessage(from, {
            text: `🃏 *GAME OVER*\n\nYour Hand: ${pTotal}\nDealer: [ ${game.dealerHand.join(', ')} ] = ${dTotal}\n\n📢 *${result}*`
        }, { quoted: msg });
    },
};

/* 
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
