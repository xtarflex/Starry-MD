/**
 * Monopoly Lite
 * Simplified version for WhatsApp Chat
 */

const BOARD = [
    { name: "GO", price: 0, rent: 0, type: 'go' },
    { name: "Old Kent Road", price: 60, rent: 2, type: 'prop', group: 'brown' },
    { name: "Comm. Chest", price: 0, rent: 0, type: 'chest' },
    { name: "Whitechapel", price: 60, rent: 4, type: 'prop', group: 'brown' },
    { name: "Income Tax", price: 0, rent: 200, type: 'tax' },
    { name: "Station 1", price: 200, rent: 25, type: 'rail' },
    { name: "Oriental Ave", price: 100, rent: 6, type: 'prop', group: 'blue' },
    { name: "Chance", price: 0, rent: 0, type: 'chance' },
    { name: "Vermont Ave", price: 100, rent: 6, type: 'prop', group: 'blue' },
    { name: "Connecticut", price: 120, rent: 8, type: 'prop', group: 'blue' },
    { name: "JAIL", price: 0, rent: 0, type: 'jail' }, // Index 10
    { name: "St. Charles", price: 140, rent: 10, type: 'prop', group: 'pink' },
    { name: "Electric Co", price: 150, rent: 0, type: 'util' },
    { name: "States Ave", price: 140, rent: 10, type: 'prop', group: 'pink' },
    { name: "Virginia Ave", price: 160, rent: 12, type: 'prop', group: 'pink' },
    { name: "Station 2", price: 200, rent: 25, type: 'rail' },
    { name: "St. James", price: 180, rent: 14, type: 'prop', group: 'orange' },
    { name: "Comm. Chest", price: 0, rent: 0, type: 'chest' },
    { name: "Tennessee", price: 180, rent: 14, type: 'prop', group: 'orange' },
    { name: "New York", price: 200, rent: 16, type: 'prop', group: 'orange' },
    { name: "PARKING", price: 0, rent: 0, type: 'parking' }, // Index 20
    { name: "Kentucky", price: 220, rent: 18, type: 'prop', group: 'red' },
    { name: "Chance", price: 0, rent: 0, type: 'chance' },
    { name: "Indiana", price: 220, rent: 18, type: 'prop', group: 'red' },
    { name: "Illinois", price: 240, rent: 20, type: 'prop', group: 'red' },
    { name: "Station 3", price: 200, rent: 25, type: 'rail' },
    { name: "Atlantic", price: 260, rent: 22, type: 'prop', group: 'yellow' },
    { name: "Ventnor", price: 260, rent: 22, type: 'prop', group: 'yellow' },
    { name: "Water Works", price: 150, rent: 0, type: 'util' },
    { name: "Marvin Gdns", price: 280, rent: 24, type: 'prop', group: 'yellow' },
    { name: "GO TO JAIL", price: 0, rent: 0, type: 'gotojail' }, // Index 30
    { name: "Pacific", price: 300, rent: 26, type: 'prop', group: 'green' },
    { name: "N. Carolina", price: 300, rent: 26, type: 'prop', group: 'green' },
    { name: "Comm. Chest", price: 0, rent: 0, type: 'chest' },
    { name: "Penn Ave", price: 320, rent: 28, type: 'prop', group: 'green' },
    { name: "Station 4", price: 200, rent: 25, type: 'rail' },
    { name: "Chance", price: 0, rent: 0, type: 'chance' },
    { name: "Park Place", price: 350, rent: 35, type: 'prop', group: 'darkblue' },
    { name: "Luxury Tax", price: 0, rent: 100, type: 'tax' },
    { name: "Boardwalk", price: 400, rent: 50, type: 'prop', group: 'darkblue' }
];

export default {
    createGame: (players) => {
        // Players array of JIDs. Max 4.
        const pState = players.map(jid => ({
            id: jid,
            pos: 0,
            money: 1500,
            props: [],
            injail: false,
            color: '👤'
        }));

        return {
            type: 'monopoly',
            players: pState,
            turnIndex: 0,
            properties: new Array(40).fill(null) // Stores owner JID or null
        };
    },

    rollDice: () => {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        return { total: d1 + d2, doubles: d1 === d2 };
    },

    /**
     * Process player turn
     */
    playTurn: (game, diceRoll) => {
        const p = game.players[game.turnIndex];

        // Handle Jail
        if (p.injail) {
            game.turnIndex = (game.turnIndex + 1) % game.players.length;
            p.injail = false; // Just skip one turn for simplicity in Lite version
            return { text: `🚔 You are in Jail! Turn skipped.` };
        }

        // Move
        p.pos = (p.pos + diceRoll.total) % 40;

        // Pass GO
        if (p.pos < diceRoll.total && p.pos > 0) { // Wrapped around
            p.money += 200;
        }

        const tile = BOARD[p.pos];
        let msg = `🎲 *Rolled:* ${diceRoll.total}\n📍 *Landed:* ${tile.name} (${tile.type.toUpperCase()})`;

        // Action Logic
        if (tile.type === 'prop' || tile.type === 'rail' || tile.type === 'util') {
            const owner = game.properties[p.pos];
            if (owner && owner !== p.id) {
                // PAY RENT
                const amount = tile.rent;
                p.money -= amount;
                const ownerP = game.players.find(x => x.id === owner);
                if (ownerP) ownerP.money += amount;
                msg += `\n💸 *Paid Rent:* $${amount} to Owner`;
            } else if (!owner) {
                // CAN BUY
                if (p.money >= tile.price) {
                    msg += `\n💰 *Price:* $${tile.price}\n👉 Type *.buyprop* to purchase!`;
                } else {
                    msg += `\n🔒 *Price:* $${tile.price} (Insufficient Funds)`;
                }
            }
        } else if (tile.type === 'tax') {
            p.money -= tile.rent;
            msg += `\n💸 *Paid Tax:* $${tile.rent}`;
        } else if (tile.type === 'gotojail') {
            p.pos = 10;
            p.injail = true;
            msg += `\n🚔 *ARRESTED!* Go directly to Jail.`;
        } else if (tile.type === 'chance' || tile.type === 'chest') {
            // Simple random effect
            const luck = Math.random();
            if (luck > 0.5) {
                p.money += 50;
                msg += `\n🍀 *LUCKY!* Found $50`;
            } else {
                p.money -= 50;
                msg += `\n📉 *OOPS!* Doctor's Fee: $50`;
            }
        }

        msg += `\n💵 *Balance:* $${p.money}`;

        // Next Turn
        if (!diceRoll.doubles) {
            game.turnIndex = (game.turnIndex + 1) % game.players.length;
            msg += `\n\n👉 *Next:* @${game.players[game.turnIndex].id.split('@')[0]}`;
        } else {
            msg += `\n\n🎲 *DOUBLES!* Roll again!`;
        }

        return { text: msg, next: game.players[game.turnIndex].id };
    },

    buyProperty: (game, playerJid) => {
        const pIndex = game.players.findIndex(x => x.id === playerJid);
        const p = game.players[pIndex];

        // Must be current turn player? Not necessarily for async buying but usually yes.
        // Assuming called immediately after landing.

        const tile = BOARD[p.pos];
        if (['prop', 'rail', 'util'].includes(tile.type)) {
            if (game.properties[p.pos]) return "❌ Already owned!";
            if (p.money < tile.price) return "❌ Insufficient Funds!";

            p.money -= tile.price;
            p.props.push(p.pos);
            game.properties[p.pos] = playerJid;
            return `✅ Purchased *${tile.name}* for $${tile.price}!`;
        }
        return "❌ Cannot buy this tile.";
    },

    renderBoard: (game) => {
        let text = `🎩 *MONOPOLY BOARD*\n`;

        game.players.forEach((p, i) => {
            const tile = BOARD[p.pos];
            const isTurn = i === game.turnIndex ? "👉" : "  ";
            // List owned property names
            const ownedNames = p.props.map(idx => BOARD[idx].name).join(', ');

            text += `\n${isTurn} 👤 *${p.id.split('@')[0]}* | 💵 $${p.money}`;
            text += `\n     📍 ${tile.name} (${tile.type.toUpperCase()})`;
            if (ownedNames) text += `\n     🏠 ${ownedNames}`;
            text += `\n`;
        });

        return text;
    }
};
