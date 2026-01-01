const config = require('../config');

/**
 * Generate detailed help documentation
 */
module.exports = () => {
    const p = config.PREFIX_TOOL || '.';
    const s = config.PREFIX_SYSTEM || '$';

    return `🌌 *STARRY MD 2.0 - HELP GUIDE*

╭━━━━━━━━━━━━━━━━━━━
┃ 📖 *BOT RULES & LAWS*
╰━━━━━━━━━━━━━━━━━━━

🔒 *PRIVACY LAWS*
• Owner-only commands require authentication
• Saved Messages commands work only in your DM
• Group commands respect admin hierarchy

⚡ *USAGE RULES*
• Tool commands use prefix: ${p}
• System modes use prefix: ${s}
• Commands are case-insensitive
• Quote messages for context commands

🛡️ *ANTI-SPAM PROTOCOL*
• Handshake system for unknown contacts
• Auto-block for repeated violations
• Rate limiting on AI requests

╭━━━━━━━━━━━━━━━━━━━
┃ 🎯 *COMMAND CATEGORIES*
╰━━━━━━━━━━━━━━━━━━━

📂 *CONTACT BRIDGE*
Manage contacts and vCards

📊 *STATUS & ANALYTICS*
Track status posters and stats

🛠️ *DIAGNOSTICS*
System monitoring (owner only)

🕹️ *CONTROL CENTER*
Bot configuration and settings

👑 *GROUP COMMANDS*
Admin and member management

╭━━━━━━━━━━━━━━━━━━━
┃ 📝 *LATEST UPDATES*
╰━━━━━━━━━━━━━━━━━━━

v2.0.3 (2026-01-01)
✅ Status tracking & analytics
✅ Group member commands
✅ Log management system

v2.0.2 (2026-01-01)
✅ Sticker WebP + metadata thief
✅ Contact pagination
✅ Block/unblock/report

v2.0.1 (2026-01-01)
✅ Fireproof contact sync
✅ Multi-word reactions
✅ Status scheduler

╭━━━━━━━━━━━━━━━━━━━
┃ 💡 *QUICK START*
╰━━━━━━━━━━━━━━━━━━━

1. Type ${p}menu for command list
2. Type ${p}ping to test bot
3. Type ${p}help for this guide
4. Owner: Use ${s}private for stealth

╭━━━━━━━━━━━━━━━━━━━
┃ 🔧 *SUPPORT*
╰━━━━━━━━━━━━━━━━━━━

Report bugs: ${p}request <description>
View requests: ${p}pullreq (owner)
Check logs: ${p}logs (owner)

━━━━━━━━━━━━━━━━━━━━
🌠 *Starry MD v2.0*
Built with ❤️ by Starry Team
━━━━━━━━━━━━━━━━━━━━`;
};
