const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * AI Logic for Starry MD
 */
module.exports = {
    /**
     * Generate content using Gemini
     */
    generateContent: async (prompt, personaType = 'default') => {
        try {
            const systemPrompt = config.PERSONAS[personaType] || config.PERSONAS.default;
            const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;
            const result = await model.generateContent(fullPrompt);
            return result.response.text();
        } catch (error) {
            console.error("AI Generation Error:", error);
            return "❌ Error: I couldn't process that AI request right now.";
        }
    }
};
