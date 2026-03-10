import { performance } from 'perf_hooks';

const mockCoins = {
    BTC: { price: 65000, change24h: 5.5 },
    ETH: { price: 3500, change24h: -2.1 },
    SOL: { price: 140, change24h: 12.0 },
    DOGE: { price: 0.15, change24h: -1.5 },
    XRP: { price: 0.60, change24h: 0.5 },
    ADA: { price: 0.45, change24h: -5.0 },
    DOT: { price: 7.00, change24h: 3.2 },
    LINK: { price: 15.00, change24h: 1.1 },
    BNB: { price: 600, change24h: 0.0 },
    STR: { price: 1.00, change24h: 50.0 }
};

const ITERATIONS = 100000;

function oldWay(coins) {
    let txt = `📈 *CRYPTO MARKET*\n\n`;
    for (const [sym, data] of Object.entries(coins)) {
        const icon = data.change24h >= 0 ? '🟢' : '🔴';
        txt += `${icon} *${sym}:* $${data.price.toLocaleString()} (${data.change24h}%)\n`;
    }
    return txt;
}

function mapWay(coins) {
    return `📈 *CRYPTO MARKET*\n\n` +
           Object.entries(coins).map(([sym, data]) => {
               const icon = data.change24h >= 0 ? '🟢' : '🔴';
               return `${icon} *${sym}:* $${data.price.toLocaleString()} (${data.change24h}%)`;
           }).join('\n') + '\n';
}

function forInWay(coins) {
    let txt = `📈 *CRYPTO MARKET*\n\n`;
    for (const sym in coins) {
        const data = coins[sym];
        const icon = data.change24h >= 0 ? '🟢' : '🔴';
        txt += `${icon} *${sym}:* $${data.price.toLocaleString()} (${data.change24h}%)\n`;
    }
    return txt;
}

// Ensure methods produce the exact same output
const outOld = oldWay(mockCoins);
const outMap = mapWay(mockCoins);
const outForIn = forInWay(mockCoins);

if (outOld !== outMap || outOld !== outForIn) {
    console.error("Outputs do not match!");
    process.exit(1);
}

function bench(name, fn) {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        fn(mockCoins);
    }
    const end = performance.now();
    return end - start;
}

// Warmup
for (let i = 0; i < 1000; i++) {
    oldWay(mockCoins);
    mapWay(mockCoins);
    forInWay(mockCoins);
}

const tOld = bench('oldWay', oldWay);
const tMap = bench('mapWay', mapWay);
const tForIn = bench('forInWay', forInWay);

console.log(`Iterations: ${ITERATIONS}`);
console.log(`Old (Object.entries for...of):  ${tOld.toFixed(2)} ms`);
console.log(`Map (.map.join):                ${tMap.toFixed(2)} ms`);
console.log(`ForIn (for...in):               ${tForIn.toFixed(2)} ms`);
