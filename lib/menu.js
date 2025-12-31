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
┃ 👨‍💻 *Pilot:* Starry Xander
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
┃ 🌌 ${p}save ➾ _Capture Status_
┃ 🌌 ${p}vv ➾ _Decrypt ViewOnce (PLN)_
┃ 🌌 ${p}hunt ➾ _Anti-Delete Trace_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🔧 *𝐀𝐑𝐒𝐄𝐍𝐀𝐋 (𝐓𝐎𝐎𝐋𝐒)*
┃
┃ 🛸 ${p}ai ➾ _Gemini Core (Active)_
┃ 🛸 ${p}sticker ➾ _Media Forge_
┃ 🛸 ${p}ping ➾ _Latency Pulse_
┃ 🛸 ${p}menu ➾ _Neural Map_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 📂 *𝐂𝐎𝐍𝐓𝐀𝐂𝐓 𝐁𝐑𝐈𝐃𝐆𝐄*
┃
┃ 🪪 ${p}vcard ➾ _Share My Intel_
┃ 🪪 ${p}botvcard ➾ _System ID_
┃ 🪪 ${p}sv ➾ _Save Contact (Owner)_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🛠️ *𝐃𝐈𝐀𝐆𝐍𝐎𝐒𝐓𝐈𝐂𝐒 (𝐎𝐖𝐍𝐄𝐑)*
┃
┃ 📊 ${p}runtime ➾ _Core Uptime_
┃ 📊 ${p}sys ➾ _Host Metrics_
┃ 📊 ${p}db ➾ _Data Integrity_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🕹️ *𝐂𝐎𝐍𝐓𝐑𝐎𝐋 𝐂𝐄𝐍𝐓𝐄𝐑*
┃
┃ ⚙️ ${s}public ➾ _Diplomacy Mode_
┃ ⚙️ ${s}private ➾ _Stealth Mode_
┃ ⚙️ ${s}sleep ➾ _Auto-Pilot_
┃ ⚙️ ${p}setbio ➾ _Remote Bio Update_
┃ ⚙️ ${p}autobio ➾ _Pulse Bio [ON/OFF]_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 👑 *𝐆𝐑𝐎𝐔𝐏 𝐂𝐎𝐌𝐌𝐀𝐍𝐃*
┃
┃ ⚡ ${p}tagall ➾ _Pulse Wave_
┃ ⚡ ${p}kick ➾ _Eject User_
┃ ⚡ ${p}warn ➾ _System Strike_
┃ ⚡ ${p}mute ➾ _Silence Comms_
┃ ⚡ ${p}unmute ➾ _Restore Comms_
┃ ⚡ ${p}antilink ➾ _Barrier Logic_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐒𝐎𝐂𝐈𝐀𝐋 𝐍𝐄𝐓𝐖𝐎𝐑𝐊*
┃ 
┃ 📸 *IG:* star_flex3
┃ 🐙 *Git:* https://github.com/xtarflex
┃
╰━━━━━━━━━━━━━━━━━━━

> _"The stars do not look down on us. They look through us."_
    `.trim();
};

module.exports = getMenu;
