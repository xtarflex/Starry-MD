import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock economy module
const economy = {
    async updateBalance(winner, amount, target) {
        // Simulate some I/O delay typical of a DB operation
        return new Promise(resolve => setTimeout(resolve, 5));
    }
};

async function runBenchmark() {
    const winnerCount = 100;
    const winners = Array.from({ length: winnerCount }, (_, i) => `user${i}@s.whatsapp.net`);
    const amount = 1000;

    console.log(`Benchmarking with ${winnerCount} winners...`);

    // --- Sequential ---
    const seqStart = performance.now();
    let winnerTextSeq = "";
    for (const winner of winners) {
        await economy.updateBalance(winner, amount, 'wallet');
        winnerTextSeq += `🎉 @${winner.split('@')[0]}\n`;
    }
    const seqEnd = performance.now();
    const seqTime = seqEnd - seqStart;
    console.log(`Sequential time: ${seqTime.toFixed(2)} ms`);

    // --- Concurrent ---
    const concStart = performance.now();
    await Promise.all(winners.map(winner => economy.updateBalance(winner, amount, 'wallet')));
    let winnerTextConc = winners.map(winner => `🎉 @${winner.split('@')[0]}\n`).join('');
    const concEnd = performance.now();
    const concTime = concEnd - concStart;
    console.log(`Concurrent time: ${concTime.toFixed(2)} ms`);

    console.log(`Speedup: ${(seqTime / concTime).toFixed(2)}x`);

    if (winnerTextSeq !== winnerTextConc) {
        console.error("Mismatch in generated text!");
    }
}

runBenchmark().catch(console.error);
