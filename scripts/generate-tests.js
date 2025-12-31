const fs = require('fs-extra');

/**
 * Test Scenario Generator
 * -----------------------
 * Generates 100 mathematical edge cases for the Starry MD handler.
 */

const scenarios = [];
const types = ['conversation', 'extendedTextMessage', 'stickerMessage'];
const roles = ['OWNER', 'FRIEND', 'STRANGER'];
const prefixes = ['$', '.', 'None'];

for (let i = 1; i <= 100; i++) {
    const role = roles[Math.floor(Math.random() * roles.length)];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const isGroup = Math.random() > 0.7;

    let sender = "123456@s.whatsapp.net";
    if (role === 'OWNER') sender = "2348141680626@s.whatsapp.net";
    if (role === 'STRANGER') sender = `stranger_${i}@s.whatsapp.net`;

    scenarios.push({
        id: i,
        name: `Stress Test #${i} (${role} in ${isGroup ? 'Group' : 'DM'})`,
        sender: sender,
        isGroup: isGroup,
        body: (prefix === 'None' ? '' : prefix) + (prefix === '$' ? 'ping' : 'Hello World'),
        type: types[Math.floor(Math.random() * types.length)],
        expectCooldown: role !== 'OWNER' && i % 3 === 0, // Mocking rapid fire
        expectHandshake: role === 'STRANGER' && !isGroup
    });
}

fs.writeJsonSync('./database/tests.json', scenarios, { spaces: 4 });
console.log("✅ Generated 100 Test Scenarios in database/tests.json");
