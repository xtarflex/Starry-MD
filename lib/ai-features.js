const fs = require('fs-extra');
const ai = require('./ai');
const utils = require('./utils');

/**
 * AI Mention Handler & Dynamic Help System
 */

/**
 * Handle AI Toggle Command
 */
async function handleAIToggle(msg, sock, botState, args) {
    const from = msg.key.remoteJid;

    if (!botState.settings) botState.settings = {};

    const subCmd = args.toLowerCase().trim();

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
    const validPersonas = ['yuki', 'fizz', 'jax', 'ren', 'bella', 'tech', 'uwu', 'mom', 'pirate', 'default'];
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

/**
 * Handle AI Mention Response
 */
async function handleMentionAI(msg, sock, botState, body) {
    const from = msg.key.remoteJid;

    // Check if AI mention mode is enabled
    if (!botState.settings.aiMentionMode) {
        return false; // Don't respond, let owner chat normally
    }

    // Get persona
    const persona = botState.settings.aiMentionPersona || 'default';

    // Remove mention from message
    const cleanMessage = body
        .replace(/@\d+/g, '')
        .replace(/@starry/gi, '')
        .trim();

    if (!cleanMessage) {
        return false; // Empty message after removing mention
    }

    try {
        // Generate AI response with typing simulation
        const response = await ai.generateContent(cleanMessage, persona, [], sock, from);

        await sock.sendMessage(from, {
            text: response
        }, { quoted: msg });

        utils.log("AI", `Mention response sent (${persona})`);
        return true;
    } catch (error) {
        utils.log("ERROR", `AI mention failed: ${error.message}`);
        return false;
    }
}

/**
 * AI-Powered Dynamic Help
 * Uses AI to explain commands based on help documentation
 */
async function handleDynamicHelp(msg, sock, botState, query) {
    const from = msg.key.remoteJid;
    const helpModule = require('./help');

    // Get all help content as context
    const fullHelp = helpModule('all');
    const aiHelp = helpModule('ai');
    const mediaHelp = helpModule('media');
    const audioHelp = helpModule('audio');
    const groupHelp = helpModule('group');
    const ownerHelp = helpModule('owner');
    const statusHelp = helpModule('status');

    // Build context for AI
    const context = `You are a helpful bot assistant explaining Starry MD bot commands.
    
Here is the complete help documentation:

${fullHelp}

${aiHelp}

${mediaHelp}

${audioHelp}

${statusHelp}

User's question: ${query}

Explain the answer in a friendly, concise way (2-3 sentences). Use the help documentation above as your source of truth. If the user asks about a command, explain what it does and give an example.`;

    try {
        // Use tech persona for help explanations
        await utils.smartTyping(sock, from, "Checking help docs...");

        const response = await ai.generateContent(context, 'tech', [], sock, from);

        await sock.sendMessage(from, {
            text: `📚 *STARRY HELP AI*\n\n${response}\n\n💡 For full docs: .help`
        }, { quoted: msg });

        utils.log("AI", `Dynamic help response sent`);
        return true;
    } catch (error) {
        utils.log("ERROR", `Dynamic help failed: ${error.message}`);
        // Fallback to regular help
        return false;
    }
}

module.exports = {
    handleAIToggle,
    handleMentionAI,
    handleDynamicHelp
};
