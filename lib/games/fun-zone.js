const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { Jimp, loadFont, HorizontalAlign, VerticalAlign } = require('jimp');
const fs = require('fs-extra');
const path = require('path');
const utils = require('../core/utils');

// --- Predefined Data ---
const TRUTH_QUESTIONS = [
    "What is your biggest fear?", "Who is your crush?", "What's the last lie you told?",
    "Have you ever peed in a pool?", "What's a secret you've never told anyone?",
    "Who is the most annoying person in this group?", "What is your guilty pleasure?",
    "If you could date anyone here, who would it be?", "What's your most embarrassing moment?"
];

const DARE_CHALLENGES = [
    "Send a voice note singing a song.", "Post your funniest selfie.", "Call your crush.",
    "Send an emoji that describes your mood.", "Bark like a dog in a voice note.",
    "Change your bio to 'I love Starry MD' for 24 hours.", "Send the last photo in your gallery."
];

const EIGHT_BALL_ANSWERS = [
    "Yes, definitely.", "It is certain.", "Without a doubt.", "Yes.",
    "Reply hazy, try again.", "Ask again later.", "Cannot predict now.",
    "Don't count on it.", "My reply is no.", "My sources say no.", "Outlook not so good."
];

// --- Helper: Get Sender JID ---
const getSender = (msg, sock) => {
    return msg.key.fromMe
        ? (sock.user.id.split(':')[0] + '@s.whatsapp.net')
        : (msg.key.participant || msg.key.remoteJid);
};

module.exports = {
    /* 
     * Ship - Love Composite (.ship @user1 @user2)
     */
    handleShip: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

        let user1, user2;
        const sender = getSender(msg, sock);

        // Logic: 
        // 1. If 2 mentions -> Ship those two.
        // 2. If 1 mention -> Ship Sender + Mention.
        if (mentions.length >= 2) {
            user1 = mentions[0];
            user2 = mentions[1];
        } else if (mentions.length === 1) {
            user1 = sender;
            user2 = mentions[0];
        } else {
            return sock.sendMessage(from, { text: "❌ Please mention someone to ship with!" }, { quoted: msg });
        }

        // UX: React while processing
        await sock.sendMessage(from, { react: { text: "💘", key: msg.key } });

        const score = Math.floor(Math.random() * 100) + 1;

        // Progress Bar Logic
        const barLength = 10;
        const filledBars = Math.round((score / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = "❤️".repeat(filledBars) + "🖤".repeat(emptyBars);

        let comment = "";
        if (score > 90) comment = "Perfect Match! 💍✨";
        else if (score > 70) comment = "Hot Couple! 🔥💕";
        else if (score > 50) comment = "Looking Good! 😘";
        else if (score > 30) comment = "Just Friends? 🙃";
        else comment = "Maybe not... 💀";

        const summary = `💘 *COSMIC LOVE METER* 💘\n\n` +
            `👉 @${user1.split('@')[0]}\n` +
            `👉 @${user2.split('@')[0]}\n\n` +
            `📊 *Score:* ${score}%\n` +
            `${progressBar}\n\n` +
            `_${comment}_`;

        await utils.simulateTyping(sock, from, 2500);
        await sock.sendMessage(from, {
            text: summary,
            mentions: [user1, user2]
        }, { quoted: msg });
    },

    /* 
     * Match Maker (.match) - Group Only
     */
    handleMatch: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;

        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: "❌ This command is for groups only!" }, { quoted: msg });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants.map(p => p.id);

            if (participants.length < 2) return sock.sendMessage(from, { text: "❌ Not enough people here!" }, { quoted: msg });

            const p1 = participants[Math.floor(Math.random() * participants.length)];
            let p2 = participants[Math.floor(Math.random() * participants.length)];

            // Prevent self-match
            while (p2 === p1) {
                p2 = participants[Math.floor(Math.random() * participants.length)];
            }

            const phrases = [
                "I think these two would be cute! ❤️",
                "New Couple Alert! 🔔",
                "The stars have aligned for... ✨",
                "Match made in heaven? 💍"
            ];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

            await utils.simulateTyping(sock, from, 2000);
            await sock.sendMessage(from, {
                text: `👩‍❤️‍👨 *STARRY MATCH MAKER*\n\n${randomPhrase}\n\n👉 @${p1.split('@')[0]} & @${p2.split('@')[0]}`,
                mentions: [p1, p2]
            }, { quoted: msg });

        } catch (err) {
            utils.log("ERROR", `Match Failed: ${err.message}`);
            await sock.sendMessage(from, { text: "❌ Failed to fetch group members." }, { quoted: msg });
        }
    },

    /* 
     * Gay Check (.gaycheck)
     */
    handleGayCheck: async (msg, sock, botState) => {
        const from = msg.key.remoteJid;
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        // Fixed: Prioritize mentions, then fallback to sender.
        const sender = msg.key.participant || msg.key.remoteJid;
        const target = mentions[0] || sender;

        const percent = Math.floor(Math.random() * 100) + 1;

        await utils.simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, {
            text: `🏳️‍🌈 *GAY CHECKER*\n\nTarget: @${target.split('@')[0]}\nScore: *${percent}% Gay* 💅`,
            mentions: [target]
        }, { quoted: msg });
    },

    /* 
     * Truth (.truth)
     */
    handleTruth: async (msg, sock) => {
        const q = TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
        await utils.simulateTyping(sock, msg.key.remoteJid, 1000);
        await sock.sendMessage(msg.key.remoteJid, { text: `🧠 *TRUTH:*\n\n${q}` }, { quoted: msg });
    },

    /* 
     * Dare (.dare)
     */
    handleDare: async (msg, sock) => {
        const d = DARE_CHALLENGES[Math.floor(Math.random() * DARE_CHALLENGES.length)];
        await utils.simulateTyping(sock, msg.key.remoteJid, 1000);
        await sock.sendMessage(msg.key.remoteJid, { text: `🔥 *DARE:*\n\n${d}` }, { quoted: msg });
    },

    /* 
     * 8-Ball (.8ball)
     */
    handle8Ball: async (msg, sock, botState, query) => {
        // If query is passed as an argument from your command handler
        // If not, you might need to extract it from msg.message.conversation or extendedTextMessage
        const ans = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];
        await utils.simulateTyping(sock, msg.key.remoteJid, 1000);
        await sock.sendMessage(msg.key.remoteJid, { text: `🎱 *8-Ball says:*\n\n${ans}` }, { quoted: msg });
    },

    /* 
     * Poll (.poll)
     */
    handlePoll: async (msg, sock, args) => {
        const from = msg.key.remoteJid;
        const input = args.join(' ');

        if (!input) {
            return sock.sendMessage(from, { text: "❌ Usage: .poll Question | Option1 | Option2" }, { quoted: msg });
        }

        const parts = input.split('|').map(p => p.trim()).filter(p => p);
        let name = parts[0];
        let values = parts.slice(1);

        // Default to Yes/No if no options provided
        if (values.length === 0) {
            values = ["Yes", "No"];
        }

        await sock.sendMessage(from, {
            poll: {
                name: name,
                values: values,
                selectableCount: 1
            }
        });
    },

    /* 
     * Debate (.debate)
     */
    handleDebate: async (msg, sock, args) => {
        const from = msg.key.remoteJid;

        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: "❌ Group command only." }, { quoted: msg });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants.map(p => p.id);

            if (participants.length < 2) {
                return sock.sendMessage(from, { text: "❌ Not enough members for a debate!" }, { quoted: msg });
            }

            // 1. Get Mentions
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

            // 2. Parse Topic (remove args starting with @)
            const topicArgs = args.filter(arg => !arg.startsWith('@'));
            const topic = topicArgs.length > 0 ? topicArgs.join(' ') : "Free Debate!";

            let p1, p2;

            if (mentions.length >= 2) {
                // Case A: 2+ Mentions
                p1 = mentions[0];
                p2 = mentions[1];
            } else if (mentions.length === 1) {
                // Case B: 1 Mention -> Target vs Random
                p1 = mentions[0];
                do {
                    p2 = participants[Math.floor(Math.random() * participants.length)];
                } while (p2 === p1);
            } else {
                // Case C: No Mentions -> Random vs Random
                p1 = participants[Math.floor(Math.random() * participants.length)];
                do {
                    p2 = participants[Math.floor(Math.random() * participants.length)];
                } while (p2 === p1);
            }

            await utils.simulateTyping(sock, from, 2000);
            await sock.sendMessage(from, {
                text: `🗣️ *THE GREAT DEBATE* 🗣️\n\n🔹 *For:* @${p1.split('@')[0]}\n🔸 *Against:* @${p2.split('@')[0]}\n\n🎙️ *Topic:* ${topic}\n\n_Fight!_`,
                mentions: [p1, p2]
            }, { quoted: msg });

        } catch (e) {
            utils.log("ERROR", `Debate command failed: ${e.message}`);
            await sock.sendMessage(from, { text: "❌ Error starting debate." }, { quoted: msg });
        }
    }
};
