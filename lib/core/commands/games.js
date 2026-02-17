import gameZone from '../../games/game-zone.js';
const { handleTicTacToe, handleMove, handleGamble, handleCoinflip, handleSlot, handleRoulette, handleBlackjack, handleHit, handleStand, handleDuel, handleAcceptDuel, handleRejectDuel, handleChess, handleConnect4, handleMonopoly, handleGameAction } = gameZone;
import { parseTarget } from '../utils.js';

/**
 * Game Zone commands (Casino, Duels, Strategy)
 * Ported from monolithic handler.js
 */
export default [
    {
        name: 'ttt',
        aliases: ['tictactoe'],
        category: 'games',
        description: 'Play Tic-Tac-Toe.',
        execute: async (msg, sock, args, botState) => {
            return handleTicTacToe(msg, sock, botState, args);
        }
    },
    {
        name: 'move',
        category: 'games',
        description: 'Make a move in a game (Tic-Tac-Toe, etc).',
        execute: async (msg, sock, args, botState) => {
            return handleMove(msg, sock, botState, args[0]);
        }
    },
    {
        name: 'gamble',
        aliases: ['bet'],
        category: 'economy',
        description: 'Gamble your money or start a duel.',
        execute: async (msg, sock, args, botState) => {
            // Smart Routing for .bet
            const target = parseTarget(msg, args);
            if (target) {
                return handleDuel(msg, sock, botState, args);
            } else {
                return handleGamble(msg, sock, botState, args);
            }
        }
    },
    {
        name: 'coinflip',
        aliases: ['cf'],
        category: 'economy',
        description: 'Flip a coin to double your bet.',
        execute: async (msg, sock, args, botState) => {
            return handleCoinflip(msg, sock, botState, args);
        }
    },
    {
        name: 'slot',
        aliases: ['slots'],
        category: 'economy',
        description: 'Play the slot machine.',
        execute: async (msg, sock, args, botState) => {
            return handleSlot(msg, sock, botState, args);
        }
    },
    {
        name: 'roulette',
        category: 'economy',
        description: 'Play Russian Roulette or Casino Roulette.',
        execute: async (msg, sock, args, botState) => {
            return handleRoulette(msg, sock, botState, args);
        }
    },
    {
        name: 'blackjack',
        aliases: ['bj'],
        category: 'economy',
        description: 'Play a game of Blackjack.',
        execute: async (msg, sock, args, botState) => {
            return handleBlackjack(msg, sock, botState, args);
        }
    },
    {
        name: 'hit',
        category: 'games',
        description: 'Hit in Blackjack.',
        execute: async (msg, sock, args, botState) => {
            return handleHit(msg, sock, botState);
        }
    },
    {
        name: 'stand',
        category: 'games',
        description: 'Stand in Blackjack.',
        execute: async (msg, sock, args, botState) => {
            return handleStand(msg, sock, botState);
        }
    },
    {
        name: 'duel',
        category: 'games',
        description: 'Challenge someone to a duel.',
        execute: async (msg, sock, args, botState) => {
            return handleDuel(msg, sock, botState, args);
        }
    },
    {
        name: 'accept',
        category: 'games',
        description: 'Accept a duel or game invite.',
        execute: async (msg, sock, args, botState) => {
            return handleAcceptDuel(msg, sock, botState);
        }
    },
    {
        name: 'reject',
        category: 'games',
        description: 'Reject a duel or game invite.',
        execute: async (msg, sock, args, botState) => {
            return handleRejectDuel(msg, sock, botState);
        }
    },
    {
        name: 'chess',
        category: 'games',
        description: 'Start a game of Chess.',
        execute: async (msg, sock, args, botState) => {
            return handleChess(msg, sock, botState, args);
        }
    },
    {
        name: 'connect4',
        aliases: ['c4'],
        category: 'games',
        description: 'Play Connect 4.',
        execute: async (msg, sock, args, botState) => {
            return handleConnect4(msg, sock, botState, args);
        }
    },
    {
        name: 'monopoly',
        aliases: ['m'],
        category: 'games',
        description: 'Start a game of Monopoly.',
        execute: async (msg, sock, args, botState) => {
            return handleMonopoly(msg, sock, botState, args);
        }
    },
    {
        name: 'roll',
        category: 'games',
        description: 'Roll the dice in Monopoly.',
        execute: async (msg, sock, args, botState) => {
            return handleGameAction(msg, sock, botState, 'roll');
        }
    },
    {
        name: 'buyprop',
        category: 'games',
        description: 'Buy property in Monopoly.',
        execute: async (msg, sock, args, botState) => {
            return handleGameAction(msg, sock, botState, 'buyprop');
        }
    },
    {
        name: 'endturn',
        category: 'games',
        description: 'End your turn in Monopoly.',
        execute: async (msg, sock, args, botState) => {
            return handleGameAction(msg, sock, botState, 'endturn');
        }
    }
];
