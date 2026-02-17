/* 
 * Economy Game Module
 * Handles .gamble, .duel, .ttt
 */

import economy from './economy.js';
import utils from '../core/utils.js';

// --- GAMBLE ---
async function handleGamble(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args[0]) return sock.sendMessage(from, { text: "❌ Usage: `.gamble <amount> [red/black]`" }, { quoted: msg });

    const amount = utils.parseNumber(args[0]);
    if (!amount || amount <= 0) return sock.sendMessage(from, { text: "❌ Invalid amount!" }, { quoted: msg });

    const bal = await economy.getBalance(sender, 'wallet');
    if (bal < amount) return sock.sendMessage(from, { text: "❌ Insufficient funds!" }, { quoted: msg });

    // 50/50 Chance
    const win = Math.random() > 0.5;

    if (win) {
        await economy.updateBalance(sender, amount, 'wallet');
        return sock.sendMessage(from, { text: `🎰 *WINNER! (+${amount})*\n\nYou gambled $${amount} and won! Your luck is shining.` }, { quoted: msg });
    } else {
        await economy.updateBalance(sender, -amount, 'wallet');
        return sock.sendMessage(from, { text: `💸 *LOST (-${amount})*\n\nThe house always wins. Better luck next time!` }, { quoted: msg });
    }
}

// --- DUEL ---
async function handleDuel(msg, sock, botState, args) {
    // Placeholder for Duel (Rock Paper Scissors or Dice)
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args[0]) return sock.sendMessage(from, { text: "❌ Usage: `.duel @opponent <amount>`" }, { quoted: msg });

    // Simplified Dice Duel
    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const botRoll = Math.floor(Math.random() * 6) + 1;

    let txt = `🎲 *DICE DUEL*\n\nYou rolled: *${playerRoll}*\nBot rolled: *${botRoll}*\n\n`;

    if (playerRoll > botRoll) {
        txt += "🏆 *YOU WIN!*";
    } else if (playerRoll < botRoll) {
        txt += "💀 *YOU LOSE!*";
    } else {
        txt += "🤝 *DRAW!*";
    }

    return sock.sendMessage(from, { text: txt }, { quoted: msg });
}

// --- TIC TAC TOE ---
async function handleTTT(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    return sock.sendMessage(from, { text: "⭕✖️ *Tic-Tac-Toe*\n\nUse `.ttt start` or `.ttt join` to play against others! (Coming Soon)" }, { quoted: msg });
}

// --- EVENTS ---
async function processDiamondEvent(sock) {
    // 1% chance to spawn a diamond
    if (Math.random() < 0.01) {
        const locations = ["Earth", "Mars", "Cyber City", "The Void"];
        const location = locations[Math.floor(Math.random() * locations.length)];
        return { location };
    }
    return null;
}

export {
    handleGamble,
    handleDuel,
    handleTTT,
    processDiamondEvent,
    isPurgeActive
};

export default {
    handleGamble,
    handleDuel,
    handleTTT,
    processDiamondEvent,
    isPurgeActive
};

// --- HELPER ---
function isPurgeActive() {
    return false; // Placeholder
}
