const Groq = require("groq-sdk");
const config = require("../config");
const utils = require("./utils");

// Initialize Groq client
const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

/* 
 * AI Logic for Starry MD - Powered by Groq
 * Smart model routing + WhatsApp-optimized responses
 */

// Available models with their strengths
const MODELS = {
    fast: "llama-3.1-8b-instant",      // Quick, simple queries
    smart: "llama-3.3-70b-versatile"   // Complex, detailed queries
};

/* 
 * Smart Model Router
 * Picks the best model based on query complexity
 */
function selectModel(prompt) {
    const lowerPrompt = prompt.toLowerCase();

    // Use smart model for complex queries
    const complexKeywords = [
        'explain', 'how does', 'why', 'what is', 'difference between',
        'compare', 'analyze', 'detailed', 'in depth', 'technical',
        'code', 'algorithm', 'calculate', 'solve', 'debug'
    ];

    const isComplex = complexKeywords.some(keyword => lowerPrompt.includes(keyword));
    const isLong = prompt.length > 100;

    // Use smart model for complex/long queries, fast model for simple/short
    return (isComplex || isLong) ? MODELS.smart : MODELS.fast;
}

module.exports = {
    /* 
     * Generate content using Groq AI with Smart Routing
     * @param {string} prompt - User's message
     * @param {string} personaType - AI persona (default, rude, tech, etc.)
     * @param {array} history - Chat history (optional)
     * @param {object} sock - Baileys socket (for typing simulation)
     * @param {string} jid - Chat JID (for typing simulation)
     */
    /* 
     * Generate content using Groq AI with Smart Routing
     * @param {string} prompt - User's message
     * @param {string} personaType - AI persona (default, rude, tech, etc.)
     * @param {array} history - Chat history (optional)
     * @param {object} sock - Baileys socket (for typing simulation)
     * @param {string} jid - Chat JID (for typing simulation)
     */
    generateContent: async (prompt, personaType = 'default', history = [], sock = null, jid = null, pushName = "User") => {
        try {
            // Check if API key exists
            if (!config.GROQ_API_KEY) {
                utils.log("ERROR", "GROQ_API_KEY is not set in .env file");
                return "❌ Error: AI API key is not configured. Please add your API key to your .env file.";
            }

            // 1. Load Persona (Config OR Custom)
            const fs = require('fs-extra');
            const path = require('path');
            const customPersonasPath = path.join(__dirname, '../database/custom_personas.json');

            // Ensure file exists (lazy load to avoid startup race conditions)
            if (!fs.existsSync(customPersonasPath)) {
                fs.writeJsonSync(customPersonasPath, {});
            }

            const customPersonas = fs.readJsonSync(customPersonasPath, { throws: false }) || {};

            // Priority: Config Personas -> Custom Personas -> Default
            let systemPrompt = config.PERSONAS[personaType] || customPersonas[personaType] || config.PERSONAS.default;

            // Inject length constraint and personalization
            // Inject personalization (Length is now handled by the persona itself)
            systemPrompt += `\n\nRespond directly to ${pushName}. Use their name if it fits naturally.`;

            // Smart model selection
            const selectedModel = selectModel(prompt);
            utils.log("AI", `Using model: ${selectedModel} for query length: ${prompt.length}`);

            // Build messages array with history
            const messages = [
                { role: "system", content: systemPrompt }
            ];

            // Add history if provided
            if (history && history.length > 0) {
                const convertedHistory = history.map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : msg.role,
                    content: msg.parts ? msg.parts[0].text : msg.content
                }));
                messages.push(...convertedHistory);
            }

            // Add current user message
            messages.push({ role: "user", content: prompt });

            // Simulate typing while AI generates response
            if (sock && jid) {
                // Start typing indicator
                utils.simulateTyping(sock, jid, 2000).catch(() => { });
            }

            // Call Groq API with HIGH temperature for human-like unpredictability
            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: selectedModel,
                temperature: 0.95, // High temp for mood swings, typos, human feel
                max_tokens: 300, // Reduced for shorter responses
                top_p: 1,
                stream: false
            });

            const response = chatCompletion.choices[0]?.message?.content || "No response generated.";

            // Add persona flair (minimal for human-like personas)
            const flairs = {
                yuki: "", // No flair - she wouldn't add one
                fizz: "", // Chaotic enough without flair
                jax: "", // Too cool for signatures
                ren: "", // Too tired to care
                bella: " ✨", // Just sparkles
                tech: "\n\n_Generated by Starry AI._",
                uwu: "\n\n_Hope that helped you, senpai! (≧◡≦) ♡_",
                mom: "\n\n_Take care of yourself, sweetie! 💕_",
                pirate: "\n\n_Fair winds and following seas, Matey! 🏴‍☠️_",
                default: "\n\n⚡ *Powered by Groq AI*"
            };

            utils.log("AI", `Generated response for persona: ${personaType} (${selectedModel})`);

            // Check if it's a known static persona for flair, otherwise use nothing or default?
            // Custom personas get no flair by default to stay clean, or maybe default?
            // Let's assume custom personas don't want forced flairs.
            const flair = (personaType in flairs) ? flairs[personaType] : (config.PERSONAS[personaType] ? flairs.default : "");

            const finalResponse = response + flair;

            // --- STICKER CHANCE (20%) ---
            if (sock && jid && personaType === 'default' && Math.random() < 0.2) {
                setTimeout(async () => {
                    try {
                        const stickerLab = require('./sticker-lab');
                        const stickerKeywords = ['heart', 'vibes', 'cat', 'dance', 'laugh', 'cool', 'surprised'];
                        const randomKeyword = stickerKeywords[Math.floor(Math.random() * stickerKeywords.length)];
                        await stickerLab.handleStickerSearch(null, sock, {}, randomKeyword, jid);
                    } catch (e) {
                        utils.log("DEBUG", "Sticker injection failed (silent)");
                    }
                }, 1000);
            }

            return finalResponse;
        } catch (error) {
            utils.log("ERROR", `Groq AI Error: ${error.message}`);

            // Provide specific error messages
            if (error.message.includes("API key") || error.message.includes("401")) {
                return "❌ Error: Invalid Groq API key. Please check your GROQ_API_KEY in .env file.\n\n💡 Get free API key from: https://console.groq.com";
            } else if (error.message.includes("rate") || error.message.includes("429")) {
                return "❌ Error: Rate limit reached. Please wait a moment and try again.\n\n💡 Groq free tier: 1,000 requests/day";
            } else if (error.message.includes("model")) {
                return "❌ Error: Model not available. Please check Groq documentation.";
            } else {
                return `❌ AI Error: ${error.message}\n\n💡 Check logs for details.`;
            }
        }
    },

    /*
     * List Custom Personas
     */
    getCustomPersonas: () => {
        const fs = require('fs-extra');
        const path = require('path');
        const customPersonasPath = path.join(__dirname, '../database/custom_personas.json');
        return fs.readJsonSync(customPersonasPath, { throws: false }) || {};
    }
};
