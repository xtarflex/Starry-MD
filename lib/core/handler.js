import fs from 'fs-extra';
import dbManager from './db-manager.js';
import config from '../../config.js';
import utils from './utils.js';
import status from '../utils/status.js';
import adminPermissions from './admin-permissions.js';
import guardian from './guardian.js';
import socialLab from '../services/social-lab.js';
import infoZone from '../services/info-zone.js';
import economy from '../systems/economy.js';
import economyBilling from '../systems/economy-billing.js';
import searchSession from '../services/search-session.js';
import router from './router.js';
import * as rateLimit from '../utils/rate-limit.js';
import aiController from './controllers/ai-controller.js';
import goonController from './controllers/goon-controller.js';
import { loadCommands } from './command-loader.js';
import { suggestCommand } from './suggest.js';

// Load modular commands
const commands = await loadCommands();

/**
 * Main Message Handler (Neural Link)
 */
export default async (msg, sock, botState) => {
    // 🌟 GLOBAL OUTPUT INTERCEPTOR 🌟
    const originalSendMessage = sock.sendMessage;
    sock.sendMessage = async (jid, content, options) => {
        if (content && typeof content.text === 'string') {
            content.text = utils.autoReadMore(content.text);
        }
        return await originalSendMessage.call(sock, jid, content, options);
    };

    if (!msg || !msg.key || !msg.key.remoteJid) return;

    const from = utils.decodeJid(msg.key.remoteJid);
    const isGroup = from.endsWith('@g.us');
    const isMe = msg.key.fromMe;
    const pushName = msg.pushName || "User";

    // Extract Body
    const body = (msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        "").trim();

    // 🌟 INTERACTIVE SEARCH LISTENER
    const selectionMatch = body.match(/^(\d+)\s*(v|video|a|audio)?$/i);
    if (selectionMatch) {
        const index = parseInt(selectionMatch[1]);
        const type = (selectionMatch[2] || "").toLowerCase();
        const sender = msg.key.participant || from;
        const selectionObj = searchSession.getSelection(sender, index);

        if (selectionObj) {
            const { data, provider } = selectionObj;
            if (provider === 'tiktok') return socialLab.sendTikTokVideo(msg, sock, data);
            if (provider === 'tiktok-user') return socialLab.handleTikTok(msg, sock, botState, ['@' + data.unique_id]);
            if (provider === 'youtube') {
                return sock.sendMessage(from, { text: "⚠️ *YouTube Features (Audio/Video) are currently disabled.*" }, { quoted: msg });
            }
            if (provider === 'pinterest-fallback') {
                if (index === 1) return socialLab.handlePinterestFallback(msg, sock, botState, data);
                return sock.sendMessage(from, { text: "✅ Cancelled." }, { quoted: msg });
            }
            if (provider === 'instagram-search') {
                const url = data.url || data.link || (data.id ? `https://instagram.com/p/${data.id}` : null);
                if (!url) return sock.sendMessage(from, { text: "❌ Error: Link not found in session." }, { quoted: msg });
                return socialLab.handleInstagram(msg, sock, botState, [url]);
            }
            if (provider === 'news-interactive') return infoZone.handleNewsSelection(msg, sock, botState, data);
        }
    }

    // 🌟 PH INTERACTIVE CONFIRMATION
    if (botState.pendingPH?.[from] && (body.toLowerCase() === 'yes' || body.toLowerCase() === 'no' || /^\d+$/.test(body))) {
        const phCmd = commands.get('ph');
        if (phCmd) return phCmd.execute(msg, sock, [], botState);
    }

    const sender = utils.decodeJid(isMe ? sock.user.id : (isGroup ? msg.key.participant : from));
    const ownerIds = (config.OWNER_ID || "").toString().split(',').map(id => id.trim());
    const isOwner = isMe ||
        (sender && typeof sender === 'string' && ownerIds.some(id => sender.includes(id))) ||
        (sender === botState.ownerID) ||
        (sender === utils.decodeJid(sock.user.id));

    // Bot's JID for mention detection
    const botJid = utils.decodeJid(sock.user.id);
    const botNumber = botJid.split('@')[0];
    const isQuoted = msg.message?.extendedTextMessage?.contextInfo?.participant === botJid;
    const isMentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botJid) ||
        body.toLowerCase().includes(`@${botNumber}`) ||
        body.toLowerCase().includes('@starry') ||
        isQuoted;

    // --- 0. BLACKLIST ENFORCEMENT ---
    if (!botState.bannedChats) {
        botState.bannedChats = fs.readJsonSync('./database/banned.json', { throws: false }) || [];
    }
    if (botState.bannedChats.includes(sender) || botState.bannedChats.includes(from)) {
        if (!isMe) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) { }
        }
        return;
    }

    // --- 1. MINIMAL MONITORING ---
    if (!isMe) utils.log("INFLOW", `Msg from ${pushName} (${sender}): "${body.slice(0, 20)}..."`);

    // --- 2. PREFIX DETECTION ---
    const pTool = config.PREFIX_TOOL || '.';
    const pSys = config.PREFIX_SYSTEM || '$';
    const isTool = body.startsWith(pTool);
    const isSys = body.startsWith(pSys);
    const isCmd = isTool || isSys;

    // --- 3. STATUS AUTO-SAVE ---
    const isNewsletter = from.endsWith('@newsletter');
    const isStatus = from === 'status@broadcast' || from.endsWith('@broadcast');
    if (isStatus && !isMe) {
        if (!botState.statusPosters) botState.statusPosters = {};
        const posterJid = msg.key.participant;
        if (posterJid) {
            const posterName = botState.contacts[posterJid]?.name || pushName;
            if (!botState.statusPosters[posterJid]) botState.statusPosters[posterJid] = { name: posterName, count: 0, lastPosted: null };
            botState.statusPosters[posterJid].count++;
            botState.statusPosters[posterJid].lastPosted = new Date().toISOString();

            const settings = status.getSettings();
            if (botState.statusPosters[posterJid].count === 1 && config.OWNER_ID && settings.statusNotify !== false) {
                const ownerIdsList = config.OWNER_ID.toString().split(',').map(id => id.trim() + '@s.whatsapp.net');
                const displayNum = (msg.key.remoteJidAlt || posterJid).split('@')[0];
                for (const oid of ownerIdsList) {
                    await sock.sendMessage(oid, { text: `🆕 *NEW STATUS POSTER*\n\n👤 ${posterName}\n📱 ${displayNum}\n\n_Reply .vs to view immediately_` });
                }
            }
        }
        await status.saveStatus(msg, sock);
        return;
    }

    // --- 4. GUARDIAN ENGINE (Group Security) ---
    const groupMetadata = isGroup ? (botState.groupMetadata[from] || await sock.groupMetadata(from)) : null;
    const botIsAdmin = isGroup ? adminPermissions.isBotAdmin(botJid, groupMetadata) : false;
    const senderIsAdmin = isGroup ? adminPermissions.isAdmin(sender, groupMetadata) : false;
    const securitySettings = isGroup ? (botState.groupSettings[from] || {}) : {};

    if (await guardian.check(msg, sock, isGroup, senderIsAdmin, botIsAdmin, securitySettings, isCmd)) return;

    // --- 5. AUTO-REACTION ---
    if (!isMe && !isNewsletter && botState.mode !== '$sleep' && body) {
        const fullText = body.toLowerCase();
        for (const [emoji, keywords] of Object.entries(botState.reactions)) {
            let matched = false;
            for (const keyword of keywords) {
                const isMatch = keyword.includes(' ') ? fullText.includes(keyword.toLowerCase()) : (new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i')).test(fullText);
                if (isMatch && utils.canProcess(`react_${from}`, botState.cooldowns)) {
                    await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
                    matched = true;
                    break;
                }
            }
            if (matched) break;
        }
    }

    // --- 6. HANDSHAKE PROTOCOL (Stranger Danger) ---
    if (!isMe && !isGroup && !isCmd && botState.mode !== '$sleep' && !isStatus && !isNewsletter && !botState.contacts[sender]) {
        if (!botState.handshakeWaiting) botState.handshakeWaiting = new Set();
        if (!botState.handshakeWaiting.has(sender)) {
            await utils.delay(2000);
            await utils.simulateTyping(sock, from, 1500);
            await sock.sendMessage(from, { text: `Hi ${pushName}, what's up? 👋` });
            botState.handshakeWaiting.add(sender);
            return;
        } else {
            botState.handshakeWaiting.delete(sender);
            botState.contacts[sender] = { name: pushName, addedAt: Date.now(), sync: false };
            dbManager.save("./database/contacts.json", botState.contacts);
            const hour = new Date().getHours();
            const greeting = hour < 12 ? "Good Morning" : (hour < 18 ? "Good Afternoon" : "Good Evening");
            await utils.delay(4000);
            await utils.simulateAudio(sock, from, 4000);
            const vcard = (await import('../utils/vcard.js')).default.getOwnerVCard(config.OWNER_NAME || "Starry Owner", config.OWNER_ID);
            await sock.sendMessage(from, { contacts: { displayName: config.OWNER_NAME || "Starry Owner", contacts: [{ vcard }] } });
            await sock.sendMessage(from, { text: `${greeting}! 🌠 Saving my contact ensures you see my status updates.` });
            return;
        }
    }

    // --- 7. COMMAND DISPATCHER ---
    if (isCmd || isMentioned) {
        const currentPrefix = isSys ? pSys : pTool;
        const cmd = isCmd ? body.slice(currentPrefix.length).trim().split(/\s+/)[0].toLowerCase() : "";
        const argsStr = isCmd ? body.slice(currentPrefix.length + cmd.length).trim() : body.trim();
        const args = argsStr.split(/\s+/).filter(a => a !== "");

        // Router & Permissions
        if (isCmd && !isOwner) {
            const routeStatus = await router.checkRoute(cmd, from);
            if (!routeStatus.allowed) {
                if (router.isKnownGroup(from)) {
                    const redirect = routeStatus.redirect;
                    await sock.sendMessage(from, { text: `⚠️ *Wrong Channel!*\nPlease use \`.${cmd}\` in *${redirect.groupName || "the correct group"}*.` }, { quoted: msg });
                }
                return;
            }

            const limitCheck = rateLimit.check(sender, cmd);
            if (!limitCheck.allowed) {
                if (limitCheck.warn) {
                    const warnText = limitCheck.reason === 'daily' ? `🛑 *DAILY LIMIT REACHED*` : `⏳ *Slow Down!* Wait ${Math.ceil(limitCheck.timeLeft / 1000)}s.`;
                    await sock.sendMessage(from, { text: warnText }, { quoted: msg });
                } else await sock.sendMessage(from, { react: { text: "🤫", key: msg.key } });
                return;
            }
        }

        // Jail System
        const userProfile = await economy.getUserProfile(sender);
        if (userProfile.jail_until > Date.now() && !['bail', 'escape', 'status', 'help'].includes(cmd)) {
            return sock.sendMessage(from, { text: `🔒 *PRISONER*\nRelease: ${economy.formatTime(userProfile.jail_until - Date.now())}` }, { quoted: msg });
        }

        // RPG Guard
        const RPG_COMMANDS = ['work', 'daily', 'mine', 'dig', 'fish', 'hunt', 'buy', 'shop', 'bank', 'balance', 'inventory', 'rob'];
        if (RPG_COMMANDS.includes(cmd)) {
            if (!economy.isRegistered(sender)) return sock.sendMessage(from, { text: "🚫 *UNREGISTERED*\nType *.spawn* to start." }, { quoted: msg });
            await economyBilling.processBilling(sender);
        }

        // Mode Enforcement
        if (botState.mode === '$sleep' && !isOwner) return;
        if (botState.mode === '$private' && !isOwner && botState.modeDetails?.strict !== false) {
            await sock.sendMessage(from, { react: { text: "🤫", key: msg.key } });
            return;
        }

        // Goon Mode Controller
        if (botState.mode === '$goon' || ['goon', 'edge', 'stash', 'goonroulette'].includes(cmd)) {
            const handled = await goonController.handleGoon(msg, sock, botState, cmd, args);
            if (handled) return;
        }

        // AI Delegation
        if (await aiController.handleAI(msg, sock, botState, cmd, args, body, isMentioned, isOwner)) return;

        // --- DYNAMIC COMMAND LOADER ---
        console.log(`[Handler Debug] Cmd: ${cmd}, IsCmd: ${isCmd}, Commands Size: ${commands.size}`);
        if (isCmd) {
            if (commands.has(cmd)) {
                try {
                    const command = commands.get(cmd);
                    if (command.ownerOnly && !isOwner) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: msg });
                    if (command.adminOnly && !senderIsAdmin && !isOwner) return sock.sendMessage(from, { text: "❌ Admin only." }, { quoted: msg });

                    await command.execute(msg, sock, args, botState);
                    return;
                } catch (err) {
                    utils.log("ERROR", `Cmd ${cmd} failed: ${err.message}`);
                    await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
                    return;
                }
            }

            // Fallback suggestions
            const suggestion = suggestCommand(cmd, commands);
            let errorMsg = `❌ *Unknown command:* \`.${cmd}\``;
            if (suggestion) errorMsg += `\n\n💡 *Did you mean:* \`.${suggestion}\`?`;
            const sent = await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
            setTimeout(() => sock.sendMessage(from, { delete: sent.key }), 5000);
        }
    }
};
