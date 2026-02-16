const config = require('../../config');
const utils = require('./utils');

/* 
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
  const helpText = `
${utils.ui.header('STARRY MD 2.0 - HELP GUIDE')}

🌟 *WELCOME TO STARRY MD!*
This is a comprehensive guide to all bot features.
For quick commands, use ${p}menu

${utils.readMore}
${utils.ui.line()}

📖 *HOW TO USE THIS GUIDE*

• Type ${p}help ai - AI commands guide
• Type ${p}help media - Media / Sticker tools
• Type ${p}help audio - Audio Lab / FFmpeg
• Type ${p}help group - Group management
• Type ${p}help owner - Owner commands
• Type ${p}help status - Status features
• Type ${p}help info - Information tools
• Type ${p}help fun - Fun & Games
• Type ${p}help social - Social Media Downloader
• Type ${p}help faq - Common questions
• Type ${p}help economy - Economy RPG guide

${utils.ui.line()}

🎯 *QUICK REFERENCE*

*BASIC COMMANDS*
${p}ping (or ${p}p) - Test response time
${p}alive - Check bot status
${p}menu - View command list
${p}help - This detailed guide

*AI FEATURES*
${p}ai <text> - Chat with Groq AI
${p}imagine <prompt> - Create AI images (NEW)
${p}normal <text> - Standard helpful AI
${p}human <text> - Casual Gen-Z zoomer
${p}yuki <text> - Bratty tsundere
${p}fizz <text> - Chaotic gen-z
${p}jax <text> - Toxic gamer
${p}rude <text> - Sarcastic AI
${p}tech <text> - Tech expert AI
${p}uwu / ${p}mom / ${p}pirate - Personas

*MEDIA TOOLS*
${p}sticker (or ${p}s) - Create sticker
${p}toimg - Convert sticker to Image
${p}tovideo (or ${p}mp4) - Sticker to MP4
${p}draw <prompt> - Alias for .imagine
${p}wasted - GTA Wasted effect
${p}tourl - Host media to link
${p}vv - Reveal view-once media

*STATUS FEATURES*
${p}save - Save status to current chat
${p}save me - Save to your DM
${p}statusinfo - Status bot analytics (NEW)

${utils.ui.line()}

🔰 *GETTING STARTED*

1️⃣ *Test the bot*
   ${p}ping

2️⃣ *Try AI chat*
   ${p}ai Hello, how are you?

3️⃣ *Create a sticker*
   Send an image, then reply with ${p}sticker

4️⃣ *Save a status*
   Quote a status message and type ${p}save

${utils.ui.line()}

⚙️ *BOT MODES*

${s}public - Everyone can use the bot
${s}private - Only owner can use
${s}sleep - Bot ignores all commands

*Current Mode:* Check with ${p}menu

${utils.ui.line()}

🛡️ *PRIVACY & SECURITY*

✅ Your messages are not stored
✅ AI conversations are private
✅ Status viewing is anonymous
✅ Contact sync is encrypted

${utils.ui.line()}

💡 *PRO TIPS*

• Quote messages for context commands
• Use ${p}vcard to share your contact
• Set auto-reactions with ${p}addreact
• Block spam with ${p}block

${utils.ui.line()}

🆘 *NEED MORE HELP?*

Type ${p}help <category> for detailed guides:
• ${p}help ai
• ${p}help media
• ${p}help group
• ${p}help owner
• ${p}help faq

Report bugs: ${p}request <description>

${utils.ui.line()}
🌠 Starry MD v2.1 | Built with ❤️
${utils.ui.footer()}
`.trim();

  // Return promise or handled in handler? 
  // Handler expects a string return usually.
  // But we want to simulate typing *before* handling. 
  // Since this module just returns text, we cannot interact with `sock` here easily unless we pass `sock` and `from`.
  // The handler calls `const menuText = require('./menu')(botState.mode);`
  // And `const getHelp = require('./help'); await sock.sendMessage(...)`

  // So we should NOT modify this file to type, but modify handler.js to type BEFORE calling this.
  // Wait, I already added `simulateTyping` to handler.js for `help` command in Step 127.
  // "if (cmd === 'menu' || cmd === 'help' || cmd === 'list') { await utils.simulateTyping(...); ... }"
  // So help.js DOES NOT need comparison typing inside it.

  return helpText;
};

/* 
 * Get detailed help for specific category
 */
function getCategoryHelp(category, p, s) {
  const guides = {
    ai: getAIHelp(p),
    media: getMediaHelp(p),
    audio: getAudioHelp(p),
    community: getEconomySocialHelp(p),
    group: getGroupHelp(p),
    owner: getOwnerHelp(p, s),
    status: getStatusHelp(p),
    info: getInfoHelp(p),
    fun: getFunHelp(p),
    game: getGameHelp(p),
    economy: getEconomyHelp(p),
    crypto: getEconomyHelp(p), // Alias
    stocks: getEconomyHelp(p), // Alias
    forex: getForexHelp(p),    // New
    social: getSocialHelp(p),
    hosting: getHostingHelp(p),
    upload: getUploadHelp(p),
    faq: getFAQHelp(p, s),
    block: getOwnerHelp(p, s), // Routing block help to Owner section
    spam: getGroupHelp(p) // Routing spam help to Group section
  };

  return guides[category.toLowerCase()] || `❌ Unknown category: ${category}\n\nAvailable: ai, media, group, owner, status, info, fun, game, economy, social, hosting, upload, faq`;
}

function getUploadHelp(p) {
  return `
${utils.ui.header('UPLOAD CENTER GUIDE')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 *UPLOAD FILES*

${p}upload [folder] [password]
• Save media (images, videos, docs) to the bot.
• Files are stored safely in the bot's database.

*Usage:*
1. Quote or send media
2. Type \`.upload\` (Saves to root)
3. Type \`.upload work\` (Saves to 'work' folder)
4. Type \`.upload [1234]\` (Protect with password)
5. Type \`.upload work [1234]\` (Folder + Password)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 *RETRIEVE FILES*

${p}get <id/name> [password]
• Download a stored file.
• ID is shown when you upload.

*Examples:*
${p}get file_a1b2c3.jpg
${p}get file_secure.mp4 [1234]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 *MANAGE FILES*

${p}list [folder]
• Show all files in a folder.
• Default: Shows root folder.

${p}mkdir <name>
• Create a new folder to organize uploads.
• Example: \`${p}mkdir memes\`

${p}delete <id/name>
• Permanently delete a file.
• Example: \`${p}delete file_a1b2c3.jpg\`

${p}url <id/name>
• Generate a generic web link for a stored file.
• Useful for sharing stored files with others outside WhatsApp.
• *Note:* Password protected files cannot be URL-ized.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Back to main: ${p}help
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}

function getAIHelp(p) {
  return `
${utils.ui.header('AI COMMANDS GUIDE')}\n║    (Powered by Groq AI)        ║\n╚═══════════════════════════════╝

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

${p}normal <text> 🤖
• Standard helpful AI persona
• Neutral and polite
• Default fallback

${p}human <text> 🧢
• Casual Gen-Z zoomer
• Lowcase, slang, no cap
• "fr fr no cap"

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 *IMAGE GENERATION*

${p}imagine <prompt>
• Create stunning AI images
• Powered by Pollinations/Flux
• High resolution (1024x1024)

${p}draw <prompt>
• Alias for imagine

👁️ *AI VISION* (NEW)

${p}vision <prompt> (or reply to image)
• Analyzes images using Llama 4 Vision
• Can read text, describe scenes, or identify objects
• "Read this menu", "What kind of cat is this?"
• Also works with normal ${p}ai command on images!

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

${p}newpersona <name> | <prompt>
• Create a custom persona (Owner Only)
• Example: \`.newpersona butler | You are a butler.\`
• Use with: \`.butler <text>\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *AI-POWERED HELP*

${p}help <your question>
• Ask questions about bot commands
• AI explains using help docs
• Natural language queries

*Examples:*
${p}help how do I save status?
${p}help what is ghost command?
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
${utils.ui.header('MEDIA COMMANDS GUIDE')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖼️ *CREATE STICKERS*

${utils.ui.line()}
${utils.ui.cmdHelp(p + 'sticker (quote)', 'Convert to sticker', 'Quote image/video then .sticker', 'Works for GIFs too!')}
• Works with Images, Videos, and GIF Files!
• Adds your metadata

*Basic Usage:*
1. Send or quote media (even as a file)
2. Reply with ${p}sticker

*Advanced Sticker Conversion:*
${p}toimg (quote sticker)
• Convert static sticker → JPG

${p}tovideo / ${p}mp4 (quote sticker)
• Convert animated sticker → MP4

${p}sticker <query>
• Search & Send stickers from Tenor
• Example: \`.sticker cat\`

${p}doge / ${p}cat
• Get a random animal sticker

*Network Status:*
• Shows "🐶 Fetching..." or "🔎 Searching..."
• If network is bad, you'll see a diagnostics report (e.g., "🔴 Poor 400ms")

${p}upload (quote media)
• Uploads media to server
• Saves to database/uploads
• Returns server path

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

*IMAGE FILTERS:*
${p}circle (quote image)
• Crops image to a circle (Great for stickers!)

${p}blur (quote image)
• Applies a 5px blur

${p}invert (quote image)
• Inverts colors (Negative effect)

*Custom Metadata:*
${p}sticker Pack Name|Author Name
• Sets custom pack and author
• Shows when tapped

*Example:*
${p}sticker My Pack|Starry
${p}s Funny Memes|Me

${p}testalbum
• Sends a test album to verify media handling.

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

🔍 *ANTI-DELETE (GHOST SYSTEM)*

${p}ghost
• Toggle monitoring on/off for current chat
• Monitors deleted messages
• Forwards to your DM with details

${p}ghost list
• View all monitored chats
• Shows current monitoring status

${p}reveal (quote ghost alert)
• Exposes deleted message in original chat
• Quote the ghost alert from your DM
• Posts deleted content publicly

${p}ghostbuffer <minutes>
• Set buffer duration (1-60 min)
• Default: 10 minutes
• Messages kept in memory for this long

*How it works:*
1. Enable Ghost Protocol in a chat
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
${utils.ui.header('AUDIO LAB GUIDE')}

${utils.ui.line()}

🎧 *YOUTUBE MUSIC (.play)*

${utils.ui.cmdHelp(p + 'play <song>', 'Download MP3', 'Auto-metadata & Cover')}

*Example:*
${p}play Blinding Lights
${p}play https://youtu.be/xxx
   └─ Reply \`.lyrics\` to get song text!

📀 *SONG METADATA (.songinfo)*

${utils.ui.cmdHelp(p + 'songinfo', 'View details', 'Aliased as .metadata')}

${utils.ui.line()}

🎙️ *LYRICS CENTER (.lyrics)*

${p}lyrics <song name>
• Fetches lyrics instantly
• Works for most languages

${p}lyricspref
• Change default behavior:
  • \`ask\` (Default) - Show hint
  • \`always\` - Auto-send lyrics with song

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎬 *YOUTUBE VIDEO (.video / .ytv)*

${p}video <video title or link>
• Downloads video in 360p MP4
• Optimized for WhatsApp speed
• Works with any YouTube video

*Example:*
${p}video Rick Roll
${p}video https://youtu.be/xxx

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 *YOUTUBE SEARCH (.yts)*

${p}yts <query>
• Shows top 5 results with thumbnails
• *Interactive:* Reply with \`1-5\` to download audio
• *Video:* Reply with \`1 video\` to download video

*Example:*
${p}yts Linkin Park
   └─ Reply "1" (Audio)
   └─ Reply "1 video" (Video)

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
• Alias: ${p}mp3 (sometimes)

${p}slow (quote audio)
• Decreases speed to 0.7x
• Deep, atmospheric sound

${p}speed <float> (quote audio)
• Set custom playback speed (0.5 to 2.0)
• Perfect for fine-tuning voice notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎛️ *AUDIO FILTERS* (NEW)

${p}bass [1-50] (quote audio)
• Boosts bass frequencies
• Default: 20 (Medium)
• Example: \`.bass 50\` (Extreme)

${p}deep [0.5-0.9] (quote audio)
• Pitch shift low (Deep voice)
• Default: 0.75
• Example: \`.deep 0.6\` (Very Deep)

${p}high / ${p}nightcore [1.1-2.0] (quote audio)
• Pitch shift high (Chipmunk/Nightcore)
• Default: 1.25

${p}reverse (quote audio)
• Plays audio backwards

${p}blown / ${p}earrape (quote audio)
• Extremely loud distortion
• Warning: LOUD.

${p}echo (quote audio)
• Adds a hallway echo effect

${p}tremolo (quote audio)
• Adds a wobbly oscillation effect

🎛️ *CUSTOM VARIATIONS* (Advanced)
Use these arguments to fine-tune your sound:

• ${p}bass 50 (Max Base)
• ${p}deep 0.5 (Demon Voice)
• ${p}nightcore 1.5 (Anime Voice)
• ${p}speed 0.5 (Slow Motion)

_Note: You can combine filters by saving one and replying to it with another! (e.g. Bass -> then Re-send -> then Reverse)_

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
${utils.ui.header('GROUP ADMIN SUITE GUIDE')}

Welcome to the *STARRY COMMAND CENTER*. This suite provides total administrative control over group dynamics, security, and member management.

${utils.ui.line()}

⚔️ *MEMBER MANAGEMENT*
_Enforce group discipline and manage roles._

${p}kick @user 
➾ *Exile Protocol:* Instantly removes a member. 
💡 *Tip:* Use this for severe rule breakers. _(Requires Bot Admin)_

${p}add @user 
➾ *Recruitment:* Adds a new member to the group.
💡 *Tip:* Quote a message or tag a number to bring them in.

${p}promote @user 
➾ *Elevation:* Grants official Admin status to a member.
💡 *Tip:* Promote your trusted moderators.

${p}demote @user 
➾ *Reduction:* Strips Admin powers from a member.
💡 *Tip:* Use this for retiring staff.

${p}tempmod @user <duration>
➾ *Temporary Authority:* Grants Admin powers for a specific time.
💡 *Example:* \`${p}tempmod @user 30m\` (m=min, h=hour, d=day)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ *STRIKE SYSTEM (WARNS)*
_Keep track of member behavior with persistent warnings._

${p}warn [reason] (quote msg)
➾ *Sanction:* Issues a formal warning. 
📊 *Threshold:* 3 Warnings = * Recursive Removal (Auto-Kick)* .
💡 *Example:* Reply to a spam message with \`${p}warn spamming\`

${p}warnings [@user]
➾ *Intelligence:* Retrieves the warning history of a user.
💡 *Tip:* Check a user's standing before taking action.

${p}unwarn @user 
➾ *Pardon:* Resets all warnings for a user.
💡 *Tip:* Use this if a member improves their behavior.

${p}jid (or ${p}id)
➾ *Intel:* Get Chat ID and Group Config JSON.
💡 *Tip:* Useful for configuring the bot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *GROUP DYNAMICS*
_Modify how the group operates in real-time._

${p}setdesc <text>
➾ *Manifesto:* Updates the group description.

${p}welcome [on/off]
➾ *Greeter:* Toggle welcome messages.

${p}setwelcome <text>
➾ *Custom Welcome:* Set your welcome message.
💡 *Tags:* Use @user and @group in your message.

${p}goodbye [on/off]
➾ *Farewell:* Toggle goodbye messages.

${p}setgoodbye <text>
➾ *Custom Goodbye:* Set your goodbye message.
💡 *Tags:* Use @user and @group in your message.

${p}antilink [on/off]
• Enable/Disable Anti-Link protection.
• Auto-deletes group links from non-admins.

${p}group [open/close]
➾ *Gate Control:* 
• \`open\`: Everyone can message.
• \`close\`: Only Admins can message (Mute Group).
💡 *Tip:* Close the group during nights or major announcements.

${p}setname [New Name]
➾ *Identity:* Changes the group title.
💡 *Tip:* Keep the name relevant and interesting.

${p}link 
➾ *Bridge:* Generates the official invite link.
💡 *Note:* Anyone with this link can join. Use with caution.

${p}admins 
➾ *Staff List:* Displays all active moderators.

${p}spam [on/off]
➾ *Strict Spam Detector:* 
• \`on\`: Monitors ALL messages for spam (including normal chat).
• \`off\`: Only monitors command spam (Default).
💡 *Tip:* Use this if users are spamming text/emojis.

${p}giveaway <amount> <count>
➾ *Event:* Host a random giveaway for members.
💡 *Example:* \`.giveaway 1000 5\` (5 people win $1000 each)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📢 *BROADCAST TOOLS*
_Reach your audience with maximum precision._

${p}tagall [msg] 
➾ *Global Ping:* Mentions every single member.
⚠️ *Caution:* Can be annoying if overused. Use for critical alerts.

${p}hidetag [msg] 
➾ *Stealth Mention:* Tags everyone WITHOUT showing their names.
💡 *Tip:* Perfect for subtle group alerts.

${p}report (quote user)
➾ *Spam Report:* Reports and blocks a user.
💡 *Tip:* Use for instant spam control in groups/DMs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 *OFFICIAL UPDATES*

${p}bcast on (or ${p}bcast register)
➾ *Attach Group:* Registers this group to receive official updates. 
💡 *Use Case:* Never miss a new feature or global event announcement!

${p}bcast off (or ${p}bcast unregister)
➾ *Detach Group:* Stop receiving official Starry MD updates.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ *SECURITY GATES*
_Set up automated defense and logging system._



${p}welcome [on/off]
➾ *Greet:* Toggles automated messages for new members.

${p}goodbye [on/off]
➾ *logs:* Toggles messages when members leave or are kicked.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
${utils.ui.header('OWNER COMMANDS GUIDE')}

${utils.ui.line()}

🔐 * BOT MODES *

    ${utils.ui.cmdHelp(s + 'public', 'Everyone can use bot', 'Default mode')}
${utils.ui.cmdHelp(s + 'private', 'Only owner can use', 'Stealth mode')}
${utils.ui.cmdHelp(s + 'sleep', 'Bot ignores all commands', 'Emergency mode')}

${utils.ui.line()}

⚙️ * BOT CONFIGURATION *

    ${utils.ui.cmdHelp(p + 'setbio <text>', 'Sets WhatsApp bio', 'Updates immediately')}
${utils.ui.cmdHelp(p + 'autobio on/off', 'Toggle auto-bio', 'Dynamic status with uptime')}

${utils.ui.line()}

😈 * RESTRICTED MODES *

    ${utils.ui.cmdHelp(s + 'goon <pass>', 'Activate Goon Mode', 'Restricted access')}

${utils.ui.line()}

🏛️ * CENTRAL BANK *

    ${utils.ui.cmdHelp(p + 'newpersona', 'Create custom AI persona', '.newpersona name | prompt')}
${utils.ui.cmdHelp(p + 'treasury', 'House Treasury', '.treasury info/print')}

${utils.ui.line()}

🚀 * GLOBAL ANNOUNCEMENTS *

    ${utils.ui.cmdHelp(p + 'bcast <msg>', 'Global Broadcast', 'Sends to all registered groups')}

${utils.ui.line()}

🎭 * AUTO - REACTIONS *

${utils.ui.cmdHelp(p + 'addreact', 'Add reaction', '.addreact 💀 dead')}
${utils.ui.cmdHelp(p + 'delreact', 'Delete reaction', '.delreact dead')}
${utils.ui.list('Helpers', [p + 'listreact'])}

${utils.ui.line()}

📊 * STATUS BOT SETTINGS *

    ${utils.ui.cmdHelp(p + 'setsched <hr>', 'Set check interval', '1-24 hours')}
${utils.ui.cmdHelp(p + 'setbuffer', 'Set action delays', '.setbuffer min max')}

${utils.ui.line()}

🛠️ * SYSTEM TOOLS *

    ${utils.ui.list('Diagnostics', [
    p + 'sys - System stats',
    p + 'runtime - Uptime',
    p + 'logs - View logs',
    p + 'pullreq - View requests',
    p + 'killclean - Wipe session & kill',
    p + 'resetmobile - Switch to mobile mode'
  ])
    }

${utils.ui.line()}

🚫 * USER MANAGEMENT *

    ${utils.ui.cmdHelp(p + 'block/unblock', 'Block user', 'Quote user')}

${utils.ui.line()}

💡 * OWNER TIPS *
• Use ${s}private in public
• Monitor logs regularly

${utils.ui.line()}
Back to main: ${p} help
${utils.ui.footer()}
  `.trim();
}

function getStatusHelp(p) {
  return `
${utils.ui.header('STATUS FEATURES GUIDE')}

${utils.ui.line()}

💾 * SAVE STATUS *

    ${utils.ui.cmdHelp(p + 'save', 'Save to chat', 'Quote status -> .save')}
${utils.ui.cmdHelp(p + 'save me', 'Save to DM', 'Quote status -> .save me', 'Private collection')}

${utils.ui.line()}

📈 * MANUAL STATUS VIEWING *

    ${utils.ui.cmdHelp(p + 'vs', 'View specific user', 'Quote notification -> .vs', 'Views & likes all pending')}
${utils.ui.cmdHelp(p + 'alpha', 'Batch Process ALL', 'No args', 'Views 75%, Likes 40% of queue')}

${utils.ui.line()}

⭐ * VIP AUTO - VIEW *

    ${utils.ui.cmdHelp(p + 'statvip', 'Manage VIPs', '.statvip add/remove @user')}
${utils.ui.info('VIPs are processed INSTANTLY and always liked.')}

${utils.ui.line()}

🔔 * NOTIFICATIONS *

    ${utils.ui.cmdHelp(p + 'statusnotify', 'Toggle alerts', 'Owner only')}
${utils.ui.cmdHelp(p + 'statusinfo', 'View stats', 'Queue size & config')}

${utils.ui.line()}

⚙️ * HOW IT WORKS *
    1. Bot receives status notifications
  2. VIP statuses → Viewed & liked immediately
  3. Others → Saved to database
  4. Scheduled batch processing(every 2 hours)
  5. Or manual with ${p} vs / ${p} alpha

${utils.ui.line()}
Back to main: ${p} help
${utils.ui.footer()}
  `.trim();
}

function getEconomySocialHelp(p) {
  return `
${utils.ui.header('SOCIAL & TITLES GUIDE')}

${utils.ui.line()}

⚜️ * TITLES & IDENTITY *

${utils.ui.cmdHelp(p + 'titles', 'View unlocked titles', 'Earned via achievements')}
${utils.ui.cmdHelp(p + 'equip <name>', 'Wear a title', 'Default: No Title')}
${utils.ui.cmdHelp(p + 'profile [@user]', 'View player stats', 'Rank, Net Worth, Titles')}
${utils.ui.cmdHelp(p + 'bio <text>', 'Set custom bio', 'Max 100 chars')}
${utils.ui.cmdHelp(p + 'name <new>', 'Change display name', 'First change FREE')}

${utils.ui.line()}

🤝 * COMMUNITY & INTERACTION *

${utils.ui.cmdHelp(p + 'gift @user <amt>', 'Send money', 'Transfer funds')}
${utils.ui.cmdHelp(p + 'rob @user', 'Steal money', 'Risky! Fines/Jail if caught')}
${utils.ui.cmdHelp(p + 'census', 'View citizens', 'List all players')}
${utils.ui.cmdHelp(p + 'leaderboard', 'Global rankings', 'Top richest players', 'Alias: .lb')}

${utils.ui.line()}

🎯 * MISSIONS *

${utils.ui.cmdHelp(p + 'tasks', 'View missions', 'Daily/Weekly/Monthly')}
${utils.ui.cmdHelp(p + 'claim <id>', 'Claim rewards', 'Earn Cash & XP')}

${utils.ui.line()}
Back to main: ${p} help
${utils.ui.footer()}
  `.trim();
}


function getFAQHelp(p, s) {
  return `
        ${utils.ui.header('FAQ & TROUBLESHOOTING')}
        
        ${utils.ui.line()}

        ❓ * COMMON QUESTIONS *

    Q: Bot not responding ?
      A : Check bot mode with ${p} menu
        Owner can use ${s} public

  Q: Commands not working ?
    A : Make sure you use correct prefix
        Tool commands: ${p}
        System modes: ${s}

  Q: Sticker has no metadata ?
    A : Use ${p}ssteal to re - brand it
        Metadata shows when tapped

  Q: Can't save status?
  A: Quote the status message first
        Then type ${p}save

  Q: AI not remembering context ?
    A : Context lasts 10 messages
        Start new topic with ${p} ai

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        🔧 *TROUBLESHOOTING*

        *Bot is slow:*
        • Check ${p}ping for latency
        • High traffic may cause delays
        • Wait a few seconds

    *Commands fail:*
        • Verify you're not blocked
        • Check if bot is admin(groups)
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

    Q: Is my data stored ?
      A : No, messages are not saved

  Q: Can others see my AI chats ?
    A : No, conversations are private

  Q: Is status viewing anonymous ?
    A : Yes, completely anonymous

  Q: Who can see saved statuses ?
    A : Only you(if using "save me")

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━

        💡 *BEST PRACTICES*

        ✅ Use ${p}help for guidance
        ✅ Test with ${p}ping first
        ✅ Quote messages for context
        ✅ Report bugs with ${p} request
        ✅ Check ${p}menu for quick ref

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━

        📞 *STILL NEED HELP ?*

    Report issues:
        ${p} request < description >

    Contact owner:
          Check ${p}menu for social links

          ━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Back to main: ${p} help
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

function getInfoHelp(p) {
  return `
          ${utils.ui.header('KNOWLEDGE KB GUIDE')}
          
          ${utils.ui.line()}

          📚 *SONG LYRICS*

    ${p} lyrics < song name >
            • Fetches full song lyrics
            • Auto - searches multiple sources
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

    ${p} wiki < topic >
      ${p} wikipedia < topic >
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

                📌 *PINTEREST SEARCH*

    ${p} pint < query >
      ${p} pinterest < query >
                    • Find visual inspiration
                    • Returns random pin image
                    • Fast and lightweight

    *Example:*
      ${p}pint aesthetic mountains

                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    📖 *DICTIONARY(ENGLISH)*

    ${p} define < word >
                      • Get official definitions
                      • Includes phonetics & examples
                      • Multiple meanings supported

    *Example:*
      ${p}define persistence

                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                      🔗 *URL SHORTENER*

    ${p} shorten < url >
                        • Turn long links into short ones
                        • Powered by TinyURL
                        • Free and permanent links

    *Example:*
      ${p}shorten https://www.google.com/search?q=starry+md


                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        📧 *DISPOSABLE EMAIL*

    ${p} tempmail
                        ${p} tempmail < email >
    ${p} tempmail < email > <id>
      • Generate random temporary email
      • Check inbox and read messages
      • Powered by 1secmail

      *Usage:*
      ${p}tempmail
      → Generates a new email address

      ${p}tempmail x@1secmail.com
      → Checks inbox for this email

      ${p}tempmail x@1secmail.com 12345
      → Reads message ID 12345

      ━━━━━━━━━━━━━━━━━━━━━━━━━━━

      📱 *DISPOSABLE SMS* (NEW)

      ${p}tempsms
      ${p}tempsms list
      ${p}tempsms <number>
        • Check free temporary numbers
        • Read SMS for verification
        • Powered by various providers

        *Usage:*
        ${p}tempsms
        → Lists available numbers

        ${p}tempsms +11234567890
        → Checks inbox for this number

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━

        🔍 *STARRY SEARCH*

        ${p}google <query>
          • Search fallback for Wiki
          • Quick link to Google results
          • Clean and direct

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
            ${utils.ui.header('FUN ZONE GUIDE')}

            ${utils.ui.line()}

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
              
              📊 *POLL*
              
              ${p}poll <question> | <option1> | <option2>
              • Create interactive WhatsApp polls
              • Supports single choice validation
              • Works in groups and DMs
              
              *Usage:*
              ${p}poll Dinner? | Pizza | Sushi
              ${p}poll Are you ready? (Defaults to Yes/No)

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━

              🗣️ *DEBATE*

              ${p}debate <topic>
              ${p}debate <topic> @user
              ${p}debate <topic> @user1 @user2
              • Starts a debate in the group
              • Picks two members (Random or Mentioned)
              • Uses provided topic or defaults to "Free Debate"
              
              *Usage:*
              ${p}debate Pineapple on Pizza?
              ${p}debate Best OS? @Alice
              ${p}debate Cats vs Dogs? @Alice @Bob
              
              *Requirements:*
              ✅ Group chat only
              ✅ At least 2 members

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
              ${utils.ui.header('GAME ARCADE GUIDE')}

              ${utils.ui.line()}

              ❌ *TIC-TAC-TOE*

              ${p}tictactoe <@user>
              ${p}ttt <@user>
              • Classic X and O game
              • 2-player interactive
              • Real-time turn-based gameplay
              • *New:* Supports High-Stakes Betting!

              *Bank Card Utility:* 💳
              If you have a * Starry Bank Card* , you can bet even if your wallet is empty! Funds will be drawn directly from your bank.

              ━━━━━━━━━━━━━━━━━━━━━━━━━━━

              🎮 *HOW TO PLAY*

              *Step 1: Start Game*
              ${p}ttt @friend
              → Challenges mentioned user
              → You become X (goes first)
              → Opponent becomes O

              *Step 2: Make Moves*
              → Numbers match phone keypad layout

              *Betting (New):* 💰
              ${p}ttt @user <amount>
                → Challenge for galactic credits!
                → Min: $100
                → Uses * Universal Bank Card* for automated routing.

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

                🎰 *GAMBLING SUITE*

                ${p}gamble <amount>
                  • Risk your wallet money for a 2x payout!
                  • 48% Win Rate (The House always has an edge!)

                  ${p}coinflip <heads /tails> <amount>
                    • High-stakes 50/50 coin toss.
                    • Double your money or lose it all.

                    ${p}slot <amount>
                      • Spin the cosmic slot machine.
                      • 🍎 🍎 🍎 = 3x Win
                      • ⭐ ⭐ ⭐ = 5x Win
                      • 💎 💎 💎 = 10x JACKPOT
                      • Any two match = 1.5x Win

                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                      ⚔️ *PVP DUEL BETS (.bet)*

                      ${p}bet @user <amount>
                        • Challenge a pilot to a high-stakes dice duel!
                        • Roll 2-12; higher score wins the pot.
                        • Min Bet: $500
                        • *Accept:* ${p}accept
                        • *Reject:* ${p}reject

                        *Bank Card Routing:*
                        Duels fully support the * Universal Bank Card* . If you're short on cash but have a card, we'll draw from your bank automatically.

                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        💡 *GAME TIPS*

                        ✅ Gamble responsibly! Only risk what you can afford to lose.
                        ✅ Tic-Tac-Toe is for fun (no money), but Gambling uses your Wallet.
                        ✅ Check .balance before playing.

                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        Back to main: ${p}help
                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        `.trim();
}

function getEconomyHelp(p) {
  return `
                        ${utils.ui.header('ECONOMY & RPG GUIDE')}\n                       ║    (The Starry Multiverse)     ║\n                        ╚═══════════════════════════════╝

                        ${utils.ui.line()}

                        🌌 *GETTING STARTED*

                        ${p}spawn
                        • Create your character and join the Multiverse.
                        • Receive a Starter Pack (Wallet, Earth Visa).

                        ${p}guide
                        • View the official "Hitchhiker's Guide to the Galaxy".
                        • Learn about roles, planets, and survival.

                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                        💵 *FINANCIAL SYSTEM*

                        ${p}balance (or ${p}bal)
                        • Check your Wallet, Bank, Net Worth, and Location.
                        • See your current Role and Level.

                        ${p}daily
                        • Claim your daily universal basic income ($100).
                        • Increases with streaks!

                        ${p}work
                        • Perform manual labor for credits.
                        • Roles (Police, Merchant) get bonuses!
                        • Location affects pay (High Risk = High Reward).

                        ${p}deposit <amount> (or ${p}dep)
                          ${p}withdraw <amount> (or ${p}with)
                            • Manage your bank funds.
                            • Bank capacity is limited by your Property Level.

                            ${p}loan
                            • View or Pay your current loan.
                            • Borrow up to *$10,000* Level.
                            • ⚠️ Interest is charged weekly!

                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                            ⚔️ *ACTIVITIES & ROLES*

                            ${p}fish
                            • Relax and catch alien fish.
                            • Requires: 🎣 Fishing Rod

                            ${p}mine
                            • Extract minerals from planets.
                            • Requires: ⛏️ Pickaxe
                            • Bonus: x3 Yield on Mars!

                            ${p}hunt
                            • Fight cosmic beasts in The Void.
                            • Requires: ⚔️ Laser Sword
                            • High Danger / High Reward

                            ${p}rob @user
                            • Attempt to steal from another player's wallet.
                            • Risk: 50% Fail Rate (Pay fine to police).
                            • ⚠️ Disabled during "The Purge".
                            • Requires: 🔫 Blaster

                            ${p}drone @user
                            • Remote robbery using a Spy Drone.
                            • Risk: Low (Drone might be shot down).
                            • Cost: Battery usage.
                            • Requires: 🛸 Spy Drone

                            *Role Switching:*
                            Use ID Cards from the Shop to change jobs:
                            • 👮 * Police:* Bonus on Work, immune to fines.
                            • 🕵️ * Thief:* Bonus on Robbery.
                            • 💼 * Merchant:* Lower Taxes, Bonus on Sales.

                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                            🛍️ *MARKETPLACE*

                            ${p}shop
                            • View the Galactic Store.
                            • Buy Tools, Vehicles, Properties, and Licenses.

                            ${p}buy <item_code>
                              • Purchase an item.
                              • Example: ${p}buy pickaxe

                              ${p}sell <item_code>
                                • Sell loot for cash.
                                • Example: ${p}sell diamond

                                ${p}inventory (or ${p}inv)
                                • View your backpack and assets.

                                ${p}heal
                                • Use 🧪 Health Potions to restore 50 HP.
                                • Essential for active hunters!

                                ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                🚀 *GALACTIC TRAVEL*

                                ${p}map
                                • View the Star Chart and current location.
                                • See multipliers and travel requirements.

                                ${p}travel <planet>
                                  • Move between worlds.
                                  • 🌍 *Earth:* Safe Haven (Tax: 5%)
                                  • 🔴 *Mars:* Mining Colony (Tax: 10%)
                                  • 🌃 *Cyber City:* Trade Hub (Tax: 2%)
                                  • 🔮 *The Void:* Anomaly (Tax: 0% / PvP Zone)

                                  *Vehicles:*
                                  • 🚀 Rocket (Earth ↔ Mars)
                                  • 🛸 Starship (Earth ↔ Cyber City)
                                  • 🌌 Void Drive (Access The Void)

                                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                  🌠 *EVENTS & CHAOS*

                                  💎 *Chaos Diamonds:*
                                  • Rare artifacts spawn randomly on planets.
                                  • Be the first to type ${p}diamond to claim!

                                  🚨 *The Purge:*
                                  • Random global event.
                                  • Robbery checks DISABLED.
                                  • No Defense Multipliers.
                                  • Pure Anarchy. Hide your money!

                                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                  📉 *CRYPTO & INVESTMENTS*

                                  ${p}crypto
                                  • View live market prices (BTC, ETH, SOL, XRP, etc.)
                                  • Prices fluctuate every 5 minutes!

                                  ${p}buycrypto <coin> <amount>
                                    • Invest your cash in cryptocurrency.
                                    • Example: ${p}buycrypto btc 0.5
                                    • Example: ${p}buycrypto xrp $1000

                                    ${p}sellcrypto <coin> <amount>
                                      • Sell your crypto for profit (or loss).
                                      • Example: ${p}sellcrypto doge all

                                      ${p}convert <amount> <from> <to>
                                        • Exchange one crypto for another.

                                        📊 *STOCK MARKET*

                                        ${p}stock
                                        • View the Starry Stock Exchange (SSE).
                                        • Prices update every 30 minutes!
                                        • Includes TSLA, AMZN, NVDA, AAPL.

                                        ${p}buystock <ticker> <shares>
                                          • Buy shares of companies.
                                          • Example: ${p}buystock TSLA 10

                                          ${p}sellstock <ticker> <shares>
                                            • Sell shares to realize gains.

                                            💱 *FOREX MARKET*
                                            • Use ${p}help forex for details.

                                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                            💡 *ECONOMY TIPS*
                                            • Upgrade your PROPERTY to store more money in the bank.
                                            • Buy a DEBIT CARD to pay directly from the bank.
                                            • Watch out for Weekly Billing (Rent + Loan Interest).
                                            • Don't get caught robbing the Police!

                                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                            Back to main: ${p}help
                                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                            `.trim();
}

const getSocialHelp = (p) => {
  return `
                                            ${utils.ui.header('SOCIAL LAB GUIDE')}

                                            ${utils.ui.line()}

                                            📹 *TIKTOK DOWNLOADER (.tt)*

                                            ${p}tiktok <link>
                                              • Downloads video without watermark
                                              • High Quality HD | Fast & Clean

                                              ${p}tiktok <query>
                                                • Search TikTok videos
                                                • Example: \`.tt funny cats\`

                                                ${p}tiktok @user
                                                • View User Profile & Recent/Popular Videos
                                                • Example: \`.tt @charlidamelio\`

                                                *Status Feedback:*
                                                • Shows "⬇️ Downloading..." / "⬆️ Uploading..."

                                                ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                                📸 *INSTAGRAM DOWNLOADER (.ig)*

                                                ${p}insta <link>
                                                  • Downloads Reels, Posts, and TV
                                                  • Auto-detects media type (Image/Video)
                                                  • Includes "Smart Network" diagnostics if it fails!

                                                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                  `.trim();
}

function getForexHelp(p) {
  return `
                                                  ${utils.ui.header('FOREX MARKET GUIDE')}\n                                                  ║    (Foreign Exchange)          ║\n                                                  ╚═══════════════════════════════╝

                                                  ${utils.ui.line()}

                                                  🌍 *GLOBAL CURRENCIES*

                                                  ${p}forex
                                                  • View live exchange rates (EUR, GBP, JPY, etc.).
                                                  • Low volatility (stable wealth storage).
                                                  • Updates every 10 minutes.

                                                  ${p}buyfx <currency> <amount>
                                                    • Exchange USD for foreign currency.
                                                    • Example: ${p}buyfx EUR 1000
                                                    • Example: ${p}buyfx GBP $500

                                                    ${p}sellfx <currency> <amount>
                                                      • Convert foreign currency back to USD.
                                                      • Example: ${p}sellfx JPY all

                                                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                      Back to main: ${p}help
                                                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                      `.trim();
}

function getHostingHelp(p) {
  return `
                                                      ${utils.ui.header('CLOUD HOSTING GUIDE')}\n                                                      ║    (Sub-Bot Management)        ║\n                                                      ╚═══════════════════════════════╝

                                                      ${utils.ui.line()}

                                                      🤖 *SUB-BOT HOSTING*

                                                      ${p}host
                                                      • Launch your own clone of Starry MD!
                                                      • Generates a QR code for you to scan.
                                                      • You become the owner of your clone.

                                                      *How to use:*
                                                      1. Type ${p}host in private chat.
                                                      2. Bot sends a pairing code or QR.
                                                      3. Link your WhatsApp via "Linked Devices".
                                                      4. Your clone comes online immediately!

                                                      ${p}stopbot
                                                      • Safely shutdown your hosted sub-bot.
                                                      • Frees up server resources.
                                                      • Use this before re-hosting.

                                                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                                      ⚙️ *HOSTING FEATURES*

                                                      ✅ *Independent Core:* Your bot runs separately.
                                                      ✅ *Full Ownership:* You get all owner commands.
                                                      ✅ *24/7 Uptime:* Runs on our cloud server.
                                                      ✅ *No Coding:* We handle the files, you handle the chat.

                                                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━

                                                      ⚠️ *HOSTING RULES*

                                                      • Do not spam commands.
                                                      • Clone sessions refresh every 24h.
                                                      • If bot stops, just running ${p}host again fixes it.

                                                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                      Back to main: ${p}help
                                                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                                      `.trim();
}
