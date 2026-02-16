/**
 * Goon Mode Controller 1.0 (Modular)
 * Handles automated sessions, interactive games, and media stashing.
 */
const utils = require('../utils');
const fs = require('fs-extra');
const path = require('path');
const phService = require('../../services/ph-service'); // Use central service

const STASH_DB = path.join(__dirname, '../../../database/goon_stash.json');

module.exports = {
    handleGoon: async (msg, sock, botState, cmd, args) => {
        const from = msg.key.remoteJid;
        const body = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();

        // Standard check: only works if bot is in $goon mode
        if (botState.mode !== '$goon' && !['goon'].includes(cmd)) return false;

        switch (cmd) {
            case 'goon':
                if (args[0] === 'start') return handleAutoSession(msg, sock, botState, args.slice(1));
                if (args[0] === 'stop') return handleAutoSession(msg, sock, botState, ['stop']);
                return sock.sendMessage(from, { text: "😈 *GOON MODE ACTIVE*\n\nUsage:\n.goon start <tag> [interval]\n.edge\n.stash\n.goonroulette" }, { quoted: msg });

            case 'edge':
                return handleEdgeGame(msg, sock, botState);

            case 'stash':
                return handleStash(msg, sock, botState, args);

            case 'goonroulette':
                return handleRoulette(msg, sock, botState);

            default:
                return false;
        }
    }
};

/**
 * Automated media session
 */
async function handleAutoSession(msg, sock, botState, args) {
    const from = msg.key.remoteJid;

    if (args[0] === 'stop') {
        if (!botState.activeGoonSession?.[from]) return sock.sendMessage(from, { text: "❌ No active session to stop." }, { quoted: msg });
        clearInterval(botState.activeGoonSession[from].timer);
        delete botState.activeGoonSession[from];
        return sock.sendMessage(from, { text: "🛑 *SESSION TERMINATED*" }, { quoted: msg });
    }

    const tag = args[0] || 'random';
    const interval = parseInt(args[1]) || 5;

    if (botState.activeGoonSession?.[from]) return sock.sendMessage(from, { text: "⚠️ A session is already active in this chat. Use `.goon stop` first." }, { quoted: msg });

    await sock.sendMessage(from, { text: `🔥 *GOON SESSION STARTED*\n\n🏷️ *Tag:* ${tag}\n⏱️ *Interval:* ${interval} mins\n\n_Fetching initial content..._` });

    const runSessionStep = async () => {
        try {
            const results = await phService.scrapeGifs(tag);
            if (results.length > 0) {
                const random = results[Math.floor(Math.random() * results.length)];
                await sock.sendMessage(from, { video: { url: random.link }, caption: `🔞 *SESSION UPDATE:* ${random.title}`, gifPlayback: true });
            } else {
                // Fallback to video search
                const vids = await phService.scrapeSearch(tag);
                if (vids.length > 0) {
                    const random = vids[Math.floor(Math.random() * vids.length)];
                    await sock.sendMessage(from, { text: `🔗 *SESSION FEED:* ${random.title}\n${random.link}` });
                }
            }
        } catch (e) {
            utils.log("ERROR", `Goon Session Loop Failed: ${e.message}`);
        }
    };

    // Run first immediately
    await runSessionStep();

    const timer = setInterval(runSessionStep, interval * 60000);

    if (!botState.activeGoonSession) botState.activeGoonSession = {};
    botState.activeGoonSession[from] = { tag, interval, timer };
}

/**
 * .edge - Interactive edging game
 */
async function handleEdgeGame(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const prompts = [
        "⏳ *HOLD IT...*",
        "🌀 *FOCUS ON THE SENSATION...*",
        "📉 *SLOW DOWN...*",
        "📈 *SPEED UP...*",
        "🛑 *STOP NOW!*",
        "😈 *CONTINUE...*",
        "⚠️ *EDGING ALERT:* Look away for 15 seconds.",
        "🔥 *MAX EFFORT:* Go as fast as you can for 20 seconds.",
        "❄️ *FREEZE:* Do not move a muscle until I say so."
    ];
    const random = prompts[Math.floor(Math.random() * prompts.length)];
    await sock.sendMessage(from, { text: random }, { quoted: msg });
}

/**
 * .stash save | .stash view
 */
async function handleStash(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const sub = args[0]?.toLowerCase();

    const stash = fs.readJsonSync(STASH_DB, { throws: false }) || {};

    if (sub === 'save') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) return sock.sendMessage(from, { text: "❌ Quote a message to stash it!" }, { quoted: msg });

        if (!stash[sender]) stash[sender] = [];
        stash[sender].push({ timestamp: Date.now(), content: quoted });
        fs.writeJsonSync(STASH_DB, stash);
        return sock.sendMessage(from, { text: "📥 *STASHED SUCCESSFULLY*" }, { quoted: msg });
    }

    if (sub === 'view' || !sub) {
        const userStash = stash[sender] || [];
        if (userStash.length === 0) return sock.sendMessage(from, { text: "🕳️ *YOUR STASH IS EMPTY*" }, { quoted: msg });

        let txt = `🗳️ *YOUR STASH (${userStash.length} items)*\n\n`;
        userStash.slice(-5).forEach((item, i) => {
            const time = new Date(item.timestamp).toLocaleTimeString();
            txt += `${i + 1}. [${time}] - Stashed Media\n`;
        });
        txt += `\n_Stash is for your private collection._`;
        return sock.sendMessage(from, { text: txt }, { quoted: msg });
    }
}

/**
 * .goonroulette - Random dare/content
 */
async function handleRoulette(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const dares = [
        "😈 *DARE:* No hands for 2 minutes.",
        "📉 *DARE:* Turn off the sound for the next one.",
        "🔥 *DARE:* Go as fast as you can for 30 seconds.",
        "🛑 *DARE:* Stop everything for 1 full minute.",
        "🎭 *DARE:* Put on a blindfold for the next session loop.",
        "🎮 *DARE:* You must follow every .edge prompt until commanded to stop."
    ];
    const roll = dares[Math.floor(Math.random() * dares.length)];
    await sock.sendMessage(from, { text: roll }, { quoted: msg });
}
