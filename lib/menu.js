const config = require('../config');

/**
 * Box Menu Generator (Fancy Text UI)
 * Dynamic menu builder with Unicode box-drawing characters.
 * @param {string} mode - Current bot mode ($public, $private, etc.)
 * @returns {string} The formatted menu string.
 */
const getMenu = (mode) => {
    const totalCommands = 10; // Basic count for now (Pulse commands)
    const p = config.PREFIX_TOOL || '.';
    const s = config.PREFIX_SYSTEM || '$';

    return `
╭──────────────────────╮
│                      │
│      *《 STARRY MD 》* │
│                      │
╰──────────────────────╯

╭─────────────────────╮
│  📌 *BOT INFORMATION*
╰─────────────────────╯
│ *Prefix:* ${p}
│ *Mode:* ${mode.toUpperCase()}
│ *Commands:* ${totalCommands}
│ *Version:* 2.0.0 (Rebirth)
╰─────────────────────╯

╭──────────────────────╮
│  🛡️ *THE SHIELD*
╰──────────────────────╯
│ ❄️ Rate Limit: ACTIVE
│ 🤝 Handshake: PLANNED
│ 🆔 ID Sync: PASSIVE
╰──────────────────────╯

╭──────────────────────╮
│  🚀 *WEAPONRY*
╰──────────────────────╯
│ ${p}ping - Check Star-Link
│ ${p}menu - Open Star-Map
│ ${p}ai - AI Intel [OFFLINE]
│ ${p}s - Sticker Forge [OFFLINE]
│ ${p}hunt - Anti-Del [PLANNED]
╰──────────────────────╯

╭──────────────────────╮
│  🛠️ *DIAGNOSTICS (OWNER)*
╰──────────────────────╯
│ ${p}runtime - Uptime Check
│ ${p}sys - Host Stats
│ ${p}db - Database Health
╰──────────────────────╯

╭──────────────────────╮
│  ⚙️ *SYSTEM (OWNER)*
╰──────────────────────╯
│ ${s}public - Set Public
│ ${s}private - Set Private
│ ${s}sleep - Set Sleep [MSG]
╰──────────────────────╯

💡 _Starry MD 2.0: Rebirth Protocol_
    `.trim();
};

module.exports = getMenu;
