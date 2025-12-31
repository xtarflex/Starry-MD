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
┃ 🌌 ${p}save ➾ _Steal Status_
┃ 🌌 ${p}vv ➾ _Decrypt ViewOnce_
┃ 🌌 ${p}hunt ➾ _Ghost Log_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🔧 *𝐀𝐑𝐒𝐄𝐍𝐀𝐋 (𝐓𝐎𝐎𝐋𝐒)*
┃
┃ 🛸 ${p}ai ➾ _Gemini Mind_
┃ 🛸 ${p}sticker ➾ _Media Forge_
┃ 🛸 ${p}ping ➾ _Latency Check_
┃ 🛸 ${p}menu ➾ _Neural Map_
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
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 👑 *𝐆𝐑𝐎𝐔𝐏 𝐂𝐎𝐌𝐌𝐀𝐍𝐃*
┃
┃ ⚡ ${p}tagall ➾ _Pulse Wave_
┃ ⚡ ${p}kick ➾ _Eject User_
┃ ⚡ ${p}warn ➾ _System Strike_
┃
╰━━━━━━━━━━━━━━━━━━━

╭━━ 🌐 *𝐒𝐎𝐂𝐈𝐀𝐋 𝐍𝐄𝐓𝐖𝐎𝐑𝐊*
┃ 
┃ 📸 *IG:* star_flex3
┃ 🐙 *Git:* https://github.com/Starry-MD
┃
╰━━━━━━━━━━━━━━━━━━━

> _"The stars do not look down on us. They look through us."_
    `.trim();
};

module.exports = getMenu;
