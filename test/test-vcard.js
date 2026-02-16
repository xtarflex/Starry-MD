const vcard = require('../lib/vcard');

const testCases = [
    { name: "Standard", jid: "1234567890@s.whatsapp.net", expected: "1234567890" },
    { name: "Hosted Device", jid: "1234567890:1@s.whatsapp.net", expected: "1234567890" },
    { name: "LID", jid: "1234567890@lid", expected: "1234567890" },
    { name: "Complex", jid: "1234567890:55@s.whatsapp.net", expected: "1234567890" }
];

console.log("--- VCARD TEST RUN ---");

testCases.forEach(test => {
    const card = vcard.create("Test User", test.jid);
    const match = card.match(/waid=(\d+)/);
    const result = match ? match[1] : "FAIL";

    const pass = result === test.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${test.name}: Input=${test.jid} -> Extracted=${result}`);
    if (!pass) console.log(`Expected: ${test.expected}, Got: ${result}`);
});

console.log("\n--- OWNER VCARD TEST ---");
const ownerCard = vcard.getOwnerVCard("Owner", "1234567890:1@s.whatsapp.net, 9876543210@s.whatsapp.net");
console.log(ownerCard);
