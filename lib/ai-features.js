const fs = require('fs-extra');
const ai = require('./ai');
const utils = require('./utils');
const config = require('../config'); // Added config requirement for botJid check

/* 
 * AI Mention Handler & Dynamic Help System
 */

/* 
 * Handle AI Toggle Command
 */
async function handleAIToggle(msg, sock, botState, args) {
    const from = msg.key.remoteJid;

    if (!botState.settings) botState.settings = {};

    const subCmd = (Array.isArray(args) ? args.join(" ") : args).toLowerCase().trim();

    // Show current status
    if (!subCmd) {
        const mode = botState.settings.aiMentionMode ? 'ON' : 'OFF';
        const persona = botState.settings.aiMentionPersona || 'default';

        return sock.sendMessage(from, {
            text: `🤖 *AI MENTION MODE*\n\n` +
                `📊 *Status:* ${mode}\n` +
                `🎭 *Persona:* ${persona}\n\n` +
                `*Usage:*\n` +
                `• .aitoggle on - Enable AI responses\n` +
                `• .aitoggle off - Disable AI responses\n` +
                `• .aitoggle <persona> - Set persona\n\n` +
                `*Available Personas:*\n` +
                `yuki, fizz, jax, ren, bella, tech, uwu, mom, pirate, default\n\n` +
                `💡 When ON, bot uses AI to respond to mentions/tags.\n` +
                `When OFF, you can chat normally.`
        }, { quoted: msg });
    }

    // Toggle on/off
    if (subCmd === 'on') {
        botState.settings.aiMentionMode = true;
        fs.writeJsonSync('./database/bot_settings.json', botState.settings);
        await sock.sendMessage(from, {
            text: `✅ *AI MENTION MODE: ON*\n\n` +
                `Bot will now use AI (${botState.settings.aiMentionPersona || 'default'}) to respond to mentions/tags.\n\n` +
                `💡 Commands like .ai still work normally.`
        }, { quoted: msg });
        return await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } });
    }

    if (subCmd === 'off') {
        botState.settings.aiMentionMode = false;
        fs.writeJsonSync('./database/bot_settings.json', botState.settings);
        await sock.sendMessage(from, {
            text: `🔇 *AI MENTION MODE: OFF*\n\n` +
                `Bot will not respond to mentions/tags.\n` +
                `You can chat normally when mentioned.\n\n` +
                `💡 Commands like .ai still work.`
        }, { quoted: msg });
        return await sock.sendMessage(from, { react: { text: "🔕", key: msg.key } });
    }

    // Set persona
    const validPersonas = ['yuki', 'fizz', 'jax', 'ren', 'bella', 'tech', 'uwu', 'mom', 'pirate', 'normal', 'human', 'default'];
    if (validPersonas.includes(subCmd)) {
        botState.settings.aiMentionPersona = subCmd;
        fs.writeJsonSync('./database/bot_settings.json', botState.settings);
        await sock.sendMessage(from, {
            text: `🎭 *AI PERSONA UPDATED*\n\n` +
                `Mention responses will now use: *${subCmd}*\n\n` +
                `Try mentioning the bot to see the new personality!`
        }, { quoted: msg });
        return await sock.sendMessage(from, { react: { text: "✨", key: msg.key } });
    }

    // Invalid option
    return sock.sendMessage(from, {
        text: `❌ Invalid option: ${subCmd}\n\n` +
            `Use: .aitoggle on/off/<persona>`
    }, { quoted: msg });
}

/* 
 * Handle AI Mention Response
 */
async function handleMentionAI(msg, sock, botState, body) {
    const from = msg.key.remoteJid;
    const isMe = msg.key.fromMe;

    // 1. Basic Checks
    if (isMe) return false; // Never reply to self
    if (!botState.settings.aiMentionMode) return false; // Mode is OFF

    // 2. Identify Bot JID
    const botJid = utils.decodeJid(sock.user.id);
    const botNumber = botJid.split('@')[0];

    // 3. Mention Detection Logic
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const mentionedJids = contextInfo?.mentionedJid || [];
    const quotedParticipant = contextInfo?.participant ? utils.decodeJid(contextInfo.participant) : null;

    let isDirectMention = false;
    let isReplyToBot = false;

    // Check 1: Official Mention (in array) - Robust Check
    if (mentionedJids.some(jid => utils.decodeJid(jid) === botJid)) {
        isDirectMention = true;
    }

    // Check 2: Text Mentions fallback 
    if (body.toLowerCase().includes('@starry') || body.includes(`@${botNumber}`)) {
        isDirectMention = true;
    }

    // Check 3: Reply to Bot
    if (quotedParticipant === botJid) {
        isReplyToBot = true;
    }

    if (!isDirectMention && !isReplyToBot) {
        return false; // Not talking to us
    }

    // 4. Clean Message (Remove Mentions)
    let cleanMessage = body
        .replace(new RegExp(`@${botNumber}`, 'g'), '')
        .replace(/@\d+/g, '') // Remove other numbers too just in case
        .replace(/@starry/gi, '')
        .trim();

    if (!cleanMessage && isReplyToBot) {
        // If just replying to a bot message without text, maybe use context?
        // For now, let's treat "empty reply" as a "continue" signal?

        // Or just ignore. Let's ignore empty for now unless it has media.
        return false;
    }

    // Fallback for "just a tag"
    if (!cleanMessage) cleanMessage = "Hello!";

    try {
        const persona = botState.settings.aiMentionPersona || 'default';
        const pushName = msg.pushName || "User";

        // Get History (from handler memory for this chat)
        if (!botState.memory[from]) botState.memory[from] = [];
        const history = botState.memory[from];

        // Generate AI response
        const response = await ai.generateContent(cleanMessage, persona, history, sock, from, pushName);

        // Update History
        history.push({ role: 'user', parts: [{ text: cleanMessage }] });
        history.push({ role: 'model', parts: [{ text: response }] });
        if (history.length > 10) history.splice(0, 2); // Rolling window

        await sock.sendMessage(from, { text: response }, { quoted: msg });
        utils.log("AI", `Mention response sent (${persona})`);
        return true;

    } catch (error) {
        utils.log("ERROR", `AI mention failed: ${error.message}`);
        return false;
    }
}

/* 
 * AI-Powered Dynamic Help
 * Uses AI to explain commands based on help documentation
 */
async function handleDynamicHelp(msg, sock, botState, query) {
    const from = msg.key.remoteJid;
    const getHelp = require('./help');
    const ai = require('./ai');

    // Build context intelligently
    // 1. AI INTENT CLASSIFICATION (Router)
    await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

    // Enhanced Router Prompt with Context Snippets and JSON Output
    const routerPrompt = `
    You are the Router AI for Starry MD WhatsApp Bot.
    Your job is to classify the User's Question into the ONE best category.
    
    ### CATEGORY DEFINITIONS (Context Snippets):
    - **ai**: Questions about the bot's personality (personas), using ChatGPT/Groq features, or generating AI images (.imagine, .draw).
    - **media**: Creating stickers (.sticker), stealing stickers, converting stickers to images/videos, or recovering view-once messages (.vv).
    - **audio**: Downloading music/video from YouTube (.play, .yts), voice note conversion (.tovn), or changing audio speed/pitch (.nightcore, .bass).
    - **group**: Admin commands like kicking, adding, promoting, warning users, or changing group settings (antilink, welcome).
    - **owner**: System-level commands like broadcasting, sleep mode, managing clones, or restarting.
    - **economy**: Financial commands: bank, wallet, transferring money, shop, inventory, working, or robbing/stealing.
    - **game**: Casino games (gambling, slots, connect4, chess), duels, or fighting.
    - **social**: User profiles, bios, leaderboards (ranks), marriage/ship, or buying titles.
    - **info**: General tools like wikipedia search, lyrics, weather, or google search.
    - **general**: The user is asking a general knowledge question (e.g., "Who consists the solar system?", "Recipe for cake") that is NOT about the bot's features.
    - **faq**: If the question is about the bot but doesn't fit the above, or you are unsure.

    ### USER QUESTION:
    "${query}"

    ### OUTPUT FORMAT (JSON ONLY):
    Strictly output raw JSON. No markdown.
    {
        "category": "category_name",
        "confidence": 0.95,
        "reasoning": "Brief reason why"
    }
    `;

    let category = 'faq';
    let reasoning = 'Fallback';

    try {
        // Fast routing (low latency)
        const categoryResponse = await ai.generateContent(routerPrompt, "tech", [], sock, from, "Router");
        const cleanJson = categoryResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const result = JSON.parse(cleanJson);
            category = result.category || 'faq';
            reasoning = result.reasoning || 'No reasoning';

            utils.log("DEBUG", `[Smart Router] Cat: ${category} | Conf: ${result.confidence} | Reason: ${reasoning}`);

            // Low confidence fallback?
            if (result.confidence < 0.5 && category !== 'general') {
                category = 'faq';
                reasoning = 'Low confidence';
            }
        } catch (jsonErr) {
            // Fallback to keyword matching if JSON fails
            utils.log("WARN", `[Smart Router] JSON Parse Failed: ${jsonErr.message}. Fallback to keyword scan.`);
            const lowerResponse = categoryResponse.toLowerCase();
            const validCategories = ['ai', 'media', 'audio', 'group', 'owner', 'economy', 'game', 'social', 'info', 'general', 'faq'];
            for (const cat of validCategories) {
                if (lowerResponse.includes(cat)) {
                    category = cat;
                    break;
                }
            }
        }

    } catch (e) {
        utils.log("ERROR", `Help Routing failed: ${e.message}`);
        category = 'faq';
    }

    // 2. HANDLE GENERAL QUESTIONS (Direct Answer)
    if (category === 'general') {
        utils.log("AI", `[Smart Router] Detected GENERAL question. Bypassing docs.`);
        try {
            const context = `You are Starry MD. The user asked a general question: "${query}".\nAnswer it helpfully and concisely (2-4 sentences).`;
            const response = await ai.generateContent(context, "tech", [], sock, from, msg.pushName || "User");
            await sock.sendMessage(from, { text: response }, { quoted: msg });
            return;
        } catch (e) {
            return sock.sendMessage(from, { text: "❌ I couldn't process that question right now." });
        }
    }

    // 3. LOAD RELEVANT KNOWLEDGE (For Bot Questions)
    // getHelp was already required at the top of the function

    // Safety check for category existence
    const validHelpCats = ['ai', 'media', 'audio', 'group', 'owner', 'economy', 'game', 'social', 'info', 'faq'];
    if (!validHelpCats.includes(category)) category = 'faq';

    const helpContent = getHelp(category);

    // 4. GENERATE DOCUMENTED ANSWER
    let context = "You are Starry Assistant. A helpful bot guide.\nRULES:\n1. Answer the user's question using the DOCS below.\n2. Be concise but detailed enough to be helpful.\n. Explain the EXACT command to use.\n3. If the answer isn't in the docs, suggest checking .menu\n";

    // Inject Knowledge about recent updates
    context += `\nKNOWLEDGE BASE UPDATE (Jan 2026):\n`;
    context += `- "Smart Search": .play automatically prioritizes "Official Audio" to skip music video intros.\n`;
    context += `- "Interactive Search": .yts returns a numbered list. Users can reply "1" (audio) or "1 video" (video).\n`;
    context += `- "Tag 18": We use MP4 (Tag 18) for reliable play/downloads to avoid 403 errors. It's a feature, not a bug.\n`;

    context += `\nSYSTEM CONTEXT: User asked about "${query}". Detected Topic: ${category.toUpperCase()}.\nReasoning: ${reasoning}\n`;
    context += `\n--- ${category.toUpperCase()} DOCUMENTATION ---\n${helpContent}\n`;
    context += `\n\nUser Question: ${query}`;

    try {
        const response = await ai.generateContent(context, "tech", [], sock, from, msg.pushName || "User");
        utils.log("DEBUG", `[Help Answer] Generated: "${response.slice(0, 50)}..."`);
        await sock.sendMessage(from, { text: `📚 *STARRY HELP* (${category.toUpperCase()})\n\n${response}` }, { quoted: msg });
        utils.log("AI", `Dynamic help response sent (Context: ${category})`);
    } catch (error) {
        utils.log("ERROR", `Dynamic help failed: ${error.message}`);
        await sock.sendMessage(from, { text: "❌ AI Help is temporarily unavailable. Use .menu or .help <category>" });
    }
}

module.exports = {
    handleAIToggle,
    handleMentionAI,
    handleDynamicHelp
};
