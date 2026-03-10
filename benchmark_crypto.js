import crypto from './lib/systems/economy-crypto.js';
import economy from './lib/systems/economy.js';

// Mock economy methods to simulate DB latency
const dbDelay = 50; // 50ms simulated DB latency

economy.getBalance = async () => {
    return new Promise(resolve => setTimeout(() => resolve(100000), dbDelay));
};
economy.updateBalance = async () => {
    return new Promise(resolve => setTimeout(resolve, dbDelay));
};
economy.updateInventory = async () => {
    return new Promise(resolve => setTimeout(resolve, dbDelay));
};
economy.getSystemData = async () => {
    return new Promise(resolve => setTimeout(() => resolve({}), dbDelay));
};
economy.saveDB = async () => {
    return new Promise(resolve => setTimeout(resolve, dbDelay));
};

const mockSock = {
    sendMessage: () => {}
};

const mockMsg = {
    key: { remoteJid: 'test', participant: 'test@s.whatsapp.net' }
};

async function runBenchmark() {
    console.log('Starting benchmark...');

    // Warmup
    await crypto.handleConvert(mockMsg, mockSock, {}, ['buy', 'BTC', '1']);

    // Benchmark Buy
    let startBuy = performance.now();
    for (let i = 0; i < 10; i++) {
        await crypto.handleConvert(mockMsg, mockSock, {}, ['buy', 'BTC', '1']);
    }
    let endBuy = performance.now();
    console.log(`Average Buy Time: ${((endBuy - startBuy) / 10).toFixed(2)} ms`);

    // Setup inventory mock for Sell
    economy.getInventory = async () => {
        return new Promise(resolve => setTimeout(() => resolve({ BTC: 10 }), dbDelay));
    };

    // Warmup Sell
    await crypto.handleConvert(mockMsg, mockSock, {}, ['sell', 'BTC', '1']);

    // Benchmark Sell
    let startSell = performance.now();
    for (let i = 0; i < 10; i++) {
        await crypto.handleConvert(mockMsg, mockSock, {}, ['sell', 'BTC', '1']);
    }
    let endSell = performance.now();
    console.log(`Average Sell Time: ${((endSell - startSell) / 10).toFixed(2)} ms`);
}

runBenchmark().catch(console.error);
