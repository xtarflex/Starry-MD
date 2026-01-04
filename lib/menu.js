const config = require('../config');
const os = require('os');

/**
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

╭━━ 🛡️ *𝐆𝐔𝐀𝐑𝐃𝐈𝐀𝐍 𝐏𝐑𝐎𝐓𝐎𝐂𝐎𝐋𝐒*
┃ 
┃ 🌌 ${p}alive ➾ _Heartbeat Check_
┃ 🌌 ${p}save [me/dm] ➾ _Capture Status_
┃ 🌌 ${p}vv ➾ _Decrypt ViewOnce_
┃ 🌌 ${p}hunt [list] ➾ _Anti-Delete Trace_
┃ 🌌 ${p}reveal ➾ _Expose Deleted Msg_
┃ 🌌 ${p}huntbuffer ➾ _Set Buffer Time_
┃ 🌌 ${p}ping ➾ _Latency Pulse_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🤖 *𝐀𝐈 𝐂𝐎𝐑𝐄* (Groq-Powered)
┃
┃ 🧠 ${p}ai [text] ➾ _Default AI_
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
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🎨 *𝐌𝐄𝐃𝐈𝐀 𝐅𝐎𝐑𝐆𝐄*
┃
┃ 🛸 ${p}sticker / ${p}s ➾ _Create Sticker_
┃ 🛸 ${p}toimg ➾ _Sticker to Image_
┃ 🛸 ${p}tovideo ➾ _Animated to MP4_
┃ 🛸 ${p}ssteal ➾ _Steal Sticker Meta_
┃ 🛸 ${p}doge / ${p}cat ➾ _Animal Sticker_
┃ 🛸 ${p}meme [text] ➾ _Image Meme_
┃ 🛸 ${p}wasted ➾ _GTA Overlay_
┃ 🛸 ${p}tourl ➾ _Media to Link_
┃
╰━━━━━━━━━━━━━━━━━━━
 
╭━━ 🎵 *𝐀𝐔𝐃𝐈𝐎 𝐋𝐀𝐁* (FFmpeg)
┃
┃ 🎧 ${p}play [query] ➾ _YT Music DL_
┃ 🎧 ${p}yts [query] ➾ _YT Search List_
┃ 🎧 ${p}tovn ➾ _Message to PTT_
┃ 🎧 ${p}fast / ${p}slow ➾ _Speed Shift_
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
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🕹️ *𝐂𝐎𝐍𝐓𝐑𝐎𝐋 𝐂𝐄𝐍𝐓𝐄𝐑* (Owner)
┃
┃ ⚙️ ${s}public ➾ _Public Mode_
┃ ⚙️ ${s}private ➾ _Private Mode_
┃ ⚙️ ${s}sleep ➾ _Sleep Mode_
┃ ⚙️ ${p}setbio [text] ➾ _Set Bio_
┃ ⚙️ ${p}autobio [on/off] ➾ _Auto Bio Toggle_
┃ ⚙️ ${p}vvmode [chat/save] ➾ _ViewOnce Mode_
┃ ⚙️ ${p}addreact [emoji] [word] ➾ _Add Reaction_
┃ ⚙️ ${p}delreact [word] ➾ _Delete Reaction_
┃ ⚙️ ${p}listreact ➾ _List Reactions_
┃ ⚙️ ${p}setsched [hours] ➾ _Status Schedule_
┃ ⚙️ ${p}setbuffer [min] [max] ➾ _Action Delay_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐊𝐍𝐎𝐖𝐋𝐄𝐃𝐆𝐄 𝐁𝐀𝐒𝐄*
┃
┃ 📚 ${p}lyrics [song] ➾ _Fetch Lyrics_
┃ 📚 ${p}wiki [topic] ➾ _Wiki Summary_
┃ 📚 ${p}weather [city] ➾ _Weather Report_
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
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 👑 *𝐆𝐑𝐎𝐔𝐏 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐈𝐓𝐄*
┃
┃ === Member Management ===
┃ ⭐ ${p}tempmod [@user] ➾ _Short-Term Mod_
┃ ⭐ ${p}kick [@user] ➾ _Remove Member_
┃ ⭐ ${p}add [number] ➾ _Add Member_
┃ ⭐ ${p}promote [@user] ➾ _Elevate User_
┃ ⭐ ${p}demote [@user] ➾ _Demote Admin_
┃ ⭐ ${p}warn [@user] ➾ _Issue Strike_
┃ ⭐ ${p}unwarn [@user] ➾ _Remove Strike_
┃ ⭐ ${p}warnings [@user] ➾ _Check Strikes_
┃
┃ === Group Environment ===
┃ 🔐 ${p}group [open/close] ➾ _Mute/Unmute_
┃ 📝 ${p}setname [text] ➾ _Rename Group_
┃ 🔗 ${p}link ➾ _Invite Link_
┃ 👥 ${p}mem ➾ _Member Stats_
┃ 📢 ${p}hidetag [text] ➾ _Ghost Mention All_
┃ 📢 ${p}tagall [text] ➾ _Visible Tag All_
┃ 📢 ${p}admins ➾ _Ping Admin Team_
┃
┃ === Security & Gates ===
┃ 🛡️ ${p}antilink [on/off] ➾ _Anti-Invite_
┃ 👋 ${p}welcome [on/off] ➾ _Greeting Gate_
┃ 🔕 ${p}goodbye [on/off] ➾ _Departure Gate_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐒𝐎𝐂𝐈𝐀𝐋 𝐍𝐄𝐓𝐖𝐎𝐑𝐊*
┃ 
┃ 📸 *IG:* star_flex3
┃ 🤖 *Bot:* Starry MD v2.0
┃
╰━━━━━━━━━━━━━━━━━━━

> _"The stars do not look down on us. They look through us."_
    `.trim();
};

module.exports = getMenu;
