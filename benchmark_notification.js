
import { performance } from 'perf_hooks';

async function mockSendMessage(id, content) {
    // Simulate network latency
    return new Promise(resolve => setTimeout(resolve, 100));
}

async function sequential(owners, msg) {
    const start = performance.now();
    for (const ownerId of owners) {
        await mockSendMessage(ownerId, { text: msg });
    }
    const end = performance.now();
    return end - start;
}

async function concurrent(owners, msg) {
    const start = performance.now();
    await Promise.all(owners.map(ownerId => mockSendMessage(ownerId, { text: msg })));
    const end = performance.now();
    return end - start;
}

async function run() {
    const owners = ['owner1', 'owner2', 'owner3', 'owner4', 'owner5'];
    const msg = "test message";

    console.log(`Running with ${owners.length} owners and 100ms simulated latency...`);

    const seqTime = await sequential(owners, msg);
    console.log(`Sequential: ${seqTime.toFixed(2)}ms`);

    const conTime = await concurrent(owners, msg);
    console.log(`Concurrent: ${conTime.toFixed(2)}ms`);

    const improvement = ((seqTime - conTime) / seqTime * 100).toFixed(2);
    console.log(`Improvement: ${improvement}%`);
}

run();
