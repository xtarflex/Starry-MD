/**
 * Economy Activities Module
 * Handles .fish, .mine, .hunt
 */

const economy = require('./economy');
const economyTasks = require('./economy-tasks');
const utils = require('./utils');

/**
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

    // Requirement Check: Rod
    if (!user.inventory.rod || user.inventory.rod <= 0) {
        return sock.sendMessage(from, {
            text: "🎣 *FISHING FAILED*\n\nYou don't own a *Fishing Rod*! Buy one in the shop first.\n\n💡 Use `.shop` to see items."
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

    // Update Balance & Cooldown
    const db = await economy.loadDB();
    await economy.updateBalance(sender, result.value, 'wallet');
    await economy.setCooldown(sender, 'fish', db.config.fish_cooldown || 300000);
    await economyTasks.trackProgress(sender, 'fish');

    // Add XP
    const xpResult = await economy.addXP(sender, 25);

    // Update Stats
    user.stats.fish_caught = (user.stats.fish_caught || 0) + 1;
    user.stats.total_earned += result.value;
    await economy.saveDB();

    let responseMsg = `🎣 *FISHING EXPEDITION*\n\nYou cast your line into the deep blue...
    
*Splash!* ✨ You caught a *${result.item}*! ${result.emoji}
💎 *Quality:* ${result.quality}

💰 *Earned:* +$${result.value}
⭐ *XP:* +25`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/**
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

    // Requirement Check: Pickaxe
    if (!user.inventory.pickaxe || user.inventory.pickaxe <= 0) {
        return sock.sendMessage(from, {
            text: "⛏️ *MINING FAILED*\n\nYou don't own a *Pickaxe*! Buy one in the shop first.\n\n💡 Use `.shop` to see items."
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

    // Durability System
    user.durability.pickaxe = (user.durability.pickaxe || 0) - 1;
    let durabilityMsg = `🎒 *Pickaxe:* ${user.durability.pickaxe} uses remaining`;

    if (user.durability.pickaxe <= 0) {
        user.inventory.pickaxe = 0;
        durabilityMsg = "🚨 *SNAP!* Your pickaxe just broke. You'll need to buy a new one.";
    }

    // Update Balance & Cooldown
    const db = await economy.loadDB();
    await economy.updateBalance(sender, result.value, 'wallet');
    await economy.setCooldown(sender, 'mine', db.config.mine_cooldown || 600000);
    await economyTasks.trackProgress(sender, 'mine');

    // Add XP
    const xpResult = await economy.addXP(sender, 50);

    // Update Stats
    user.stats.gems_mined = (user.stats.gems_mined || 0) + 1;
    user.stats.total_earned += result.value;
    await economy.saveDB();

    let responseMsg = `⛏️ *MINING EXPEDITION*\n\nYou strike your pickaxe into the crystal cavern...
    
*Clang!* ✨ You found: *${result.item}* ${result.emoji}
💎 *Quality:* ${result.quality}

💰 *Earned:* +$${result.value}
⭐ *XP:* +50
${durabilityMsg}`;

    if (xpResult.leveled_up) {
        responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
    }

    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

/**
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

    // Requirement Check: Sword
    if (!user.inventory.sword || user.inventory.sword <= 0) {
        return sock.sendMessage(from, {
            text: "⚔️ *HUNTING FAILED*\n\nYou don't own a *Sword*! Buy one in the shop first.\n\n💡 Use `.shop` to see items."
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
            text: `⏰ *Hunting Cooldown*\n\nThe forest is quiet. Try again in *${timeLeft}*.`
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

    // Fight Outcome
    const success = Math.random() > 0.15; // 85% success rate with a sword

    let responseMsg;
    if (success) {
        user.health -= creature.damage;
        await economy.updateBalance(sender, creature.reward, 'wallet');
        const xpResult = await economy.addXP(sender, 100);

        user.stats.total_earned += creature.reward;

        responseMsg = `⚔️ *HUNTING TRIUMPH*\n\nYou encountered a wild *${creature.name}* ${creature.emoji}!
        
After a fierce battle, you slayed the creature!
💰 *Earning:* +$${creature.reward.toLocaleString()}
⭐ *XP:* +100
🩸 *Health:* -${creature.damage} HP (Remaining: ${user.health} HP)`;

        if (xpResult.leveled_up) {
            responseMsg += `\n\n🎉 *LEVEL UP!* You're now level ${xpResult.new_level}!`;
        }
    } else {
        user.health -= Math.floor(creature.damage * 1.5);
        responseMsg = `🚑 *HUNTING DEFEAT*\n\nA *${creature.name}* ${creature.emoji} attacked you!
        
You were badly injured and had to retreat.
💰 *Earning:* $0
🩸 *Health:* -${Math.floor(creature.damage * 1.5)} HP (Remaining: ${user.health < 0 ? 0 : user.health} HP)`;
    }

    // Ensure health doesn't go below 0
    if (user.health < 0) user.health = 0;

    // Set cooldown
    const db = await economy.loadDB();
    await economy.setCooldown(sender, 'hunt', db.config.hunt_cooldown || 900000);

    await economy.saveDB();
    await sock.sendMessage(from, { text: responseMsg }, { quoted: msg });
}

module.exports = {
    handleFish,
    handleMine,
    handleHunt
};
