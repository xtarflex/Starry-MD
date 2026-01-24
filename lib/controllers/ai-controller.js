//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////const utils = require('../utils');
const aiLib = require('../ai');
const aiVision = require('../ai-vision');
const path = require('path');
const fs = require('fs-extra');

module.exports = {
    handleAI: async (msg, sock, botState, cmd, args, body, isMentioned, isOwner) => {
        const from = msg.key.remoteJid;
        const pushName = msg.pushName || "User";
        const currentPrefix = body.trim()[0]; // Estimate prefix from body

        // Dynamically load custom personas
        const customPersonas = aiLib.getCustomPersonas ? aiLib.getCustomPersonas() : {};
        const customPersonaKeys = Object.keys(customPersonas);

        // Base Personas + Custom Personas
        const aiPersonas = ['ai', 'rude', 'tech', 'uwu', 'genz', 'mom', 'pirate', 'yuki', 'fizz', 'jax', 'ren', 'bella', 'human', 'normal', ...customPersonaKeys];
        const shouldTriggerAI = aiPersonas.includes(cmd);

        if (shouldTriggerAI) {
            // Privacy Check for mentions
            if (isMentioned && !body.startsWith(currentPrefix)) { // If mention but no command prefix
                if (botState.mode === '$private' && !isOwner) return;
                if (botState.mode === '$sleep') return;
            }

            const type = Object.keys(msg.message)[0];
            const isImage = type === 'imageMessage';
            const quotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

            const persona = cmd !== 'ai' ? cmd : 'default';
            // If mentioned, prompt is the whole body minus the mention, else it's args
            const promptArr = isMentioned && !body.startsWith(currentPrefix) ? body.replace(/@\d+|@starry/gi, '').trim() : args;
            const prompt = Array.isArray(promptArr) ? promptArr.join(' ') : (promptArr || "");

            // --- VISION INTEGRATION ---
            if (isImage || quotedImage) {
                return aiVision.handleVision(msg, sock, botState, Array.isArray(promptArr) ? promptArr : [prompt]);
            }

            if (!prompt && !isMentioned) return sock.sendMessage(from, { text: `❌ Please provide a prompt. Example: \`.${cmd} Why is the sky blue?\`` }, { quoted: msg });
            if (!prompt && isMentioned) return; // Silent if just a tag with no text

            utils.log("AI", `[${persona.toUpperCase()}] Request from ${pushName}: "${prompt.slice(0, 30)}..."`);
            const { key } = await sock.sendMessage(from, { text: "☄️ Connecting to Starlink..." }, { quoted: msg });

            await utils.delay(1000);
            await sock.sendMessage(from, { text: "🧠 Thinking...", edit: key });

            // Context Memory Management
            if (!botState.memory[from]) botState.memory[from] = [];
            const history = botState.memory[from];

            const response = await aiLib.generateContent(prompt, persona, history);

            await sock.sendMessage(from, { text: response, edit: key });

            // Update History (Rolling 5 interactions)
            history.push({ role: 'user', parts: [{ text: prompt }] });
            history.push({ role: 'model', parts: [{ text: response }] });
            if (history.length > 10) history.splice(0, 2); // Keep last 5 pairs

            utils.log("AI", `Response sent to ${pushName}.`);
            return true;
        }

        // AI Image (Imagine)
        if (cmd === 'imagine' || cmd === 'draw') {
            let prompt = Array.isArray(args) ? args.join(' ') : args;
            if (!prompt) return sock.sendMessage(from, { text: `❌ Please provide a prompt. Example: \`.imagine A cyberpunk city\`` }, { quoted: msg });

            // Detect Model flag
            let model = 'flux'; // Default to newest
            if (prompt.includes('--flux')) { model = 'flux'; prompt = prompt.replace('--flux', ''); }
            if (prompt.includes('--sdxl')) { model = 'sdxl'; prompt = prompt.replace('--sdxl', ''); }
            if (prompt.includes('--turbo')) { model = 'turbo'; prompt = prompt.replace('--turbo', ''); }

            prompt = prompt.trim();

            utils.log("AI", `[IMAGE] Request from ${pushName}: "${prompt.slice(0, 30)}..." (Model: ${model})`);
            await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } });

            const { key } = await sock.sendMessage(from, { text: `🌌 *Generating Vision (${model.toUpperCase()})...*` }, { quoted: msg });

            try {
                const seed = Math.floor(Math.random() * 1000000);
                const safePrompt = encodeURIComponent(prompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&seed=${seed}&model=${model}&nologo=true&enhance=true`;

                await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: `🌠 *STARRY IMAGINE*\n\n*Prompt:* _${prompt}_\n*Model:* _Pollinations ${model.toUpperCase()}_\n*Seed:* _${seed}_`,
                }, { quoted: msg });

                await sock.sendMessage(from, { text: "✅ Vision Manifested.", edit: key });
                utils.log("AI", `Image sent to ${pushName}.`);
            } catch (error) {
                await sock.sendMessage(from, { text: "❌ Failed to generate image. Please try again.", edit: key });
                utils.log("ERROR", `Image generation failed: ${error.message}`);
            }
            return true;
        }

        // New Persona
        if (cmd === 'newpersona') {
            if (!isOwner) return sock.sendMessage(from, { text: "🚫 Access Denied" }, { quoted: msg });

            const input = args.join(' ');
            const parts = input.split('|');

            if (parts.length < 2) {
                return sock.sendMessage(from, { text: "❌ Usage: `.newpersona name | system prompt`" }, { quoted: msg });
            }

            const pName = parts[0].trim().toLowerCase();
            const pPrompt = parts.slice(1).join('|').trim();
            const customPersonasPath = path.join(__dirname, '../../database/custom_personas.json');

            try {
                if (!fs.existsSync(customPersonasPath)) fs.writeJsonSync(customPersonasPath, {});
                const currentPersonas = fs.readJsonSync(customPersonasPath);
                currentPersonas[pName] = pPrompt;
                fs.writeJsonSync(customPersonasPath, currentPersonas);
                await sock.sendMessage(from, { text: `✅ *Persona Created!*\n\n🤖 *Name:* ${pName}` }, { quoted: msg });
            } catch (e) {
                utils.log("ERROR", `Failed to save persona: ${e.message}`);
                await sock.sendMessage(from, { text: "❌ Error saving persona." }, { quoted: msg });
            }
            return true;
        }

        return false; // Not handled
    }
};
