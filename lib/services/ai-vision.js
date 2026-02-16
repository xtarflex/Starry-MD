const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const Groq = require("groq-sdk");
const config = require("../../config");
const utils = require("../core/utils");

/* 
 * 👁️ STARRY VISION (AI Image Analysis)
 * Powered by Llama-3.2-11b-vision-preview
 */

// Initialize Groq
const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

async function handleVision(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const pushName = msg.pushName || "User";

    // 1. Check for Image (Quoted or Attached)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    const messageToView = quoted || msg.message;

    const isImage = messageToView.imageMessage;

    if (!isImage) {
        return sock.sendMessage(from, { text: "❌ Please quote or attach an *Image* for me to see!\n\nUsage: `.vision What is this?`" }, { quoted: msg });
    }

    // 2. Initial Reaction
    await sock.sendMessage(from, { react: { text: "👁️", key: msg.key } });
    const { key } = await sock.sendMessage(from, { text: "👁️ *Analyzing Visual Data...*" }, { quoted: msg });

    try {
        // 3. Download Image
        const buffer = await downloadMediaMessage(
            { message: messageToView },
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );

        // 4. Encode to Base64 data URL
        const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // 5. User Query
        const userPrompt = Array.isArray(args) ? args.join(" ") : args;
        const promptText = userPrompt || "Describe this image in detail.";

        // 6. Call Groq Vision API (With Redundancy)
        // Updated for 2026: Llama 4 Scout/Maverick are the new standard
        const models = [
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "meta-llama/llama-4-maverick-17b-128e-instruct",
            "llama-3.2-90b-vision",
            "llama-3.2-11b-vision"
        ];

        let answer = null;
        let usedModel = "";

        for (const model of models) {
            try {
                const chatCompletion = await groq.chat.completions.create({
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                { "type": "text", "text": promptText },
                                {
                                    "type": "image_url",
                                    "image_url": { "url": base64Image }
                                }
                            ]
                        }
                    ],
                    "model": model,
                    "temperature": 1,
                    "max_tokens": 1024,
                    "top_p": 1,
                    "stream": false
                });

                answer = chatCompletion.choices[0]?.message?.content;
                if (answer) {
                    usedModel = model;
                    break; // Success!
                }
            } catch (innerErr) {
                utils.log("WARN", `Vision Model ${model} failed: ${innerErr.message}`);
                // Continue to next model
            }
        }

        if (!answer) throw new Error("All vision models are currently offline.");

        // 7. Send Response
        await sock.sendMessage(from, {
            text: `👁️ *STARRY VISION* (${usedModel.replace('llama-3.2-', '').replace('-vision-preview', '').toUpperCase()})\n\n${answer}`,
            edit: key
        });

        utils.log("AI", `Vision used by ${pushName} (${usedModel})`);

    } catch (error) {
        utils.log("ERROR", `Vision failed: ${error.message}`);

        let errorText = "❌ Visual system malfunction.";
        if (error.message.includes("413")) errorText = "❌ Image is too large for my eyes!";
        if (error.message.includes("offline")) errorText = "❌ All AI Vision satellites are currently offline. Try again later.";

        await sock.sendMessage(from, { text: errorText, edit: key });
    }
}

module.exports = { handleVision };
