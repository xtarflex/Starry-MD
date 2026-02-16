/* 
 * Economy Activities Module
 * Handles .fish, .mine, .hunt
 */

const economy = require('./economy');
const economyTasks = require('./economy-tasks');
const economyWorld = require('./economy-world');
const economyCards = require('./economy-cards');
const economyGame = require('./economy-game');
const utils = require('../core/utils');

/* 
 * Fish for rewards
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleFish(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);
    const locData = economyWorld.LOCATIONS[user.location] || economyWorld.LOCATIONS["Earth"];

    // Planet Activity Check
    if (!locData.activities.includes("fish")) {
        return sock.sendMessage(from, {
            text: `❌ *FISHING FAILED*\n\nThere are no water bodies on *${user.location}* to fish in!`
        }, { quoted: msg });
    }

    // Requirement Check: Rod
    if (!user.inventory.rod || user.inventory.rod <= 0) {
        return sock.sendMessage(from, {
            text: "🎣 *FISHING FAILED*\n\nYou don't own a *Fishing Rod*! Buy one in the shop first."
        }, { quoted: msg });
    }

    // Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'fish');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, {
            text: `⏰ *Fishing Cooldown*\n\nThe fish aren't biting right now. Try again in *${timeLeft}*.`
        }, { quoted: msg });
    }

    // RNG System
    const roll = Math.random() * 100;
    let result;

    if (roll < 5) result = { item: "🦈 Shark", value: 1500, emoji: "🦈", quality: "Legendary" };
    else if (roll < 25) result = { item: "🐟 Tuna", value: 600, emoji: "🐟", quality: "Rare" };
    else if (roll < 60) result = { item: "🐠 Fish", value: 300, emoji: "🐠", quality: "Common" };
    else result = { item: "🗑️ Old Boot", value: 10, emoji: "🗑️", quality: "Junk" };

    // Apply Planetary & Role Physics
    const locMultiplier = locData.multiplier || 1.0;
    const roleMultiplier = economyCards.getRoleMultiplier(user, 'work');
    const taxMultiplier = economyCards.getRoleMultiplier(user, 'tax');

    const grossEarned = Math.floor(result.value * locMultiplier * roleMultiplier);
    const taxAmount = Math.floor(grossEarned * (locData.tax || 0) * taxMultiplier);
    const netEarned = grossEarned - taxAmount;

    // Update Balance & Cooldown
    const config = await economy.getConfig();
    await economy.updateBalance(sender, netEarned, 'wallet');
    await economy.setCooldown(sender, 'fish', config.fish_cooldown || 300000);
    await economyTasks.trackProgress(sender, 'fish');

    // Add XP
    const xpResult = await economy.addXP(sender, Math.floor(25 * locMultiplier * roleMultiplier));

    // Update Stats
    user.stats.fish_caught = (user.stats.fish_caught || 0) + 1;
    user.financials.total_earned = (user.financials.total_earned || 0) + netEarned;
    await economy.saveDB();

    let responseMsg = `🎣 *FISHING EXPEDITION: ${user.location}*\n\nYou cast your line into the deep...
    
*Splash!* ✨ You caught a *${result.item}*! ${result.emoji}
💎 *Quality:* ${result.quality}

💰 *Earned:* +$${netEarned.toLocaleString()}`;

    if (taxAmount > 0) responseMsg += `\n💸 *Tax Paid:* $${taxAmount.toLocaleString()} (${((locData.tax || 0.0) * taxMultiplier * 100).toFixed(0)}%)`;
    responseMsg += `\n⭐ *XP:* +${Math.floor(25 * locMultiplier * roleMultiplier)}`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await utils.simulateTyping(sock, from, 2500);
    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/* 
 * Mine for gems and ores
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleMine(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";
    const user = await economy.getUserProfile(sender, pushName);
    const locData = economyWorld.LOCATIONS[user.location] || economyWorld.LOCATIONS["Earth"];

    // Planet Activity Check
    if (!locData.activities.includes("mine")) {
        return sock.sendMessage(from, {
            text: `❌ *MINING FAILED*\n\nYou cannot mine on *${user.location}*. The surface is not composed of ores.`
        }, { quoted: msg });
    }

    // Requirement Check: Pickaxe
    if (!user.inventory.pickaxe || user.inventory.pickaxe <= 0) {
        return sock.sendMessage(from, {
            text: "⛏️ *MINING FAILED*\n\nYou don't own a *Pickaxe*! Buy one in the shop first."
        }, { quoted: msg });
    }

    // Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'mine');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, {
            text: `⏰ *Mining Cooldown*\n\nYou're exhausted from digging. Rest for *${timeLeft}*.`
        }, { quoted: msg });
    }

    // RNG System
    const roll = Math.random() * 100;
    let result;

    if (roll < 1) result = { item: "💎 Diamond", value: 10000, emoji: "💎", quality: "LEGENDARY" };
    else if (roll < 10) result = { item: "🟡 Gold", value: 1000, emoji: "🟡", quality: "Epic" };
    else if (roll < 40) result = { item: "⚙️ Iron", value: 300, emoji: "⚙️", quality: "Common" };
    else result = { item: "🪨 Stone", value: 50, emoji: "🪨", quality: "Dirt" };

    // Apply Planetary & Role Physics
    const locMultiplier = locData.multiplier || 1.0;
    const roleMultiplier = economyCards.getRoleMultiplier(user, 'work');
    const taxMultiplier = economyCards.getRoleMultiplier(user, 'tax');

    const grossEarned = Math.floor(result.value * locMultiplier * roleMultiplier);
    const taxAmount = Math.floor(grossEarned * (locData.tax || 0) * taxMultiplier);
    const netEarned = grossEarned - taxAmount;

    // Durability System
    user.durability.pickaxe = (user.durability.pickaxe || 0) - 1;
    let durabilityMsg = `🎒 *Pickaxe:* ${user.durability.pickaxe} uses remaining`;

    if (user.durability.pickaxe <= 0) {
        user.inventory.pickaxe = 0;
        durabilityMsg = "🚨 *SNAP!* Your pickaxe just broke. You'll need to buy a new one.";
    }

    // Update Balance & Cooldown
    const config = await economy.getConfig();
    await economy.updateBalance(sender, netEarned, 'wallet');
    await economy.setCooldown(sender, 'mine', config.mine_cooldown || 600000);
    await economyTasks.trackProgress(sender, 'mine');

    // Add XP
    const xpResult = await economy.addXP(sender, Math.floor(50 * locMultiplier * roleMultiplier));

    // Update Stats
    user.stats.gems_mined = (user.stats.gems_mined || 0) + 1;
    user.financials.total_earned = (user.financials.total_earned || 0) + netEarned;
    await economy.saveDB();

    let responseMsg = `⛏️ *MINING EXPEDITION: ${user.location}*\n\nYou strike your pickaxe into the crystal crust...
    
*Clang!* ✨ You found: *${result.item}* ${result.emoji}
💎 *Quality:* ${result.quality}

💰 *Earned:* +$${netEarned.toLocaleString()}`;

    if (taxAmount > 0) responseMsg += `\n💸 *Tax Paid:* $${taxAmount.toLocaleString()} (${((locData.tax || 0.0) * taxMultiplier * 100).toFixed(0)}%)`;
    responseMsg += `\n⭐ *XP:* +${Math.floor(50 * locMultiplier * roleMultiplier)}\n${durabilityMsg}`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await utils.simulateTyping(sock, from, 2500);
    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/* 
 * Hunt for creatures
 * @param {object} msg - Message object
 * @param {object} sock - Socket connection
 * @param {object} botState - Bot state
 */
async function handleHunt(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);
    const locData = economyWorld.LOCATIONS[user.location] || economyWorld.LOCATIONS["Earth"];

    // Planet Activity Check
    if (!locData.activities.includes("hunt")) {
        return sock.sendMessage(from, {
            text: `❌ *HUNTING FAILED*\n\nThere is nothing to hunt on *${user.location}*.\n💡 Try traveling to * The Void* for high-risk hunting.`
        }, { quoted: msg });
    }

    // Requirement Check: Sword
    if (!user.inventory.sword || user.inventory.sword <= 0) {
        return sock.sendMessage(from, {
            text: "⚔️ *HUNTING FAILED*\n\nYou don't own a *Sword*! Buy one in the shop first."
        }, { quoted: msg });
    }

    // Health Check
    if (user.health <= 20) {
        return sock.sendMessage(from, {
            text: `🚑 *HUNTING FAILED*\n\nYou're too weak to hunt! Your health is only *${user.health} HP*.\n\n💡 Use a potion or wait for health to recover.`
        }, { quoted: msg });
    }

    // Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'hunt');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, {
            text: `⏰ *Hunting Cooldown*\n\nThe area is quiet. Try again in *${timeLeft}*.`
        }, { quoted: msg });
    }

    // Combat RNG
    const creatures = [
        { name: "🐉 Dragon", reward: 20000, damage: 80, emoji: "🐉", chance: 2 },
        { name: "🐻 Bear", reward: 5000, damage: 40, emoji: "🐻", chance: 10 },
        { name: "🐺 Wolf", reward: 2000, damage: 20, emoji: "🐺", chance: 30 },
        { name: "🦌 Deer", reward: 800, damage: 5, emoji: "🦌", chance: 58 }
    ];

    const roll = Math.random() * 100;
    let creature;
    let accumulatedChance = 0;

    for (const c of creatures) {
        accumulatedChance += c.chance;
        if (roll <= accumulatedChance) {
            creature = c;
            break;
        }
    }

    // Apply Planetary & Role Physics
    const locMultiplier = locData.multiplier || 1.0;
    const roleMultiplier = economyCards.getRoleMultiplier(user, 'work'); // Using work buff for hunting rewards too
    const taxMultiplier = economyCards.getRoleMultiplier(user, 'tax');

    // Fight Outcome
    const success = Math.random() > 0.15; // 85% success rate with a sword

    let responseMsg;
    if (success) {
        const grossReward = Math.floor(creature.reward * locMultiplier * roleMultiplier);
        const taxAmount = Math.floor(grossReward * (locData.tax || 0) * taxMultiplier);
        const netReward = grossReward - taxAmount;

        user.health -= creature.damage;
        await economy.updateBalance(sender, netReward, 'wallet');
        const xpResult = await economy.addXP(sender, Math.floor(100 * locMultiplier * roleMultiplier));

        user.stats.total_earned += netReward;

        responseMsg = `⚔️ *HUNTING TRIUMPH: ${user.location}*\n\nYou encountered a wild *${creature.name}* ${creature.emoji}!
        
After a fierce battle, you slayed the creature!
💰 *Reward:* +$${netReward.toLocaleString()}`;

        if (taxAmount > 0) responseMsg += `\n💸 *Tax Paid:* $${taxAmount.toLocaleString()} (${((locData.tax || 0.0) * taxMultiplier * 100).toFixed(0)}%)`;
        responseMsg += `\n⭐ *XP:* +${Math.floor(100 * locMultiplier * roleMultiplier)}\n🩸 *Health:* -${creature.damage} HP (Remaining: ${user.health} HP)`;

        if (xpResult.leveled_up) {
            responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
        }
    } else {
        const woundDamage = Math.floor(creature.damage * 1.5);
        user.health -= woundDamage;
        responseMsg = `🚑 *HUNTING DEFEAT: ${user.location}*\n\nA *${creature.name}* ${creature.emoji} attacked you!
        
You were badly injured and had to retreat.
💰 *Reward:* $0
🩸 *Health:* -${woundDamage} HP (Remaining: ${user.health < 0 ? 0 : user.health} HP)`;
    }

    // Ensure health doesn't go below 0
    if (user.health < 0) user.health = 0;

    // Set cooldown
    const config = await economy.getConfig();
    await economy.setCooldown(sender, 'hunt', config.hunt_cooldown || 900000);

    await economy.saveDB();
    await utils.simulateTyping(sock, from, 2500);
    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/* 
 * Rob another user (.rob)
 */
/* 
 * Rob another user (.rob)
 */
async function handleRob(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    // Parse target
    const args = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").split(' ').slice(1);
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = mentioned[0];

    // Check for "house" alias
    if (args[0]?.toLowerCase() === 'house' || args[0]?.toLowerCase() === '@house') {
        targetJid = 'house_treasury';
    }

    if (!targetJid) return sock.sendMessage(from, { text: "❌ *Usage:* .rob @user (or .rob house)" }, { quoted: msg });
    if (targetJid === sender) return sock.sendMessage(from, { text: "🤡 You tried to rob yourself. You lost $50 to your own confusion." }, { quoted: msg });

    const user = await economy.getUserProfile(sender, pushName);
    const locData = economyWorld.LOCATIONS[user.location] || economyWorld.LOCATIONS["Earth"];

    // 1. HOUSE ROBBERY LOGIC
    if (targetJid === 'house_treasury') {
        // Validation
        const hasLicense = (user.inventory.license_thief || 0) > 0;
        const cooldownCheck = await economy.checkCooldown(sender, 'rob');
        if (cooldownCheck.onCooldown) {
            const timeLeft = economy.formatTime(cooldownCheck.remaining);
            return sock.sendMessage(from, { text: `⏰ *Cool Down, Bandit!*\n\nThe Central Bank security is high. Wait *${timeLeft}*.` }, { quoted: msg });
        }

        // Odds: 1% without license, 25% with license
        const successRate = hasLicense ? 0.25 : 0.01;

        // Purge Boost
        if (economyGame.isPurgeActive()) successRate = hasLicense ? 0.50 : 0.10;

        const success = Math.random() < successRate;

        if (success) {
            // Success!
            const houseBal = await economy.getHouseBalance();
            const stealAmount = Math.floor(houseBal * (0.05 + Math.random() * 0.05)); // Steal 5-10% of Bank

            // Limit steal per heist to evita bankrupting house instantly
            const cap = 500000;
            const finalSteal = Math.min(stealAmount, cap);

            // Transfer
            await economy.updateHouseBalance(-finalSteal);
            user.financials.wallet += finalSteal;

            await economy.setCooldown(sender, 'rob', 14400000); // 4 hours cooldown for house rob
            await economy.saveDB();

            await utils.simulateTyping(sock, from, 3000);
            return sock.sendMessage(from, {
                text: `💰 *THE GRAND HEIST SUCCESSFUL!* 🏛️\n\nYou breached the Central Bank!\n\n💸 *Stolen:* $${finalSteal.toLocaleString()}\n📍 *Location:* ${user.location}\n\n_The police are scrambling!_`
            }, { quoted: msg });

        } else {
            // Fail
            const fine = hasLicense ? 50000 : 10000; // Higher fine if "Pro"
            user.financials.wallet -= fine;
            if (user.financials.wallet < 0) user.financials.wallet = 0;

            // Distribute Fine
            const copsPaid = await economy.distributeFine(fine);

            await economy.setCooldown(sender, 'rob', 7200000); // 2 hours
            await economy.saveDB();

            await utils.simulateTyping(sock, from, 2000);
            return sock.sendMessage(from, {
                text: `🚨 *HEIST FAILED!* 🚨\n\nSecurity systems activated and you were caught!\n\n💸 *Fine:* $${fine.toLocaleString()}\n👮 *Police Paid:* ${copsPaid} officers received a cut.\n\n_Better luck next time._`
            }, { quoted: msg });
        }
    }

    // 2. PLAYER ROBBERY LOGIC
    const target = await economy.getUserProfile(targetJid);
    if (!target) return sock.sendMessage(from, { text: "❌ Target is not indexed in the Multiverse." }, { quoted: msg });

    // Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'rob');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, { text: `⏰ *Cool Down, Bandit!*\n\nYou're being watched. Wait *${timeLeft}*.` }, { quoted: msg });
    }

    if (target.financials.wallet < 200) return sock.sendMessage(from, { text: "⚠️ This person is broke. No honor in robbing them." }, { quoted: msg });

    // Multipliers
    let attackerSuccessMult = economyCards.getRoleMultiplier(user, 'rob_success');
    let victimDefenseMult = economyCards.getRoleMultiplier(target, 'rob_defense');

    // Thief License Boost
    if ((user.inventory.license_thief || 0) > 0) attackerSuccessMult += 0.2;

    // Check Purge Status
    if (economyGame.isPurgeActive()) {
        attackerSuccessMult = 1.5; // Massive boost
        victimDefenseMult = 1.0;   // Defense nullified
    }

    // Base calculation: 40% base success
    const baseProb = 0.40;
    const finalProb = Math.min(0.85, baseProb * attackerSuccessMult / victimDefenseMult);

    const success = Math.random() < finalProb;

    if (success) {
        const stealAmount = Math.floor(target.financials.wallet * (0.2 + Math.random() * 0.3));

        target.financials.wallet -= stealAmount;
        user.financials.wallet += stealAmount;

        const cooldownTime = economyGame.isPurgeActive() ? 0 : 3600000; // No cooldown during Purge
        await economy.setCooldown(sender, 'rob', cooldownTime);
        await economy.saveDB();

        let successMsg = `💰 *HEIST SUCCESSFUL*\n\nYou robbed @${targetJid.split('@')[0]} and made off with * $${stealAmount.toLocaleString()}* !\n\n📍 *Crime Scene:* ${user.location}`;
        if (economyGame.isPurgeActive()) successMsg += `\n🚨 *PURGE ACTIVE:* Defense Nullified!`;

        await utils.simulateTyping(sock, from, 2500);
        await sock.sendMessage(from, {
            text: successMsg,
            mentions: [targetJid]
        }, { quoted: msg });
    } else {
        // Fine: 5% of Wallet (Min $2500, Max $50k)
        const percentFine = Math.floor(user.financials.wallet * 0.05);
        const fine = Math.max(2500, Math.min(percentFine, 50000));

        user.financials.wallet -= fine;
        if (user.financials.wallet < 0) user.financials.wallet = 0;

        // Distribute Fine
        const copsPaid = await economy.distributeFine(fine);

        await economy.setCooldown(sender, 'rob', 3600000); // 1 hour penalty (reduced from 2h)
        await economy.saveDB();

        await utils.simulateTyping(sock, from, 2000);
        await sock.sendMessage(from, {
            text: `🚔 *BUSTED!*\n\nYou tried to rob @${targetJid.split('@')[0]} but they fought back!\n\n💸 *Penalty:* $${fine.toLocaleString()}\n👮 *Police Paid:* ${copsPaid} officers received a cut.`,
            mentions: [targetJid]
        }, { quoted: msg });
    }
}

module.exports = {
    handleFish,
    handleMine,
    handleHunt,
    handleRob,
    handleDroneRob
};

/* 
 * Drone Robbery (.drone)
 * Safe remote robbery. Expensive.
 */
async function handleDroneRob(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const user = await economy.getUserProfile(sender, pushName);

    // 1. Requirement: Drone
    if (!user.inventory.drone || user.inventory.drone <= 0) {
        return sock.sendMessage(from, { text: "❌ *ACCESS DENIED*\n\nYou need a *Spy Drone* ($50,000) to rob remotely!" }, { quoted: msg });
    }

    // 2. Cost: $2,000 Battery/Data
    const cost = 2000;
    if (user.financials.wallet < cost) {
        return sock.sendMessage(from, { text: `🔋 *LOW BATTERY*\n\nYou need *$${cost}* to operate the drone.` }, { quoted: msg });
    }

    // 3. Target
    const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = mentioned[0];
    if (!targetJid) return sock.sendMessage(from, { text: "❌ Usage: .drone @user" }, { quoted: msg });

    const target = await economy.getUserProfile(targetJid);
    if (target.financials.wallet < 1000) return sock.sendMessage(from, { text: "⚠️ Signal lost. Target is too broke." }, { quoted: msg });

    // 4. Cooldown (30 mins - faster than normal rob)
    const cooldownCheck = await economy.checkCooldown(sender, 'drone_rob');
    if (cooldownCheck.onCooldown) {
        return sock.sendMessage(from, { text: `⏰ *Recharging*\n\nDrone is charging. Wait *${economy.formatTime(cooldownCheck.remaining)}*.` }, { quoted: msg });
    }

    // Deduct Cost
    user.financials.wallet -= cost;

    // 5. Mechanics
    // Success: 40% (Weak claw)
    // Fail: 60% (Drone spotted)
    // Critical Fail: 10% (Drone shot down)

    const roll = Math.random();

    if (roll < 0.40) {
        // SUCCESS
        const stealAmount = Math.floor(target.financials.wallet * (0.1 + Math.random() * 0.1)); // 10-20%
        target.financials.wallet -= stealAmount;
        user.financials.wallet += stealAmount;

        await economy.updateBalance(sender, stealAmount, 'wallet');
        await economy.setCooldown(sender, 'drone_rob', 1800000); // 30 mins
        await economy.saveDB();

        await utils.simulateTyping(sock, from, 2000);
        return sock.sendMessage(from, {
            text: `🛸 *DRONE HEIST SUCCESSFUL* 📦\n\nYour drone snatched *$${stealAmount.toLocaleString()}* from @${targetJid.split('@')[0]} while you laid on the couch!\n\n_Easy money._`,
            mentions: [targetJid]
        }, { quoted: msg });

    } else {
        // FAIL
        let failMsg = `⚠️ *MISSION FAILED*\n\nTarget spotted the drone and swatted it away. You lost the *$${cost}* operating cost.`;

        // Critical Fail: Drone Destruction (10% chance on fail, so 6% total)
        if (Math.random() < 0.10) {
            user.inventory.drone -= 1;
            failMsg += `\n\n💥 *FATAL ERROR:* The drone was SHOT DOWN! You need to buy a new one.`;
        }

        await economy.setCooldown(sender, 'drone_rob', 900000); // 15 mins
        await economy.saveDB();

        await utils.simulateTyping(sock, from, 2000);
        return sock.sendMessage(from, { text: failMsg }, { quoted: msg });
    }
}
