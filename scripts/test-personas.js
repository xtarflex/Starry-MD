const config = require("../config");
const ai = require("../lib/ai");

/**
 * Test All AI Personas with Groq
 */

const personas = [
    { name: "default", cmd: ".ai", prompt: "tell me a fun fact" },
    { name: "rude", cmd: ".rude", prompt: "explain why the sky is blue" },
    { name: "tech", cmd: ".tech", prompt: "what is an API?" },
    { name: "uwu", cmd: ".uwu", prompt: "say something nice" },
    { name: "genz", cmd: ".genz", prompt: "what's the vibe today?" },
    { name: "mom", cmd: ".mom", prompt: "I'm feeling stressed" },
    { name: "pirate", cmd: ".pirate", prompt: "tell me about treasure" }
];

async function testPersona(persona) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎭 Testing: ${persona.name.toUpperCase()} Persona`);
    console.log(`Command: ${persona.cmd} ${persona.prompt}`);
    console.log(`${"=".repeat(60)}\n`);

    try {
        const response = await ai.generateContent(persona.prompt, persona.name);
        console.log(`✅ Response:\n${response}\n`);
        return true;
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

async function runAllTests() {
    console.log(`\n⚡ GROQ AI PERSONA TEST SUITE ⚡`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Model: llama-3.1-8b-instant`);
    console.log(`Total Personas: ${personas.length}`);
    console.log(`${"=".repeat(60)}`);

    let passed = 0;
    let failed = 0;

    for (const persona of personas) {
        const success = await testPersona(persona);
        if (success) {
            passed++;
        } else {
            failed++;
        }
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 TEST RESULTS`);
    console.log(`${"=".repeat(60)}`);
    console.log(`✅ Passed: ${passed}/${personas.length}`);
    console.log(`❌ Failed: ${failed}/${personas.length}`);
    console.log(`${"=".repeat(60)}\n`);

    if (passed === personas.length) {
        console.log(`🎉 ALL PERSONAS WORKING PERFECTLY! 🎉\n`);
    } else {
        console.log(`⚠️ Some personas failed. Check errors above.\n`);
    }
}

runAllTests();
