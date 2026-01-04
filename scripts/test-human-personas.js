const config = require("../config");
const ai = require("../lib/ai");

/**
 * Test Human-Like Personas
 */

const personas = [
    { name: "yuki", prompt: "can you help me with something?" },
    { name: "fizz", prompt: "explain quantum physics" },
    { name: "jax", prompt: "how do I get better at gaming?" },
    { name: "ren", prompt: "are you okay? you seem tired" },
    { name: "bella", prompt: "what do you think about my new idea?" }
];

async function testPersona(persona) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎭 Testing: ${persona.name.toUpperCase()}`);
    console.log(`User: "${persona.prompt}"`);
    console.log(`${"=".repeat(60)}\n`);

    try {
        const response = await ai.generateContent(persona.prompt, persona.name);
        console.log(`${persona.name}: ${response}\n`);
        return true;
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

async function runAllTests() {
    console.log(`\n⚡ HUMAN-LIKE PERSONA TEST ⚡`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Temperature: 0.95 (High - for unpredictability)`);
    console.log(`Total Personas: ${personas.length}`);
    console.log(`${"=".repeat(60)}`);

    for (const persona of personas) {
        await testPersona(persona);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ All personas tested!`);
    console.log(`\nThese should feel like REAL people, not helpful AI.`);
    console.log(`If they're too polite, the temperature needs to be higher.`);
    console.log(`${"=".repeat(60)}\n`);
}

runAllTests();
