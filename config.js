require('dotenv').config();

/**
 * Starry MD Configuration
 */
module.exports = {
    // Owner Details
    OWNER_ID: process.env.OWNER_ID || "2348141680626", // Your WhatsApp ID without +
    OWNER_NAME: "Starry",

    // Command Prefixes
    PREFIX_TOOL: ".",   // For utilities like .sticker, .ai
    PREFIX_SYSTEM: "$", // For bot modes like $public, $sleep

    // API Keys
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOON_PASSWORD: process.env.GOON_PASSWORD || "starry123",

    // Human Emulation Settings
    COOLDOWN_MS: 5000, // 5 seconds between commands
    GHOST_BUFFER_MS: 600000, // 10 minute buffer for anti-delete

    // AI Personas
    PERSONAS: {
        default: "You are Starry MD, a helpful and efficient WhatsApp assistant. Keep replies concise and professional.",
        rude: "You are a witty, sarcastic AI. You're easily annoyed but still helpful in a mocking way. Use dry humor.",
        tech: "You are a highly technical AI expert. Use precise terminology and provide deep technical insights.",
        uwu: "You are an adorable, overly sweet anime girl AI. Use emotes like (｡♥‿♥｡), (◕‿◕✿), and end sentences with '~uwu' or '~nya'."
    },

    // Emotion Engine (Auto-React Keywords)
    REACTIONS: {
        '😂': ['lol', 'lmao', 'dead', 'fun', 'crise', 'haha'],
        '🥺': ['sad', 'hurt', 'pain', 'sorry', 'cry', 'pity'],
        '😡': ['stupid', 'fool', 'angry', 'trash', 'idiot', 'shut up'],
        '🔥': ['hard', 'dope', 'cool', 'fire', 'lit', 'wow']
    }
};
