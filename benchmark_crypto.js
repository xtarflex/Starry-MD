const coins = {
    BTC: { price: 65000, change24h: 0.10 },
    ETH: { price: 3500, change24h: -0.15 },
    SOL: { price: 140, change24h: 0.20 },
    DOGE: { price: 0.15, change24h: -0.30 },
    XRP: { price: 0.60, change24h: 0.25 },
    ADA: { price: 0.45, change24h: -0.25 },
    DOT: { price: 7.00, change24h: 0.30 },
    LINK: { price: 15.00, change24h: -0.25 },
    BNB: { price: 600, change24h: 0.15 },
    STR: { price: 1.00, change24h: -0.50 }
};

function loopMethod() {
    let txt = `📈 *CRYPTO MARKET*\n\n`;
    for (const [sym, data] of Object.entries(coins)) {
        const icon = data.change24h >= 0 ? '🟢' : '🔴';
        txt += `${icon} *${sym}:* $${data.price.toLocaleString()} (${data.change24h}%)\n`;
    }
    txt += `\n_Usage: .convert buy <coin> <amount> | .convert sell <coin> <amount>_`;
    return txt;
}

function mapJoinMethod() {
    const marketText = Object.entries(coins).map(([sym, data]) => {
        const icon = data.change24h >= 0 ? '🟢' : '🔴';
        return `${icon} *${sym}:* $${data.price.toLocaleString()} (${data.change24h}%)`;
    }).join('\n');
    return `📈 *CRYPTO MARKET*\n\n${marketText}\n\n_Usage: .convert buy <coin> <amount> | .convert sell <coin> <amount>_`;
}

// Warmup
for (let i = 0; i < 10000; i++) {
    loopMethod();
    mapJoinMethod();
}

const iterations = 100000;

const startLoop = performance.now();
for (let i = 0; i < iterations; i++) {
    loopMethod();
}
const endLoop = performance.now();

const startMap = performance.now();
for (let i = 0; i < iterations; i++) {
    mapJoinMethod();
}
const endMap = performance.now();

console.log(`Original Loop Method (${iterations} ops): ${endLoop - startLoop} ms`);
console.log(`Map+Join Method (${iterations} ops): ${endMap - startMap} ms`);
