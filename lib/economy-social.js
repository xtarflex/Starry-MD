/* 
 * Economy Social Module
 * Handles .rob, .gift, .leaderboard, .profile
 */

const economy = require('./economy');
const economyTasks = require('./economy-tasks');
const utils = require('./utils');
const economyShop = require('./economy-shop'); // Import shop for item details
const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/economy.json');

/* 
 * Steal money from another user
 */
async function handleRob(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const pushName = msg.pushName || "User";

    const target = utils.parseTarget(msg, args);
    if (!target) {
        return sock.sendMessage(from, { text: "❌ Please mention or reply to the user you want to rob!\nExample: .rob @user" }, { quoted: msg });
    }

    if (target === sender) {
        return sock.sendMessage(from, { text: "🤡 You can't rob yourself!" }, { quoted: msg });
    }

    const attacker = await economy.getUserProfile(sender, pushName);
    const victim = await economy.getUserProfile(target);

    // Cooldown Check
    const cooldownCheck = await economy.checkCooldown(sender, 'rob');
    if (cooldownCheck.onCooldown) {
        const timeLeft = economy.formatTime(cooldownCheck.remaining);
        return sock.sendMessage(from, { text: `🚨 *ROBBERY FAILED*\n\nYou're still laying low after your last job. Try again in *${timeLeft}*.` }, { quoted: msg });
    }

    // Minimum target balance
    if (victim.financials.wallet < 100) {
        return sock.sendMessage(from, { text: `❌ This user is too poor! They need at least $100 in their wallet to be worth the risk.` }, { quoted: msg });
    }

    // Jail Check (Not implemented yet but planning)
    if (attacker.jail_until && Date.now() < attacker.jail_until) {
        const remaining = attacker.jail_until - Date.now();
        return sock.sendMessage(from, { text: `🔒 *INCARCERATED*\n\nYou're currently in jail! You'll be released in *${economy.formatTime(remaining)}*.` }, { quoted: msg });
    }

    // Risk System
    const hasShield = victim.inventory.shield > 0;
    const successRate = hasShield ? 0.2 : 0.45; // 45% success or 20% if victim has shield

    const roll = Math.random();

    if (roll < successRate) {
        // Success
        const stolenPercent = 0.1 + (Math.random() * 0.25); // 10% - 35%
        const stolen = Math.floor(victim.financials.wallet * stolenPercent);

        victim.financials.wallet -= stolen;
        attacker.financials.wallet += stolen;

        attacker.stats.successful_robs = (attacker.stats.successful_robs || 0) + 1;
        victim.stats.times_robbed = (victim.stats.times_robbed || 0) + 1;

        // Track Task Progress
        await economyTasks.trackProgress(sender, 'rob_success');

        // Reward with some XP
        await economy.addXP(sender, 20);

        await economy.setCooldown(sender, 'rob', 3600000); // 1 hour cooldown
        await economy.saveDB();

        const response = `🎭 *ROBBERY SUCCESSFUL*\n\nYou snuck into @${target.split('@')[0]}'s place and snatched:\n💰 *$${stolen.toLocaleString()}*\n✨ +20 XP\n\n📈 *Stat:* You've pulled off ${attacker.stats.successful_robs} successful jobs!`;

        await sock.sendMessage(from, { text: response, mentions: [target] }, { quoted: msg });

        // Notify Victim
        await sock.sendMessage(target, { text: `🚨 *SECURITY BREECH*\n\nYou were just robbed by @${sender.split('@')[0]} in a group!\n💸 Loss: *$${stolen.toLocaleString()}*\n\n💡 Tip: Buy a 🛡️ Passive Shield to lower robbery rates!`, mentions: [sender] });

    } else {
        // Failure - Jail or Fine
        // Tweak: Reduced fine based on user feedback (10% + 200 instead of 20% + 500)
        let fine = Math.floor(attacker.financials.wallet * 0.1) + 200;

        // Fix: Collect from bank if wallet is empty
        if (attacker.financials.wallet < fine) {
            const extraNeeded = fine - attacker.financials.wallet;
            attacker.financials.wallet = 0;
            if (attacker.financials.bank >= extraNeeded) {
                attacker.financials.bank -= extraNeeded;
            } else {
                attacker.financials.bank = 0; // Bankrupt
            }
        } else {
            attacker.financials.wallet -= fine;
        }

        // 30% chance of jail on failure
        const getJailed = Math.random() < 0.3;
        let penaltyMsg = `💸 *Fine:* -$${fine.toLocaleString()} (Taken from Wallet/Bank)`;

        if (getJailed) {
            attacker.jail_until = Date.now() + 1800000; // 30 min jail
            penaltyMsg += `\n🔒 *Jailed:* 30 minutes`;
        }

        await economy.setCooldown(sender, 'rob', 1800000); // 30 min cooldown on fail
        await economy.saveDB();

        const response = `👮 *CAUGHT IN THE ACT!*\n\nYou tried to rob @${target.split('@')[0]} but the police were waiting!\n\n${penaltyMsg}`;
        await sock.sendMessage(from, { text: response, mentions: [target] }, { quoted: msg });
    }
}

/* 
 * Gift money to another user
 */
async function handleGift(msg, sock, botState, args) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);
    const pushName = msg.pushName || "User";

    const target = utils.parseTarget(msg, args);
    if (!target) {
        return sock.sendMessage(from, { text: "❌ Mention or reply to the user you want to gift!\nExample: .gift @user 1000\nExample: .gift @user 0.1 BTC" }, { quoted: msg });
    }
    if (target === sender) return sock.sendMessage(from, { text: "🤡 You can't gift yourself!" }, { quoted: msg });

    const giver = await economy.getUserProfile(sender, pushName);
    const receiver = await economy.getUserProfile(target);

    // Parse Amount
    const amountStr = args.find(arg => /^\d+(\.\d+)?[kmbt]?$/i.test(arg));
    const amount = utils.parseNumber(amountStr || "0");

    if (isNaN(amount) || amount <= 0) {
        return sock.sendMessage(from, { text: "❌ Please provide a valid amount to gift!" }, { quoted: msg });
    }

    // Check for Asset Ticker
    const ASSETS = ['BTC', 'ETH', 'SOL', 'DOGE', 'STR', 'TECH', 'MINE', 'VOID', 'BANK', 'FOOD'];
    const assetArg = args.find(arg => ASSETS.includes(arg.toUpperCase()));

    if (assetArg) {
        // --- ASSET TRANSFER ---
        const ticker = assetArg.toUpperCase();
        const type = ['BTC', 'ETH', 'SOL', 'DOGE', 'STR'].includes(ticker) ? 'crypto' : 'stocks';

        // Init Portfolios
        if (!giver.portfolio) giver.portfolio = { crypto: {}, stocks: {} };
        if (!giver.portfolio[type]) giver.portfolio[type] = {};
        if (!receiver.portfolio) receiver.portfolio = { crypto: {}, stocks: {} };
        if (!receiver.portfolio[type]) receiver.portfolio[type] = {};

        // Check Ownership
        let owned = 0;
        let holding = giver.portfolio[type][ticker];

        // Handle migration object vs number
        if (typeof holding === 'number') {
            owned = holding;
        } else if (holding) {
            owned = holding.quantity;
        }

        if (owned < amount) {
            return sock.sendMessage(from, { text: `❌ You don't have enough ${ticker}!\nOwned: ${owned}` }, { quoted: msg });
        }

        // Deduct from Giver
        if (typeof holding === 'number') {
            giver.portfolio[type][ticker] -= amount;
            if (giver.portfolio[type][ticker] <= 0) delete giver.portfolio[type][ticker];
        } else {
            holding.quantity -= amount;
            // Reduce cost basis proportionally? Yes, FIFO/Average reasoning implies cost basis reduction.
            const avgPrice = holding.average_buy_price;
            holding.total_invested -= (avgPrice * amount);

            if (holding.quantity <= 0.00000001) delete giver.portfolio[type][ticker];
        }

        // Add to Receiver
        // Receiver inherits the "Current Market Price" as their basis? Or the Giver's basis?
        // Standard tax law says "Carryover Basis" for gifts (US), but simplified economy:
        // Let's use *Current Market Price* for receiver to reset their P/L 0 baseline, 
        // OR better yet, just treat it as a free acquisition (Price = 0)? 
        // If Price=0, they have 100% profit. That's fun.
        // BUT lazy migration requires current price.
        // Let's blindly add quantity for now, and handle object conversion if needed.

        let destHolding = receiver.portfolio[type][ticker];
        if (typeof destHolding === 'number') {
            // Already Number, just add
            receiver.portfolio[type][ticker] += amount;
        } else if (!destHolding) {
            // Create New Object (P/L based on Current Market? We don't have price here easily w/o module)
            // Fallback: Store as NUMBER if we can't fetch price, user will migrate on next view.
            // This is the safest "Lazy" approach.
            receiver.portfolio[type][ticker] = amount;
        } else {
            // Is Object
            // We adding to an existing object. We need to update Quantity.
            // Does this affect Average Buy Price?
            // If we consider it "Free" (Price 0), it lowers average.
            // If we consider it "Market Value", we need price.
            // For simplicity and "Gifting", let's just add Quantity and NOT touch Total Invested 
            // (effectively Price = 0, lowering average cost).
            destHolding.quantity += amount;
            // destHolding.total_invested stays same
            // Recalculate average?
            destHolding.average_buy_price = destHolding.total_invested / destHolding.quantity;
        }

        await economy.saveDB();
        await sock.sendMessage(from, { text: `🎁 *ASSET GIFT SENT*\n\nSent: *${amount} ${ticker}*\nFrom: @${sender.split('@')[0]}\nTo: @${target.split('@')[0]}`, mentions: [sender, target] }, { quoted: msg });
        return;
    }

    // --- CASH TRANSFER (Existing Logic) ---
    // Check for Bank Card if transferring from bank
    const isBankTransfer = args.some(arg => arg.toLowerCase().includes('bank'));

    if (isBankTransfer) {
        if (!giver.inventory.debit_card && !giver.inventory.bank_card) { // Check both for legacy compat
            return sock.sendMessage(from, { text: "❌ You need a *💳 Starry Bank Card* to gift directly from your bank!\n🛒 Buy one in the `.shop`." }, { quoted: msg });
        }
        if (giver.financials.bank < amount) {
            return sock.sendMessage(from, { text: `❌ You don't have enough money in your bank!\n🏦 Bank: *$${giver.financials.bank.toLocaleString()}*` }, { quoted: msg });
        }
        giver.financials.bank -= amount;
        receiver.financials.wallet += amount; // Receivers always get it in wallet for now
    } else {
        if (giver.financials.wallet < amount) {
            return sock.sendMessage(from, { text: `❌ You don't have enough money in your wallet!\n💵 Balance: *$${giver.financials.wallet.toLocaleString()}*\n💡 Tip: Use \`.gift @user ${amount} bank\` if you have a Bank Card!` }, { quoted: msg });
        }
        giver.financials.wallet -= amount;
        receiver.financials.wallet += amount;
    }

    await economy.saveDB();

    // Respect Points Calculation: 1 point per $1000, minimum 1
    const respectEarned = 1 + Math.floor(amount / 1000);
    if (!giver.stats.respect) giver.stats.respect = 0;
    giver.stats.respect += respectEarned;
    await economy.saveDB(); // Save again for stats update

    const mode = isBankTransfer ? "🏦 *BANK TRANSFER*" : "🎁 *GENEROUS GIFT*";
    const response = `${mode}\n\n@${sender.split('@')[0]} sent a gift of *$${amount.toLocaleString()}* to @${target.split('@')[0]}!\n\n🤝 *Respect Points +${respectEarned}*`;

    await sock.sendMessage(from, { text: response, mentions: [sender, target] }, { quoted: msg });
}

/* 
 * Show Leaderboard
 */
async function handleLeaderboard(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const db = await fs.readJson(DB_PATH);
    // Sort users by total wealth (wallet + bank)
    const sorted = Object.entries(db.users)
        .map(([jid, data]) => ({
            jid,
            name: data.name,
            total: (data.financials?.wallet || 0) + (data.financials?.bank || 0),
            level: data.stats?.level || 1,
            role: data.role // Include role for filtering
        }))
        .filter(u => {
            // Filter out System accounts and Central Bank
            if (u.jid === 'house_treasury') return false;
            if (u.role === 'System') return false;
            if (u.jid === '0@s.whatsapp.net') return false; // WhatsApp official
            return true;
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    let lbText = `🏆 *STARRY GLOBAL LEADERBOARD*\n\n`;

    sorted.forEach((u, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        lbText += `${medal} *${u.name}*\n`;
        lbText += `   💰 Wealth: *$${u.total.toLocaleString()}*\n`;
        lbText += `   ⭐ Level: ${u.level}\n\n`;
    });

    lbText += `_The richest 10 users in the galaxy._`;

    await sock.sendMessage(from, { text: lbText }, { quoted: msg });
}

/* 
 * User Profile (.profile)
 */
async function handleProfile(msg, sock, botState, args) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);

    // Determine target
    let target = sender;

    // Check for arguments (Targeting)
    if (args && args.length > 0) {
        const parsed = utils.parseTarget(msg, args);
        if (parsed) {
            target = parsed;
        } else {
            // Try Name Search
            const searchQuery = args.join(" ").replace('@', '').toLowerCase().trim();
            const db = await economy.loadDB(); // Ensure we have data
            const users = db.users || {};

            const foundJid = Object.keys(users).find(jid => {
                const u = users[jid];
                return u.name && u.name.toLowerCase().includes(searchQuery);
            });

            if (foundJid) {
                target = foundJid;
            } else {
                return sock.sendMessage(from, { text: `❌ User "${args.join(" ")}" not found!` }, { quoted: msg });
            }
        }
    }

    const user = await economy.getUserProfile(target);

    // Calculate total wealth
    const wallet = user.financials?.wallet || 0;
    const bank = user.financials?.bank || 0;

    // Calculate Portfolio Value (Stocks + Crypto)
    // Calculate Portfolio Value (Stocks + Crypto)
    const economyStock = require('./economy-stock');
    const economyCrypto = require('./economy-crypto');

    // Use exported getters if available, fallback to empty object if fails
    const stockPrices = economyStock.getStockPrices ? economyStock.getStockPrices() : {};
    const cryptoPrices = economyCrypto.getMarketPrices ? economyCrypto.getMarketPrices() : {};

    let portfolioValue = 0;

    // Stocks
    if (user.portfolio?.stocks) {
        for (const [ticker, data] of Object.entries(user.portfolio.stocks)) {
            const qty = typeof data === 'number' ? data : data.quantity;
            const price = stockPrices[ticker] || 0;
            portfolioValue += qty * price;
        }
    }
    // Crypto
    if (user.portfolio?.crypto) {
        for (const [ticker, data] of Object.entries(user.portfolio.crypto)) {
            const qty = typeof data === 'number' ? data : data.quantity;
            const price = cryptoPrices[ticker] || 0;
            portfolioValue += qty * price;
        }
    }

    const netWorth = wallet + bank + portfolioValue;

    // Role Icon
    const roleIcons = {
        'Citizen': '🧑‍🦱',
        'Police': '👮',
        'Thief': '🥷',
        'Merchant': '👨‍💼',
        'Millionaire': '🤵'
    };
    const roleIcon = roleIcons[user.role] || '🧑‍🦱';

    let txt = `👤 *USER PROFILE*\n`;
    txt += `━━━━━━━━━━━━━━━━━━\n`;
    txt += `📛 *Name:* ${user.name}\n`;
    txt += `🏷️ *Title:* ${user.title || "The Novice"}\n`;
    txt += `👮 *Role:* ${roleIcon} ${user.role}\n`;
    txt += `📍 *Location:* ${user.location}\n`;
    txt += `⭐ *Level:* ${user.stats.level} (XP: ${user.stats.xp})\n`;
    txt += `📝 *Bio:* ${user.bio || "No bio set."}\n\n`;

    txt += `💰 *FINANCIALS*\n`;
    txt += `💵 Wallet: $${wallet.toLocaleString()}\n`;
    txt += `🏦 Bank: $${bank.toLocaleString()}\n`;
    if (portfolioValue > 0) txt += `📈 Assets: $${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n`;
    txt += `💎 Net Worth: $${netWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\n`;

    // Inventory Summary
    const items = Object.keys(user.inventory || {}).length;
    txt += `🎒 *Inventory:* ${items} unique items\n`;

    // Stats Summary
    if (user.stats) {
        txt += `\n📊 *STATS*\n`;
        if (user.stats.respect) txt += `🤝 Respect: ${user.stats.respect}\n`;
        if (user.stats.successful_robs) txt += `🎭 Robs: ${user.stats.successful_robs}\n`;
        if (user.stats.work_count) txt += `🛠️ Shifts: ${user.stats.work_count}\n`;
    }

    // Get PFP
    const pfpId = user.equipped_pfp || 'pfp_default';
    const pfpItem = economyShop.SHOP_ITEMS[pfpId];
    // Fallback URL if file missing or item invalid (use default PFP or placeholder)
    let pfpUrl = pfpItem ? pfpItem.url : 'c:/StarryMD/assets/pfp/pfp_default.png';

    // Verify file exists, otherwise fallback to a known online image or just text
    if (!fs.existsSync(pfpUrl)) {
        // Fallback to online image if local default is missing (safety net)
        pfpUrl = "https://i.imgur.com/3wZ3v6g.jpeg";
    }

    // Send Image Message
    await sock.sendMessage(from, {
        image: { url: pfpUrl },
        caption: txt,
        mentions: [target]
    }, { quoted: msg });
}

/* 
 * Set Bio (.bio)
 */
async function handleSetBio(msg, sock, botState, args) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);
    const pushName = msg.pushName || "User";

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: .bio <text>" }, { quoted: msg });
    }

    const bioText = args.join(" ");
    if (bioText.length > 100) {
        return sock.sendMessage(from, { text: "❌ Bio is too long! Max 100 chars." }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender, pushName);
    user.bio = bioText;
    await economy.saveDB();

    await sock.sendMessage(from, { text: "✅ *BIO UPDATED*\n\nYour profile has been updated." }, { quoted: msg });
}

/* 
 * Set Name (.name)
 */
async function handleSetName(msg, sock, botState, args) {
    const from = utils.decodeJid(msg.key.remoteJid);
    const sender = utils.decodeJid(msg.key.participant || from);

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: .name <New Name>" }, { quoted: msg });
    }

    const user = await economy.getUserProfile(sender);

    // Check if they have an ID Card
    if ((user.inventory.idcard || 0) <= 0 && (user.inventory.id_citizen || 0) <= 0) {
        return sock.sendMessage(from, { text: "❌ You need an *🆔 Identity Card* from the shop to change your name!" }, { quoted: msg });
    }

    const newName = args.join(" ").replace(/[^a-zA-Z0-9 ]/g, '').trim(); // Basic sanitization
    if (newName.length < 3 || newName.length > 25) {
        return sock.sendMessage(from, { text: "❌ Name must be between 3-25 alphanumeric characters." }, { quoted: msg });
    }

    user.name = newName;

    // Consume ID Card (optional, currently unlimited uses if owned? No, let's consume it)
    if (user.inventory.idcard > 0) {
        user.inventory.idcard--;
    }
    // Citizen ID is permanent, so we don't consume that, but maybe limit frequency? 
    // For now, let's allow it.

    await economy.saveDB();
    await sock.sendMessage(from, { text: `✅ *IDENTITY UPDATED*\n\nYou are now known as: *${newName}*` }, { quoted: msg });
}

/* 
 * Rich List / Millionaires Club (.rich)
 */
async function handleRichList(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const db = await fs.readJson(DB_PATH);

    // Helpers
    const formatProperty = (prop) => {
        if (!prop) return 'Homeless';
        if (prop === 'prop_box') return '📦 Box';
        if (prop === 'prop_apartment') return '🏢 Apartment';
        if (prop === 'prop_house') return '🏠 House';
        if (prop === 'prop_penthouse') return '🏙️ Penthouse';
        if (prop === 'prop_estate') return '🏰 Estate';
        if (prop === 'prop_island') return '🏝️ Private Island';
        return '🏠 Property';
    };

    // Helper for Asset Valuation (Copied for scope)
    const economyStock = require('./economy-stock');
    const economyCrypto = require('./economy-crypto');

    // Use exported getters if available
    const stockPrices = economyStock.getStockPrices ? economyStock.getStockPrices() : {};
    const cryptoPrices = economyCrypto.getMarketPrices ? economyCrypto.getMarketPrices() : {};

    // Filter users > $1,000,000
    const elite = Object.entries(db.users)
        .map(([jid, data]) => {
            let assets = 0;
            // Stocks
            if (data.portfolio?.stocks) {
                for (const [ticker, d] of Object.entries(data.portfolio.stocks)) {
                    const qty = typeof d === 'number' ? d : d.quantity;
                    const price = stockPrices[ticker] || 0;
                    assets += qty * price;
                }
            }
            // Crypto
            if (data.portfolio?.crypto) {
                for (const [ticker, d] of Object.entries(data.portfolio.crypto)) {
                    const qty = typeof d === 'number' ? d : d.quantity;
                    const price = cryptoPrices[ticker] || 0;
                    assets += qty * price;
                }
            }

            return {
                jid,
                name: data.name,
                total: (data.financials?.wallet || 0) + (data.financials?.bank || 0) + assets,
                liquid: (data.financials?.wallet || 0) + (data.financials?.bank || 0),
                assets: assets,
                title: data.title || 'The Novice',
                property: data.assets?.property || 'prop_box',
                role: data.role
            };
        })
        .filter(u => {
            // Filter out System accounts
            if (u.jid === 'house_treasury') return false;
            if (u.role === 'System') return false;
            if (u.jid === '0@s.whatsapp.net') return false;

            // THRESHOLD CHECK
            return u.total > 1000000;
        })
        .sort((a, b) => b.total - a.total); // Still sort them for neatness, even if not ranked numbered

    if (elite.length === 0) {
        return sock.sendMessage(from, { text: "🎩 *THE MILLIONAIRES CLUB*\n\n_It seems no one has reached elite status yet._\n\nThreshold: *$1,000,000*" }, { quoted: msg });
    }

    let txt = `🎩 *THE MILLIONAIRES CLUB*\n`;
    txt += `_The Elite Citizens of the Galaxy_\n\n`;

    elite.forEach(u => {
        const propName = formatProperty(u.property);
        txt += `• *${u.name}*\n`;
        txt += `   💰 $${u.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n`;
        if (u.assets > 0) {
            txt += `   (💵 Liquid: $${u.liquid.toLocaleString(undefined, { maximumFractionDigits: 0 })} | 📈 Assets: $${u.assets.toLocaleString(undefined, { maximumFractionDigits: 0 })})\n`;
        }
        txt += `   🏷️ ${u.title} | ${propName}\n\n`;
    });

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * Investor Leaderboard (.investors)
 */
async function handleInvestorLeaderboard(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const db = await fs.readJson(DB_PATH);
    const economyStock = require('./economy-stock'); // Need prices
    const economyCrypto = require('./economy-crypto'); // Need prices

    // Get pseudo-realtime prices (re-generating them is fine as they are deterministic by timeblock)
    const stockPrices = economyStock.getStockPrices ? economyStock.getStockPrices() : {}; // Check export availability
    // Accessing private functions from other modules is tricky if not exported.
    // Stock module exports handleStock, etc. 
    // I need to update economy-stock.js and economy-crypto.js to export getPrices functions? 
    // Or I can copy the deterministic logic / read them if they cache?
    // Actually, economy-stock.js EXPORTS only handles. I should probably ADD getStockPrices to exports in modifying step.
    // WAIT. I can't modify those files again just for this easily without context switch.
    // LET'S CHECK if I can access them.  
    // If not, I'll use a hack or duplicate the price logic briefly.
    // Better: I will modify this function to assume they are exported, and if I realize they aren't, I'll fix the exports in next step.
    // Actually, looking at previous `view_file` for economy-stock.js:
    // module.exports = { handleStock, handleBuy, handleSell };
    // It does NOT export getStockPrices. 
    // I should fix that first to be clean.

    // Re-evaluating plan:
    // 1. Update economy-stock.js to export getStockPrices.
    // 2. Update economy-crypto.js to export getMarketPrices.
    // 3. Implement handleInvestorLeaderboard here.

    // To allow this "replace_file_content" to proceed without erroring on logic I haven't written yet, I will write the function to fail gracefully or I will do the exports FIRST.
    // USE MULTI-STEP approach.
    // Step 1: Fix exports.
    // Step 2: Add this function.

    // ABORTING THIS SPECIFIC TOOL CALL LOGIC to prioritize exports.
    // But I can't abort a tool call in the middle of generation easily.
    // I will write the function to simple call a helper I will add.

    // ACTUALLY, I can just duplicate the simplified price logic here for the leaderboard to avoid touching 2 other files just for a getter.
    // The price logic is deterministic based on time.
    // Stock: TimeBlock = floor(Date / 3600000). 
    // Crypto: TimeBlock = floor(Date / 300000).

    // Let's replicate the getters locally inside this function to avoid dependency hell for now.

    const getStockPricesLocal = () => {
        const STOCKS = {
            TECH: { name: "Cyber Systems", base: 120, trend: 0.05 },
            MINE: { name: "Deep Space Mining", base: 45, trend: 0.02 },
            VOID: { name: "Void Energy", base: 300, trend: 0.15 },
            BANK: { name: "Galactic Bank", base: 80, trend: 0.01 },
            FOOD: { name: "Orbital Organics", base: 25, trend: 0.03 }
        };
        const timeBlock = Math.floor(Date.now() / 3600000);
        const prices = {};
        const seededRandom = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

        for (const [ticker, stock] of Object.entries(STOCKS)) {
            const seed = timeBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const random = seededRandom(seed);
            const dayTrend = Math.sin(timeBlock / 24) * stock.trend;
            const noise = (random * 2 - 1) * (stock.trend / 2);
            let price = stock.base * (1 + dayTrend + noise);
            if (price < 1) price = 1;
            prices[ticker] = price;
        }
        return prices;
    };

    const getCryptoPricesLocal = () => {
        const CRYPTO_COINS = {
            BTC: { base: 65000, volatility: 0.10 },
            ETH: { base: 3500, volatility: 0.15 },
            SOL: { base: 140, volatility: 0.20 },
            DOGE: { base: 0.15, volatility: 0.30 },
            STR: { base: 1.00, volatility: 0.50 }
        };
        const timeBlock = Math.floor(Date.now() / 300000);
        const prices = {};
        const seededRandom = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

        for (const [ticker, coin] of Object.entries(CRYPTO_COINS)) {
            const seed = timeBlock + ticker.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const random = seededRandom(seed);
            const change = (random * 2 - 1) * coin.volatility;
            let price = coin.base * (1 + change);
            if (price < 0.00000001) price = 0.00000001;
            prices[ticker] = price;
        }
        return prices;
    };

    const stockMarket = getStockPricesLocal();
    const cryptoMarket = getCryptoPricesLocal();

    const investors = [];

    for (const [jid, u] of Object.entries(db.users)) {
        if (u.role === 'System' || jid === 'house_treasury' || jid === '0@s.whatsapp.net') continue;

        let totalRealized = u.stats?.realized_gains || 0;
        let totalUnrealized = 0;

        // Stocks Unrealized
        if (u.portfolio?.stocks) {
            for (const [ticker, data] of Object.entries(u.portfolio.stocks)) {
                let qty = 0;
                let invested = 0;

                // Handle mixed types (if not migrated yet, we can't calculate profit efficiently without migrating, 
                // so we assume 0 profit for unmigrated legacy items to avoid complexity here)
                if (typeof data === 'object') {
                    qty = data.quantity;
                    invested = data.total_invested;
                    const price = stockMarket[ticker] || 0;
                    const val = qty * price;
                    totalUnrealized += (val - invested);
                }
            }
        }

        // Crypto Unrealized
        if (u.portfolio?.crypto) {
            for (const [ticker, data] of Object.entries(u.portfolio.crypto)) {
                if (typeof data === 'object') {
                    const price = cryptoMarket[ticker] || 0;
                    const val = data.quantity * price;
                    totalUnrealized += (val - data.total_invested);
                }
            }
        }

        const totalProfit = totalRealized + totalUnrealized;

        // Only list people who have actually invested (profit != 0 or has portfolio)
        const hasPortfolio = (Object.keys(u.portfolio?.stocks || {}).length > 0) || (Object.keys(u.portfolio?.crypto || {}).length > 0);

        if (hasPortfolio || totalProfit !== 0) {
            investors.push({
                name: u.name,
                profit: totalProfit,
                realized: totalRealized,
                unrealized: totalUnrealized
            });
        }
    }

    // Sort by Total Profit
    investors.sort((a, b) => b.profit - a.profit);
    const topInvestors = investors.slice(0, 10);

    if (topInvestors.length === 0) {
        return sock.sendMessage(from, { text: "📉 *WALL STREET JOURNAL*\n\nNo active investors found." }, { quoted: msg });
    }

    let txt = `📈 *TOP INVESTORS (P/L)*\n`;
    txt += `_Ranking based on Realized + Unrealized Gains_\n\n`;

    topInvestors.forEach((inv, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        const sign = inv.profit >= 0 ? "+" : "";
        txt += `${medal} *${inv.name}*\n`;
        txt += `   💵 Total P/L: *${sign}$${inv.profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}*\n`;
        txt += `   📊 (Realized: $${inv.realized.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Unrealized: $${inv.unrealized.toLocaleString(undefined, { maximumFractionDigits: 0 })})\n\n`;
    });

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * List Owned Titles (.titles)
 */
async function handleTitles(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);

    // Default title if none
    if (!user.titles || user.titles.length === 0) {
        user.titles = ["The Novice"];
    }

    // Ensure current title is in list (sanity check)
    if (user.title && !user.titles.includes(user.title)) {
        user.titles.push(user.title);
    }

    let txt = `🏷️ *YOUR TITLES*\n\n`;
    txt += `Current: *${user.title || "The Novice"}*\n\n`;

    user.titles.forEach((t, i) => {
        const isEquipped = t === user.title ? "✅" : "⭕";
        txt += `${isEquipped} ${t}\n`;
    });

    txt += `\n_Use .equip <name> to change your title._`;

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

/* 
 * Equip Title (.equip)
 */
async function handleEquip(msg, sock, botState, args) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    if (!args || args.length === 0) {
        return sock.sendMessage(from, { text: "❌ Usage: .equip <title_name>\nExample: .equip Master Hunter" }, { quoted: msg });
    }

    const searchQuery = args.join(" ").toLowerCase().trim();
    const user = await economy.getUserProfile(sender);



    // Find best match
    // Check Titles
    if (user.titles && user.titles.includes(searchQuery)) {
        // Exact case match or fuzzy check handled by logic? 
        // Logic below assumes `searchQuery` is from `user.titles` if found? 
        // The original code was: `const match = user.titles.find(...)`. 
        // Let's preserve that logic but add PFP check.
    }

    // Find Title Match
    const titleMatch = (user.titles || []).find(t => t.toLowerCase() === searchQuery || t.toLowerCase().includes(searchQuery));

    if (titleMatch) {
        user.title = titleMatch;
        await economy.saveDB();
        return sock.sendMessage(from, { text: `✅ *TITLE EQUIPPED*\n\nYou are now known as:\n🏷️ *${user.name}, ${titleMatch}*` }, { quoted: msg });
    }

    // Find PFP Match (Check Inventory)
    // PFPs are items in inventory with type 'pfp'
    // User might type part of the name or the ID.
    // Let's search inventory keys.
    const pfpMatchId = Object.keys(user.inventory || {}).find(itemId => {
        const item = economyShop.SHOP_ITEMS[itemId];
        return item && item.type === 'pfp' && user.inventory[itemId] > 0 && (itemId === searchQuery || item.name.toLowerCase().includes(searchQuery));
    });

    if (pfpMatchId) {
        const item = economyShop.SHOP_ITEMS[pfpMatchId];
        user.equipped_pfp = pfpMatchId;
        await economy.saveDB();
        return sock.sendMessage(from, { text: `✅ *AVATAR EQUIPPED*\n\nYou have equipped:\n👤 *${item.name}*` }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: `❌ Item not found or not owned! Check .titles or your .inventory for avatars.` }, { quoted: msg });
}

/* 
 * Census / Player List (.census)
 */
async function handleCensus(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const db = await fs.readJson(DB_PATH);

    const calculateNetWorth = (data) => (data.financials?.wallet || 0) + (data.financials?.bank || 0);

    const players = Object.values(db.users)
        .filter(u => {
            // Exclude system accounts and bots
            if (u.role === 'System') return false;
            if (u.jid === '0@s.whatsapp.net') return false;
            if (!u.name) return false;
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    if (players.length === 0) {
        return sock.sendMessage(from, { text: "📂 *GALACTIC CENSUS*\n\nNo records found." }, { quoted: msg });
    }

    let txt = `📂 *GALACTIC CENSUS*\n`;
    txt += `_Registered Citizens of the Starry Multiverse_\n\n`;

    players.forEach((p, i) => {
        txt += `${i + 1}. *${p.name}* (${p.title || 'The Novice'})\n`;
        txt += `   💰 Net Worth: $${calculateNetWorth(p).toLocaleString()}\n`;
        txt += `   📍 ${p.location || 'Unknown'}\n\n`;
    });

    txt += `Total Citizens: ${players.length}`;

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}


/* 
 * Check Cooldowns (.cooldowns)
 */
async function handleCooldowns(msg, sock, botState) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const user = await economy.getUserProfile(sender);

    const now = Date.now();
    let txt = `⏳ *ACTIVE COOLDOWNS*\n\n`;
    let active = false;

    if (user.cooldowns) {
        for (const [key, endTime] of Object.entries(user.cooldowns)) {
            if (endTime > now) {
                const remaining = endTime - now;
                const activityName = key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ');
                txt += `• *${activityName}:* ${economy.formatTime(remaining)}\n`;
                active = true;
            }
        }
    }

    if (!active) {
        txt += "✅ *Ready for Action!*\nYou have no active cooldowns.";
    } else {
        txt += `\n_Use items like Energy Drink or Time Orb to reset specific cooldowns._`;
    }

    await sock.sendMessage(from, { text: txt }, { quoted: msg });
}

module.exports = {
    handleRob,
    handleGift,
    handleLeaderboard,
    handleProfile,
    handleSetBio,
    handleSetName,
    handleRichList,
    handleTitles,
    handleEquip,
    handleCensus,
    handleCooldowns,
    handleInvestorLeaderboard
}