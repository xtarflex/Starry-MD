const config = require('../config');
const utils = require('./utils');
const os = require('os');

/* 
 * Cosmic Dashboard Generator (Fancy HUD UI)
 * Dynamic menu builder with randomized headers and system stats.
 * @param {string} mode - Current bot mode ($public, $private, etc.)
 * @returns {string} The formatted menu string.
 */
const getMenu = (mode) => {
    // 1. CREATIVE: Random Space Headers
    const headers = [
        "🛸 ＳＴＡＲＲＹ  ＭＤ 🛸",
        "★彡 𝘾𝙊𝙎𝙈𝙄𝘾 𝙋𝙍𝙊𝙏𝙊𝘾𝙊𝙇 彡★",
        "☄️ ＧＡＬＡＣＴＩＣ  ＣＯＲＥ ☄️",
        "🌌 ＮＥＢＵＬＡ  ＳＹＳＴＥＭ 🌌"
    ];
    const randomHeader = headers[Math.floor(Math.random() * headers.length)];

    // 2. CREATIVE: Time-Based Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "🌅 Good Morning" : hour < 18 ? "☀️ Good Afternoon" : "🌙 Good Evening";

    // 3. CREATIVE: System Stats for the HUD look
    const ramTotal = (os.totalmem() / 1024 / 1024).toFixed(0);
    const ramFree = (os.freemem() / 1024 / 1024).toFixed(0);

    // Command Prefixes
    const p = config.PREFIX_TOOL || '.';
    const s = config.PREFIX_SYSTEM || '$';

    return `
╭━━━${randomHeader}━━━╮
┃
┃ 👨‍💻 *Pilot:* ${config.OWNER_NAME || 'Starry Xander'}
┃ 📡 *Mode:* ${mode.toUpperCase()}
┃ 🧠 *RAM:* ${ramFree}MB / ${ramTotal}MB
┃ ⌚ *Time:* ${new Date().toLocaleTimeString()}
┃
╰━━━━━━━━━━━━━━━━━━╯
${greeting}, Commander.
Systems are optimal. Awaiting instructions.
${utils.readMore}
╭━━ 🛡️ *𝐆𝐔𝐀𝐑𝐃𝐈𝐀𝐍 𝐏𝐑𝐎𝐓𝐎𝐂𝐎𝐋𝐒*
┃ 
┃ 🌌 ${p}alive ➾ _Heartbeat Check_
┃ 🌌 ${p}save [me/dm] ➾ _Capture Status_
┃ 🌌 ${p}vv ➾ _Decrypt ViewOnce_
┃ 🌌 ${p}ghost [list] ➾ _Anti-Delete Trace_
┃ 🌌 ${p}reveal ➾ _Expose Deleted Msg_
┃ 🌌 ${p}ghostbuffer ➾ _Set Buffer Time_
┃ 🌌 ${p}ping ➾ _Latency Pulse_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🤖 *𝐀𝐈 𝐂𝐎𝐑𝐄* (Groq-Powered)
┃
┃ 🧠 ${p}ai [text] ➾ _Default AI_
┃ 🎨 ${p}imagine [prompt] ➾ _AI Image Gen_
┃ 👁️ ${p}vision [query] ➾ _Image Analysis_
┃ 📈 ${p}advisor [query] ➾ _Crypto/Stock AI_
┃ 🎭 ${p}newpersona ➾ _Custom Persona_
┃ 
┃ === Human-Like Personas ===
┃ 😾 ${p}yuki [text] ➾ _Bratty Tsundere_
┃ 💀 ${p}fizz [text] ➾ _Chaotic Gen-Z_
┃ 🎮 ${p}jax [text] ➾ _Toxic Gamer_
┃ 😴 ${p}ren [text] ➾ _Sleepy Loner_
┃ ✨ ${p}bella [text] ➾ _Delusional Influencer_
┃
┃ === Classic Personas ===
┃ 🔧 ${p}tech [text] ➾ _Expert AI_
┃ 💕 ${p}uwu [text] ➾ _Anime AI_
┃ 👩 ${p}mom [text] ➾ _Caring Mom_
┃ 🏴‍☠️ ${p}pirate [text] ➾ _Sea Captain_
┃
┃ === AI Settings ===
┃ ⚙️ ${p}aitoggle ➾ _Toggle AI Mentions_
┃ 📚 ${p}help <question> ➾ _AI-Powered Help_
┃ 🧢 ${p}human [text] ➾ _Casual Gen-Z_
┃ 🤖 ${p}normal [text] ➾ _Standard AI_
┃
╰━━━━━━━━━━━━━━━━━━━


╭━━ ☁️ *𝐔𝐏𝐋𝐎𝐀𝐃 𝐂𝐄𝐍𝐓𝐄𝐑*
┃
┃ 📤 ${p}upload [pass] ➾ _Save Media_
┃ 📥 ${p}get <id> ➾ _Download File_
┃ 📂 ${p}list [folder] ➾ _List Files_
┃ 🔗 ${p}url <id> ➾ _Get Web Link_
┃ 🗑️ ${p}delete <id> ➾ _Delete File_
┃ 📁 ${p}mkdir <name> ➾ _New Folder_
┃
╰━━━━━━━━━━━━━━━━━━━
 
╭━━ 🎨 *𝐌𝐄𝐃𝐈𝐀 𝐅𝐎𝐑𝐆𝐄*
┃
┃ 🛸 ${p}sticker / ${p}s ➾ _Create Sticker_
┃ 🛸 ${p}sticker [query] ➾ _Search Stickers_
┃ 🛸 ${p}toimg / ${p}mp4 ➾ _Convert Media_
┃ 🛸 ${p}doge / ${p}cat ➾ _Random Animal_
┃ 
┃ === Image Effects ===
┃ 🎭 ${p}meme [text] ➾ _Meme Generator_
┃ 💀 ${p}wasted ➾ _GTA Death Style_
┃ 🎨 ${p}circle / ${p}blur / ${p}invert
┃
┃ === Tools ===
┃ 🛸 ${p}tourl ➾ _Upload to Web_
┃ 🛸 ${p}ssteal ➾ _Sticker Meta Steal_
┃ 📧 ${p}tempmail ➾ _Disposable Email_
┃ 📱 ${p}tempsms ➾ _Disposable SMS_
┃
╰━━━━━━━━━━━━━━━━━━━
 
╭━━ 🎵 *𝐀𝐔𝐃𝐈𝐎 𝐋𝐀𝐁* (FFmpeg)
┃
┃ 🎧 ${p}play [query] ➾ _YT Music DL_
┃ 🎬 ${p}video [query] ➾ _YT Video DL_
┃ 🎧 ${p}yts [query] ➾ _YT Search List_
┃ 🎧 ${p}tovn ➾ _Message to PTT_
┃ 🎧 ${p}fast / ${p}slow ➾ _Speed Shift_
┃ 🎧 ${p}reverse / ${p}echo ➾ _FX Filters_
┃ 🎧 ${p}nightcore / ${p}deep ➾ _Pitch FX_
┃ 🎧 ${p}blown / ${p}tremolo ➾ _Distortion_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐒𝐎𝐂𝐈𝐀𝐋 𝐋𝐀𝐁*
┃
┃ 🎵 ${p}tt <link> ➾ _TikTok No-WM_
┃ 🔎 ${p}tt <query> ➾ _TikTok Search_
┃ 👤 ${p}tt @user ➾ _Profile & Videos_
┃ 📸 ${p}ig <link> ➾ _Instagram DL_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 📂 *𝐂𝐎𝐍𝐓𝐀𝐂𝐓 𝐁𝐑𝐈𝐃𝐆𝐄*
┃
┃ 🪪 ${p}vcard [name] ➾ _Share My VCard_
┃ 🪪 ${p}botvcard ➾ _Bot VCard_
┃ 🪪 ${p}sv [name] ➾ _Save Contact (DM)_
┃ 🪪 ${p}contacts ➾ _List All Contacts_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 📊 *𝐒𝐓𝐀𝐓𝐔𝐒 𝐀𝐍𝐀𝐋𝐘𝐓𝐈𝐂𝐒*
┃
┃ 📈 ${p}statusinfo ➾ _Status Bot Intel_
┃ 📈 ${p}statstats ➾ _Poster Rankings_
┃ 📈 ${p}statvip ➾ _Manage VIP List_
┃ 📈 ${p}statusnotify ➾ _Toggle Alerts_
┃ 📈 ${p}vs ➾ _Manual View Status_
┃ 📈 ${p}alpha ➾ _Manual Batch Run_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🛠️ *𝐃𝐈𝐀𝐆𝐍𝐎𝐒𝐓𝐈𝐂𝐒*
┃
┃ 🔧 ${p}runtime ➾ _Core Uptime_
┃ 🔧 ${p}sys ➾ _Host Metrics_
┃ 🔧 ${p}request [text] ➾ _Feature Request_
┃ 🔧 ${p}del ➾ _Delete Message_
┃ 🔧 ${p}block ➾ _Block User_
┃ 🔧 ${p}unblock ➾ _Unblock User_
┃ 🔧 ${p}menu ➾ _This Menu_
┃ 🔧 ${p}report [@user] ➾ _Report Spam_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🕹️ *𝐂𝐎𝐍𝐓𝐑𝐎𝐋 𝐂𝐄𝐍𝐓𝐄𝐑* (Owner)
┃
┃ ⚙️ ${s}public ➾ _Public Mode_
┃ ⚙️ ${s}private ➾ _Private Mode_
┃ ⚙️ ${s}sleep ➾ _Sleep Mode_
┃ ⚙️ ${p}setbio [text] ➾ _Set Bio_
┃ ⚙️ ${p}autobio [on/off] ➾ _Auto Bio Toggle_
┃ 🏛️ ${p}treasury [info/print] ➾ _Central Bank_
┃ ⚙️ ${p}vvmode [chat/save] ➾ _ViewOnce Mode_
┃ ⚙️ ${p}addreact [emoji] [word] ➾ _Add Reaction_
┃ ⚙️ ${p}delreact [word] ➾ _Delete Reaction_
┃ ⚙️ ${p}listreact ➾ _List Reactions_
┃ ⚙️ ${p}setsched [hours] ➾ _Status Schedule_
┃ ⚙️ ${p}setbuffer [min] [max] ➾ _Action Delay_
┃ 😈 ${s}goon [pass] ➾ _Restricted Access_
┃ 🚀 ${p}bcast [msg] ➾ _Global Broadcast_
┃ 🤖 ${p}listclones ➾ _List Sub-Bots_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐊𝐍𝐎𝐖𝐋𝐄𝐃𝐆𝐄 𝐁𝐀𝐒𝐄*
┃
┃ 📚 ${p}lyrics [song] ➾ _Fetch Lyrics_
┃ 📚 ${p}wiki [topic] ➾ _Wiki Summary_
┃ 📚 ${p}weather [city] ➾ _Weather Report_
┃ 📌 ${p}pint [query] ➾ _Pinterest Search_
┃ 📖 ${p}define [word] ➾ _Dictionary_
┃ 🔍 ${p}google [query] ➾ _Google Search_
┃ 🔗 ${p}shorten [url] ➾ _URL Shortener_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🎢 *𝐅𝐔𝐍 𝐙𝐎𝐍𝐄*
┃
┃ 💘 ${p}ship [@user] ➾ _Love Calculator_
┃ 👩‍❤️‍👨 ${p}match ➾ _Group Match Maker_
┃ 🌈 ${p}gaycheck ➾ _Gay Detector_
┃ 🎱 ${p}8ball [ask] ➾ _Magic 8-Ball_
┃ 🧠 ${p}truth ➾ _Truth Question_
┃ 🔥 ${p}dare ➾ _Dare Challenge_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🕹️ *𝐆𝐀𝐌𝐄 𝐀𝐑𝐂𝐀𝐃𝐄*
┃
┃ ❌ ${p}ttt [@user] ➾ _Tic-Tac-Toe_
┃ 💨 ${p}move [1-9] ➾ _Make Your Move_
┃ 🛑 ${p}ttt stop ➾ _End Active Game_
┃ ⚔️ ${p}bet @user [amt] ➾ _PvP Duel Challenge_
┃ 🎲 ${p}gamble [amt] ➾ _Multi-Level Luck_
┃ 🪙 ${p}coinflip [amt] ➾ _Double or Nothing_
┃ 🎰 ${p}slot [amt] ➾ _Galactic Jackpots_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 💰 *𝐄𝐂𝐎𝐍𝐎𝐌𝐘 𝐒𝐘𝐒𝐓𝐄𝐌*
┃
┃ 💎 ${p}balance ➾ _Check Wallet & Bank_
┃ 💳 *Bank Card:* _Universal Financial Routing_
┃ 🎁 ${p}daily ➾ _Daily Reward ($100)_
┃ 💼 ${p}work ➾ _Earn Money_
┃ 🏦 ${p}deposit <amt> ➾ _Save to Bank_
┃ 💵 ${p}withdraw <amt> ➾ _Take from Bank_
┃ 🎣 ${p}fish ➾ _Catch Fish (Rod Req)_
┃ ⛏️ ${p}mine / ${p}dig ➾ _Mine Gems_
┃ ⚔️ ${p}hunt ➾ _Hunt Creatures (Sword Req)_
┃ 🏪 ${p}shop ➾ _Buy Licenses & Badges_
┃ 🎒 ${p}inventory ➾ _Show Owned Items_
┃ 🛒 ${p}buy <item> ➾ _Purchase Items_
┃ 💵 ${p}sell <item> ➾ _Sell Items (50% Back)_
┃ 🧪 ${p}heal ➾ _Use Health Potion_
┃ 🎭 ${p}rob @user/house ➾ _Steal Money_
┃ 🎁 ${p}gift @user <amt> ➾ _Transfer Funds_
┃ 📋 ${p}tasks ➾ _View Daily Tasks_
┃ 🎁 ${p}claim ➾ _Claim Task Rewards_
┃ 🏦 ${p}loan <amt> ➾ _Request Bank Loan_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 📈 *MARKETS & ASSETS*
┃
┃ 📉 ${p}crypto ➾ _Market Prices & Trends_
┃ 💱 ${p}forex ➾ _Fiat Currency Market_
┃ 📉 ${p}buycrypto <coin> <amt> ➾ _Invest_
┃ 💱 ${p}buyfx <cur> <amt> ➾ _Buy Fiat_
┃ 📉 ${p}sellcrypto <coin> <amt> ➾ _Cash Out_
┃ 💱 ${p}sellfx <cur> <amt> ➾ _Sell Fiat_
┃ 🔄 ${p}convert <amt> <from> <to> ➾ _Swap_
┃ 📊 ${p}stock ➾ _Stock Market Trends_
┃ 📊 ${p}buystock <tkr> <amt> [coin] ➾ _Buy_
┃ 📊 ${p}sellstock <tkr> <amt> ➾ _Sell Shares_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🏆 *𝐒𝐎𝐂𝐈𝐀𝐋 & 𝐓𝐈𝐓𝐋𝐄𝐒*
┃
┃ 👥 ${p}census ➾ _List All Citizens_
┃ 🥇 ${p}rich ➾ _Elite Rich List_
┃ 🏆 ${p}leaderboard ➾ _Global Richest_
┃ 👤 ${p}profile [@user] ➾ _View Profile_
┃ ⚜️ ${p}titles ➾ _List Your Titles_
┃ 🎖️ ${p}equip <id> ➾ _Wear a Title_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🚀 *𝐇𝐎𝐒𝐓𝐈𝐍𝐆*
┃
┃ 🟢 ${p}host <number> ➾ _Deploy Sub-Bot_
┃ 🛑 ${p}stopbot ➾ _Stop Your Bot_
┃ 🗑️ ${p}logout ➾ _Delete Session_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 👑 *𝐆𝐑𝐎𝐔𝐏 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐈𝐓𝐄*
┃
┃ ⚔️ ${p}kick / ${p}add ➾ _Member Management_
┃ ⚔️ ${p}promote / ${p}demote ➾ _Role Control_
┃ 🎁 ${p}giveaway <amt> <cnt> ➾ _Host Event_
┃ 🛡️ ${p}warn [reason] ➾ _Strike System_
┃ 🛡️ ${p}warnings ➾ _Check Strikes_
┃ 🛡️ ${p}antilink [on/off] ➾ _Link Shield_
┃ 🛡️ ${p}welcome / ${p}goodbye ➾ _Join Logs_
┃ 🛡️ ${p}tempmod [@u] [time] ➾ _Temp Mod_
┃ ⚙️ ${p}group [open/close] ➾ _Gate Control_
┃ ⚙️ ${p}tagall / ${p}hidetag ➾ _Broadcasting_
┃ ⚙️ ${p}link / ${p}admins ➾ _Group Info_
┃ 🛡️ ${p}spam [on/off] ➾ _Strict Spam Mode_
┃
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐒𝐎𝐂𝐈𝐀𝐋 𝐍𝐄𝐓𝐖𝐎𝐑𝐊*
┃ 
┃ 📸 *IG:* star_flex3
┃ 🤖 *Bot:* Starry MD v2.1
┃
╰━━━━━━━━━━━━━━━━━━━

> _"The stars do not look down on us. They look through us."_
    `.trim();
};

module.exports = getMenu;
