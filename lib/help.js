const config = require('../config');

/**
 * Generate comprehensive help documentation with detailed command examples
 * @param {string} category - Optional category filter (ai, media, group, owner, status, etc.)
 * @returns {string} Formatted help documentation
 */
module.exports = (category = 'all') => {
    const p = config.PREFIX_TOOL || '.';
    const s = config.PREFIX_SYSTEM || '$';

    // If specific category requested
    if (category && category !== 'all') {
        return getCategoryHelp(category, p, s);
    }

    // Full comprehensive help guide
    return `
╔═══════════════════════════════╗
║  📚 STARRY MD 2.0 - HELP GUIDE  ║
╚═══════════════════════════════╝

🌟 *WELCOME TO STARRY MD!*
This is a comprehensive guide to all bot features.
For quick commands, use ${p}menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 *HOW TO USE THIS GUIDE*

• Type ${p}help ai - AI commands guide
• Type ${p}help media - Media / Sticker tools
• Type ${p}help audio - Audio Lab / FFmpeg
• Type ${p}help group - Group management
• Type ${p}help owner - Owner commands
• Type ${p}help status - Status features
• Type ${p}help info - Information tools
• Type ${p}help fun - Fun & Games
• Type ${p}help faq - Common questions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *QUICK REFERENCE*

*BASIC COMMANDS*
${p}ping - Test bot response time
${p}alive - Check bot status
${p}menu - View command list
${p}help - This detailed guide

*AI FEATURES*
${p}ai <text> - Chat with Groq AI
${p}yuki <text> - Bratty tsundere
${p}fizz <text> - Chaotic gen-z
${p}jax <text> - Toxic gamer
${p}ren <text> - Sleepy loner
${p}bella <text> - Delusional influencer
${p}rude <text> - Sarcastic AI persona
${p}tech <text> - Tech expert AI

*MEDIA TOOLS*
${p}sticker - Create sticker (Img/Vid)
${p}toimg - Convert sticker to Image
${p}tovideo - Animated sticker to MP4
${p}ssteal - Steal sticker metadata
${p}doge / ${p}cat - Random animal sticker
${p}meme - Image meme generator
${p}wasted - GTA Wasted effect
${p}tourl - Host media to link
${p}vv - Reveal view-once media

*STATUS FEATURES*
${p}save - Save status to current chat
${p}save me - Save to your DM
${p}statusinfo - View status bot stats

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔰 *GETTING STARTED*

1️⃣ *Test the bot*
   ${p}ping

2️⃣ *Try AI chat*
   ${p}ai Hello, how are you?

3️⃣ *Create a sticker*
   Send an image, then reply with ${p}sticker

4️⃣ *Save a status*
   Quote a status message and type ${p}save

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *BOT MODES*

${s}public - Everyone can use the bot
${s}private - Only owner can use
${s}sleep - Bot ignores all commands

*Current Mode:* Check with ${p}menu

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ *PRIVACY & SECURITY*

✅ Your messages are not stored
✅ AI conversations are private
✅ Status viewing is anonymous
✅ Contact sync is encrypted

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *PRO TIPS*

• Quote messages for context commands
• Use ${p}vcard to share your contact
• Set auto-reactions with ${p}addreact
• Block spam with ${p}block

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆘 *NEED MORE HELP?*

Type ${p}help <category> for detailed guides:
• ${p}help ai
• ${p}help media
• ${p}help group
• ${p}help owner
• ${p}help faq

Report bugs: ${p}request <description>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌠 Starry MD v2.0 | Built with ❤️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
};

/**
 * Get detailed help for specific category
 */
function getCategoryHelp(category, p, s) {
    const guides = {
        ai: getAIHelp(p),
        media: getMediaHelp(p),
        audio: getAudioHelp(p),
        group: getGroupHelp(p),
        owner: getOwnerHelp(p, s),
        status: getStatusHelp(p),
        info: getInfoHelp(p),
        fun: getFunHelp(p),
        game: getGameHelp(p),
        faq: getFAQHelp(p, s)
    };

    return guides[category.toLowerCase()] || `❌ Unknown category: ${category}\n\nAvailable: ai, media, group, owner, status, info, fun, game, faq`;
}

function getAIHelp(p) {
    return `
╔═══════════════════════════════╗
║     🤖 AI COMMANDS GUIDE        ║
║    (Powered by Groq AI)        ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧠 *BASIC AI CHAT*

${p}ai <your message>
• Chat with ultra-fast Groq AI
• Smart model routing (8B/70B)
• WhatsApp-optimized responses
• Typing simulation included

*Example:*
${p}ai What is quantum physics?
${p}ai Tell me a joke

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎭 *HUMAN-LIKE PERSONAS*

These personas act like REAL people, not helpful AI:

${p}yuki <text> 😾
• Bratty tsundere cat girl
• Mean but secretly caring
• "ugh why are u tagging me baka"

${p}fizz <text> 💀
• Chaotic gen-z brainrot
• aLtErNaTiNg CaPs
• "bro thinks im chatgpt 💀"

${p}jax <text> 🎮
• Toxic gamer bro
• Arrogant and blunt
• "get good kid, skill issue"

${p}ren <text> 😴
• Sleepy depressed loner
• Low energy, apathetic
• "sigh... too tired..."

${p}bella <text> ✨
• Delusional influencer
• Narcissistic and self-obsessed
• "omg look at me ✨"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌟 *CLASSIC PERSONAS*

${p}tech <text> 🔧
• Expert technical advice
• Concise and precise
• Programming and tech help

${p}uwu <text> 💕
• Cute anime-style responses
• Kawaii personality
• "~uwu senpai!"

${p}mom <text> 👩
• Caring and nurturing
• Gives life advice
• "Take care, sweetie!"

${p}pirate <text> 🏴‍☠️
• Talks like a sea captain
• Adventure-seeking
• "Arrr matey!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ *SMART FEATURES*

✅ Auto model selection:
   • Simple queries → Fast 8B model
   • Complex queries → Smart 70B model

✅ Typing simulation:
   • Shows "typing..." while generating
   • Realistic delays

✅ WhatsApp-optimized:
   • 2-3 sentence responses
   • No long explanations
   • Chat-style format

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *AI SETTINGS*

${p}aitoggle
• Toggle AI responses to mentions/tags
• Set which persona responds
• Owner-only command

*Usage:*
${p}aitoggle - Show current status
${p}aitoggle on - Enable AI mentions
${p}aitoggle off - Disable AI mentions
${p}aitoggle yuki - Set persona to yuki

*How it works:*
• When ON: Bot uses AI to respond to @mentions
• When OFF: You can chat normally when mentioned
• Commands (.ai, .yuki, etc.) always work

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *AI-POWERED HELP*

${p}help <your question>
• Ask questions about bot commands
• AI explains using help docs
• Natural language queries

*Examples:*
${p}help how do I save status?
${p}help what is hunt command?
${p}help how to use personas?

*Why it's cool:*
• No need to read long docs
• Ask in your own words
• Get instant explanations
• Powered by help documentation

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *PRO TIPS*

• Human personas break the "helpful AI" illusion
• High temperature (0.95) for unpredictability
• Each persona has unique typing style
• Try different personas for different moods
• Works in groups and DMs
• Use .aitoggle to control mention responses
• Ask .help anything about the bot

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getMediaHelp(p) {
    return `
╔═══════════════════════════════╗
║    🎨 MEDIA COMMANDS GUIDE      ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖼️ *CREATE STICKERS*

${p}sticker (quote image/video)
${p}s (quote image/video)
• Converts media to sticker
• Works with images and videos
• Adds your metadata

*Basic Usage:*
1. Send or quote an image
2. Reply with ${p}sticker

*Advanced Sticker Conversion:*
${p}toimg (quote sticker)
• Convert static sticker → JPG

${p}tovideo / ${p}mp4 (quote sticker)
• Convert animated sticker → MP4

${p}doge / ${p}cat
• Get a random animal sticker

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 *IMAGE UTILITIES*

${p}meme <top text> | <bottom text>
• Adds impact font to images
• Centered and capitalized
• Requires | separator

${p}wasted (quote image)
• Applies GTA death effect
• Grayscale + Red tint + Text

${p}tourl (quote image/video)
• Uploads media to Telegra.ph
• Safe, public, and permanent link
• Perfect for sharing big files

*Custom Metadata:*
${p}sticker Pack Name|Author Name
• Sets custom pack and author
• Shows when tapped

*Example:*
${p}sticker My Pack|Starry
${p}s Funny Memes|Me

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥷 *STEAL STICKERS*

${p}ssteal (quote sticker)
${p}steal (quote sticker)
• Downloads any sticker
• Re-brands with YOUR metadata
• Works on static & animated

*Usage:*
1. Quote any sticker
2. Type ${p}ssteal
3. Bot sends it with your name

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👁️ *VIEW-ONCE REVEAL*

${p}vv (quote view-once)
• Reveals view-once media
• Saves to chat or DM based on mode
• Works on images and videos

*Usage:*
1. Quote a view-once message
2. Type ${p}vv
3. Bot reveals the media

*View-Once Modes:*
${p}vvmode chat - Send to current chat
${p}vvmode dm - Send to user's DM (recommended for groups)
${p}vvmode save - Send to owner's DM
${p}vvmode private - Owner only

*Smart Routing:*
• In 'save' mode: Owner gets in their DM, others get in their own DM
• Spam prevention: Max 3 requests per 5min in groups
• Auto-tells users to DM bot if too many requests

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 *ANTI-DELETE (HUNT SYSTEM)*

${p}hunt
• Toggle hunt on/off for current chat
• Monitors deleted messages
• Forwards to your DM with details

${p}hunt list
• View all hunted chats
• Shows current monitoring status

${p}reveal (quote hunt alert)
• Exposes deleted message in original chat
• Quote the hunt alert from your DM
• Posts deleted content publicly

${p}huntbuffer <minutes>
• Set buffer duration (1-60 min)
• Default: 10 minutes
• Messages kept in memory for this long

*How it works:*
1. Enable hunt in a chat
2. Someone deletes a message
3. Bot sends subtle alert in chat (e.g., "*coughs* 👀")
4. You get detailed alert in DM with ID
5. Quote DM alert and use ${p}reveal
6. Deleted message exposed in chat

*Subtle Alerts:*
• "*coughs* 👀"
• "*clears throat* 🤔"
• "*hmm* 🧐"
• "*interesting* 👁️"
• "*noted* 📝"
(Random, only owner knows what it means)

*Perfect for:*
• Accountability in groups
• Catching liars
• Evidence preservation
• Subtle monitoring

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *MEDIA TIPS*

✅ Stickers: Max 512x512px
✅ Videos: Under 6 seconds
✅ Metadata shows when tapped
✅ View-once: Quote before opening

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getAudioHelp(p) {
    return `
╔═══════════════════════════════╗
║    🎵 AUDIO LAB GUIDE         ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎧 *YOUTUBE MUSIC (.play)*

${p}play <song title or link>
• Downloads high-quality MP3
• Fast search & cosmic fetch
• Works with any song

*Example:*
${p}play Blinding Lights
${p}play https://youtu.be/xxx

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 *YOUTUBE SEARCH (.yts)*

${p}yts <query>
• Shows top 5 song results
• Includes duration and links
• Perfect for finding covers

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎙️ *VOICE NOTE CONVERTER (.tovn)*

${p}tovn (quote audio/video)
• Converts any media to a WhatsApp "PTT" Voice Note
• Shows realistic waveform
• Playable as if recorded live

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ *SPEED FILTERS*

${p}fast (quote audio)
• Increases speed to 1.5x
• Keeps pitch natural

${p}slow (quote audio)
• Decreases speed to 0.7x
• Deep, atmospheric sound

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *AUDIO TIPS*

✅ Files sent as MP3 for compatibility
✅ Voice notes sent as Opus for WhatsApp
✅ Max file size limit: 20MB
✅ Processing takes 2-5 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getGroupHelp(p) {
    return `
╔═══════════════════════════════╗
║   👑 GROUP ADMIN SUITE GUIDE    ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *MEMBER MANAGEMENT*

${p}tempmod @user <duration> <cmds>
• Grant temporary admin powers
• Duration: 30m, 1h, 2d (max 24h)
• Cmds: kick,warn or all
• Example: ${p}tempmod @user 1h kick,warn

${p}kick @user
• Remove member from group
• Protection: Can't kick owner/admins

${p}add <number>
• Add member via phone number
• Example: ${p}add 2348012345678

${p}promote @user
• Make user a group admin

${p}demote @user
• Remove admin status

${p}warn @user [reason]
• Issue a warning strike
• Auto-kicks at 3/3 strikes

${p}unwarn @user
• Remove one warning strike

${p}warnings @user
• Check strikes for any user

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 *GROUP ENVIRONMENT*

${p}group open/close
• Unlock/Lock chat (Public/Admin only)

${p}setname <text>
• Change group name instantly

${p}link
• Get current group invite link

${p}mem
• Detailed group statistics
• Total/Admins/Regular counts

${p}hidetag <text>
• Mention all members invisibly
• Perfect for sneaky alerts

${p}tagall <text>
• Mention all members visibly
• Adds user list to message

${p}admins
• Tag only the admin team (PUBLIC)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ *SECURITY & AUTOMATION*

${p}antilink on/off
• Auto-kick users sending group links
• Owner-only toggle

${p}welcome on/off
• Toggle greeting for new members
• Owner-only toggle

${p}goodbye on/off
• Toggle departure messages
• Owner-only toggle

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *REQUIREMENTS*

✅ Bot must be admin for kicks/settings
✅ You must be Admin or Owner
✅ Temp admins have limited access
✅ Kicking owner/admins is blocked

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getOwnerHelp(p, s) {
    return `
╔═══════════════════════════════╗
║   🕹️ OWNER COMMANDS GUIDE       ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 *BOT MODES*

${s}public
• Everyone can use bot
• All commands available
• Default mode

${s}private
• Only owner can use
• Others get no response
• Stealth mode

${s}sleep
• Bot ignores all commands
• Complete shutdown
• Emergency mode

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *BOT CONFIGURATION*

${p}setbio <text>
• Sets WhatsApp bio
• Updates immediately
• Max 139 characters

${p}autobio on
• Auto-updates bio hourly
• Shows uptime
• Dynamic status

${p}autobio off
• Disables auto-bio
• Keeps current bio

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎭 *AUTO-REACTIONS*

${p}addreact <emoji> <keyword>
• Auto-react to keywords
• Case-insensitive
• Full word match

*Example:*
${p}addreact 🎉 happy
${p}addreact 😂 lol

${p}delreact <keyword>
• Removes reaction rule

${p}listreact
• Shows all reactions

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *STATUS BOT SETTINGS*

${p}setsched <hours>
• Sets status check interval
• Default: 2 hours
• Range: 1-24 hours

*Example:*
${p}setsched 3

${p}setbuffer <min> <max>
• Sets action delays
• Prevents spam detection
• In seconds

*Example:*
${p}setbuffer 2 5

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️ *SYSTEM TOOLS*

${p}sys
• System statistics
• RAM, CPU usage
• Platform info

${p}runtime
• Bot uptime
• Connection status

${p}logs
• View recent logs
• Debug information

${p}pullreq
• View feature requests
• User feedback

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 *USER MANAGEMENT*

${p}block (quote user)
• Blocks a user
• They can't use bot

${p}unblock (quote user)
• Unblocks a user

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *OWNER TIPS*

• Use ${s}private in public
• Monitor logs regularly
• Set reactions for engagement
• Adjust buffer to avoid bans

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getStatusHelp(p) {
    return `
╔═══════════════════════════════╗
║   📊 STATUS FEATURES GUIDE      ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 *SAVE STATUS*

${p}save (quote status)
• Saves to current chat
• Works on images, videos, text
• Anonymous viewing

${p}save me (quote status)
• Saves to your DM
• Private collection
• No one knows you saved

*Usage:*
1. Quote a status message
2. Type ${p}save or ${p}save me
3. Bot downloads and sends

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 *MANUAL STATUS VIEWING*

${p}vs (quote status notification)
• Manually view & like specific user's statuses
• Works on status notifications in your DM
• Processes all pending statuses from that user

${p}alpha
• Batch process ALL pending statuses
• Views 75%, likes 40% of viewed
• Clears database after processing

*How .vs works:*
1. Bot sends you status notifications
2. Quote the notification in your DM
3. Type ${p}vs
4. Bot views & likes all statuses from that user

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ *VIP AUTO-VIEW*

${p}statvip
• View VIP list
• Priority viewing
• Auto-like enabled

${p}statvip add @user
• Adds user to VIP
• Their statuses viewed & liked IMMEDIATELY
• No waiting for schedule

${p}statvip remove @user
• Removes from VIP

*How VIP works:*
• VIP statuses are processed instantly
• Automatically viewed & liked
• Not added to bulk queue
• Perfect for close friends

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔔 *NOTIFICATIONS*

${p}statusnotify
• Toggle status alerts
• Get notified of new statuses
• Owner only

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *HOW IT WORKS*

1. Bot receives status notifications
2. VIP statuses → Viewed & liked immediately
3. Others → Saved to database
4. Scheduled batch processing (every 2 hours)
5. Or manual with ${p}vs / ${p}alpha

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *STATUS TIPS*

• Save before status expires (24h)
• Use "save me" for privacy
• Add close friends to VIP for instant views
• Use ${p}vs on notifications for manual control
• ${p}alpha processes entire queue at once

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getFAQHelp(p, s) {
    return `
╔═══════════════════════════════╗
║        ❓ FAQ & TROUBLESHOOTING   ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ *COMMON QUESTIONS*

Q: Bot not responding?
A: Check bot mode with ${p}menu
   Owner can use ${s}public

Q: Commands not working?
A: Make sure you use correct prefix
   Tool commands: ${p}
   System modes: ${s}

Q: Sticker has no metadata?
A: Use ${p}ssteal to re-brand it
   Metadata shows when tapped

Q: Can't save status?
A: Quote the status message first
   Then type ${p}save

Q: AI not remembering context?
A: Context lasts 10 messages
   Start new topic with ${p}ai

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 *TROUBLESHOOTING*

*Bot is slow:*
• Check ${p}ping for latency
• High traffic may cause delays
• Wait a few seconds

*Commands fail:*
• Verify you're not blocked
• Check if bot is admin (groups)
• Ensure correct syntax

*Media not working:*
• File size limits apply
• Videos: max 6 seconds
• Images: max 5MB

*Status save fails:*
• Status may have expired
• Quote before it disappears
• Check bot permissions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *ERROR MESSAGES*

"❌ Owner only"
→ Command requires owner privileges

"❌ Admin only"
→ You need admin rights

"❌ Quote a message"
→ Reply to a message first

"❌ Invalid syntax"
→ Check command format

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ *PRIVACY & SAFETY*

Q: Is my data stored?
A: No, messages are not saved

Q: Can others see my AI chats?
A: No, conversations are private

Q: Is status viewing anonymous?
A: Yes, completely anonymous

Q: Who can see saved statuses?
A: Only you (if using "save me")

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *BEST PRACTICES*

✅ Use ${p}help for guidance
✅ Test with ${p}ping first
✅ Quote messages for context
✅ Report bugs with ${p}request
✅ Check ${p}menu for quick ref

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 *STILL NEED HELP?*

Report issues:
${p}request <description>

Contact owner:
Check ${p}menu for social links

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getInfoHelp(p) {
    return `
╔═══════════════════════════════╗
║    🌐 KNOWLEDGE BASE GUIDE      ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *SONG LYRICS*

${p}lyrics <song name>
• Fetches full song lyrics
• Auto-searches multiple sources
• Works with most popular songs

*Basic Usage:*
${p}lyrics Bohemian Rhapsody
${p}lyrics Shape of You

*Pro Tips:*
• Add artist name for better results:
  ${p}lyrics Queen Bohemian Rhapsody
• Works with song titles in any language
• If not found, try different spelling

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 *WIKIPEDIA SEARCH*

${p}wiki <topic>
${p}wikipedia <topic>
• Instant Wikipedia summaries
• Includes thumbnail images
• Direct link to full article

*Examples:*
${p}wiki Quantum Physics
${p}wiki Elon Musk
${p}wiki Tokyo

*How it works:*
1. Fetches article summary
2. Shows thumbnail if available
3. Provides link to full article

*Tips:*
• Capitalize proper nouns for best results
• Use exact article titles when possible
• Works with any Wikipedia topic

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌤️ *WEATHER REPORTS*

${p}weather <city>
• Live weather conditions
• Visual weather card with image
• Temperature, wind, humidity

*Examples:*
${p}weather London
${p}weather New York
${p}weather Tokyo

*What you get:*
• Current conditions (Sunny, Rainy, etc.)
• Temperature in Celsius
• Wind speed and direction
• Humidity percentage
• Beautiful weather visualization

*Features:*
✅ Real-time data from wttr.in
✅ Works for any city worldwide
✅ Metric units (Celsius, km/h)
✅ Visual weather card image

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *INFO TIPS*

• All commands work in groups and DMs
• Results are instant (1-2 seconds)
• No API keys required
• Free and unlimited usage

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getFunHelp(p) {
    return `
╔═══════════════════════════════╗
║       🎢 FUN ZONE GUIDE         ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💘 *SHIP - LOVE CALCULATOR*

${p}ship <@user>
${p}ship <@user1> <@user2>
• Creates love compatibility image
• Shows match percentage (1-100%)
• Combines profile pictures

*Usage:*
${p}ship @friend
  → Ships you with mentioned user

${p}ship @user1 @user2
  → Ships two mentioned users

*How it works:*
1. Fetches both profile pictures
2. Creates composite image
3. Generates random compatibility %
4. Adds fun comment based on score

*Score Tiers:*
• 90%+ = Perfect Match! 💍
• 70%+ = Hot Couple! 🔥
• 50%+ = Looking Good! 😘
• Below 50% = Maybe not... 💀

━━━━━━━━━━━━━━━━━━━━━━━━━━━

👩‍❤️‍👨 *MATCH MAKER*

${p}match
${p}couple
• Randomly picks 2 group members
• Creates a "couple" announcement
• Fun group engagement tool

*Requirements:*
✅ Group chat only
✅ At least 2 members

*Example Output:*
"New Couple Alert! 🔔
👉 @Alice & @Bob"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌈 *GAY CHECK*

${p}gaycheck
${p}gaycheck <@user>
${p}gay <@user>
• Random percentage generator
• Classic bot joke command
• Just for fun!

*Usage:*
${p}gaycheck
  → Checks yourself

${p}gaycheck @friend
  → Checks mentioned user

*Note:* This is purely random and for entertainment only!

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎱 *MAGIC 8-BALL*

${p}8ball <question>
• Ask yes/no questions
• Get mystical answers
• Classic fortune telling

*Examples:*
${p}8ball Will I pass my exam?
${p}8ball Should I buy this?
${p}8ball Is today my lucky day?

*Possible Answers:*
• Positive: "Yes, definitely", "It is certain"
• Uncertain: "Ask again later", "Cannot predict"
• Negative: "Don't count on it", "My sources say no"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧠 *TRUTH OR DARE*

${p}truth
• Get a random truth question
• Perfect for group games
• 9+ unique questions

${p}dare
• Get a random dare challenge
• Fun group activities
• 7+ unique dares

*Example Questions:*
• "What is your biggest fear?"
• "Who is your crush?"
• "What's your most embarrassing moment?"

*Example Dares:*
• "Send a voice note singing a song"
• "Post your funniest selfie"
• "Change your bio for 24 hours"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *FUN ZONE TIPS*

• All commands are instant
• Ship works with any 2 users
• Match is group-only
• Truth/Dare perfect for parties
• 8-Ball for decision making

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getGameHelp(p) {
    return `
╔═══════════════════════════════╗
║     🕹️ GAME ARCADE GUIDE        ║
╚═══════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ *TIC-TAC-TOE*

${p}tictactoe <@user>
${p}ttt <@user>
• Classic X and O game
• 2-player interactive
• Real-time turn-based gameplay

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 *HOW TO PLAY*

*Step 1: Start Game*
${p}ttt @friend
  → Challenges mentioned user
  → You become X (goes first)
  → Opponent becomes O

*Step 2: Make Moves*
${p}move <1-9>
  → Place your symbol on the board
  → Numbers match phone keypad layout

*Board Layout:*
\`\`\`
1️⃣ 2️⃣ 3️⃣
4️⃣ 5️⃣ 6️⃣
7️⃣ 8️⃣ 9️⃣
\`\`\`

*Example Game:*
1. Alice: ${p}ttt @Bob
2. Alice: ${p}move 5 (center)
3. Bob: ${p}move 1 (top-left)
4. Alice: ${p}move 3 (top-right)
5. Bob: ${p}move 9 (bottom-right)
6. Alice: ${p}move 7 (bottom-left)
   → Alice wins! (diagonal)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛑 *GAME CONTROLS*

${p}ttt stop
${p}ttt end
• Force end current game
• Clears game board
• Frees up chat for new game

${p}ttt
• Shows current game status
• Lists players
• Displays whose turn it is

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *RULES & VALIDATION*

✅ Only players can make moves
✅ Must wait for your turn
✅ Can't play same spot twice
✅ Can't challenge yourself
✅ Can't challenge the bot
✅ One game per chat at a time

*Spectators:*
• Can watch the game
• Cannot make moves
• Will get friendly message if they try

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏆 *WINNING CONDITIONS*

*You win by getting 3 in a row:*
• Horizontal: 1-2-3, 4-5-6, 7-8-9
• Vertical: 1-4-7, 2-5-8, 3-6-9
• Diagonal: 1-5-9, 3-5-7

*Draw:*
• All 9 spots filled
• No winner
• "It's a draw!" message

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *STRATEGY TIPS*

• Center (5) is strongest opening
• Corners (1,3,7,9) are powerful
• Block opponent's winning moves
• Create multiple winning threats
• Watch for diagonal opportunities

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 *GAME FEATURES*

✅ Real-time turn tracking
✅ Automatic win detection
✅ Draw detection
✅ Visual emoji board
✅ Player mentions
✅ Clean game state management

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

module.exports = help; // Export at the very end
