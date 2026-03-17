# 🌟 Starry MD v2.0 - Comprehensive Features List

> This document encompasses every single feature in the repository, both previously documented, obvious, and hidden. It is designed to act as a standalone, comprehensive guide.

## 🤖 AI & INTELLIGENCE

### Multi-Persona Chat
**Description:** Talk to different AI personas like Default, Rude, Pirate, or Mom using specific context prefixes or settings. The bot seamlessly maintains contextual awareness across multi-turn conversations and responds dynamically.

### AI Vision Processing
**Description:** Powered by the Groq API and the `Llama-3.2-11b-vision-preview` model, this background service analyzes and describes images automatically when quoted or attached with the `.vision` command. It is located in `lib/services/ai-vision.js`.

### Context-Aware Conversation Generation (`.imagine`, `.draw`)
**Description:** The bot processes text prompts to dynamically generate highly detailed images, utilizing AI models hooked via backend systems to deliver artistic assets natively within WhatsApp.

## 📊 STATUS MANAGEMENT

### Auto-View & Auto-Like
**Description:** A background job that automatically views and likes statuses from other users on a scheduled buffer. This is specifically designed to mimic human behavior and avoid detection.

### VIP Status List
**Description:** Bypasses the standard delay buffer, ensuring that priority users (VIPs) immediately receive views and likes the moment they post a status update.

### Status Poster Tracking (`.statstats`)
**Description:** A unique analytics tool that ranks users by how often they post statuses, providing historical data and insights into your contacts' activity levels.

### Dual-Routing Status Saver (`.save dm` / `.save me`)
**Description:** Enables direct saving of WhatsApp status media either directly into your personal Direct Messages (DM) or saving it locally for later retrieval.

## 👑 ADMIN FEATURES

### `.kick` [🛡️ Admin Only]
**Description:** Kick a member from the group. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.add` [🛡️ Admin Only]
**Description:** Add a user to the group. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.promote` [🛡️ Admin Only]
**Description:** Promote a member to admin. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.demote` [🛡️ Admin Only]
**Description:** Demote an admin to member. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.group` [🛡️ Admin Only]
**Description:** Change group settings (open/close). This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.antilink` [🛡️ Admin Only]
**Description:** Activate/Deactivate Antilink protocol. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.welcome` [🛡️ Admin Only]
**Description:** Toggle welcome messages. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.goodbye` [🛡️ Admin Only]
**Description:** Toggle goodbye messages. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.tagall` [🛡️ Admin Only]
**Description:** Mention all group members. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.hidetag` [🛡️ Admin Only]
**Description:** Mention all members invisibly. This command is crucial for group moderation and management, allowing administrators to maintain order directly through the bot interface without navigating standard WhatsApp menus.

**Implementation Details:** Handled entirely within the `admin.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## 👑 OWNER FEATURES

### `.runtime` [👑 Owner Only]
**Description:** Show bot runtime and system uptime. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.sys` [👑 Owner Only]
**Description:** Show detailed system hardware info. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.db` [👑 Owner Only]
**Description:** Show database statistics. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.logs` [👑 Owner Only]
**Description:** Fetch the latest bot logs. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.eval` [👑 Owner Only]
**Description:** Execute JavaScript code directly. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.pullreq` [👑 Owner Only]
**Description:** Pull latest changes from GitHub. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.broadcast` [👑 Owner Only]
**Description:** Send a message to all groups. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.ban` [👑 Owner Only]
**Description:** Ban a user from using the bot. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.unban` [👑 Owner Only]
**Description:** Unban a user. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.block` [👑 Owner Only]
**Description:** Block and blacklist a user. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.unblock` [👑 Owner Only]
**Description:** Unblock a user. As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `diagnostic.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.purge`
**Description:** Start a 60-minute economy purge (Owner Only). As a system-level command, it requires strict owner authentication via the configured OWNER_ID in `config.js`. Misuse can alter bot functionality globally.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## 💰 ECONOMY FEATURES

### `.balance`
**Description:** Check your wallet and bank balance. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.spawn`
**Description:** Spawn in the economy world. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.guide`
**Description:** View economy guide and rules. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.map`
**Description:** View the economy world map. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.travel`
**Description:** Travel to a different location. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.update`
**Description:** Check for economy updates. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.loan`
**Description:** Take a loan from the bank. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.diamond`
**Description:** Claim your daily diamond reward. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.daily`
**Description:** Claim your daily reward. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.work`
**Description:** Work to earn money. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.deposit`
**Description:** Deposit money into your bank. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.withdraw`
**Description:** Withdraw money from your bank. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.shop`
**Description:** View the items available in the shop. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.buy`
**Description:** Buy an item from the shop. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.sell`
**Description:** Sell your items. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.inventory`
**Description:** View your item inventory. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.use`
**Description:** Use an item from your inventory. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.heal`
**Description:** Heal yourself. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.tasks`
**Description:** View your active tasks and missions. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.claim`
**Description:** Claim rewards for completed tasks. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.gamble`
**Description:** Gamble your money or start a duel. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.coinflip`
**Description:** Flip a coin to double your bet. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.slot`
**Description:** Play the slot machine. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.roulette`
**Description:** Play Russian Roulette or Casino Roulette. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.blackjack`
**Description:** Play a game of Blackjack. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## 🎮 ACTIVITIES FEATURES

### `.fish`
**Description:** Go fishing. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.mine`
**Description:** Go mining. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.hunt`
**Description:** Go hunting for animals. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.rob`
**Description:** Rob or steal from another user. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.drone`
**Description:** Use a drone for a remote robbery. This interacts directly with the global JSON-based economy database, allowing users to earn, spend, or track their wealth as part of the overarching RPG system.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## 💰 INVESTMENT FEATURES

### `.crypto`
**Description:** Check crypto market and your holdings. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.buycrypto`
**Description:** Buy cryptocurrency. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.sellcrypto`
**Description:** Sell cryptocurrency. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.convert`
**Description:** Convert between crypto and currency. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.stock`
**Description:** Check stock market and your portfolio. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.buystock`
**Description:** Buy stocks. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.sellstock`
**Description:** Sell stocks. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.advisor`
**Description:** Get AI-powered financial advice. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## SOCIAL FEATURES

### `.profile`
**Description:** View your or another user's profile. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.gift`
**Description:** Send money as a gift to another user. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.leaderboard`
**Description:** View the economy leaderboard. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.setbio`
**Description:** Set your profile bio. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.setname`
**Description:** Set your profile name. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.rich`
**Description:** View the richest users. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.investors`
**Description:** View the top investors leaderboard. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.census`
**Description:** View economy population stats. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.titles`
**Description:** View and manage your titles. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.equip`
**Description:** Equip an item or title. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `economy.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.tiktok`
**Description:** Download TikTok videos, search, or fetch profiles. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `social.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.instagram`
**Description:** Download Instagram media (Reels, Posts). This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `social.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.pinterest`
**Description:** Download Pinterest media or search for ideas. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `social.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## FUN FEATURES

### `.ship`
**Description:** Ship two people together. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `fun.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.match`
**Description:** Check your match with someone. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `fun.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.gaycheck`
**Description:** Check how gay someone is. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `fun.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.truth`
**Description:** Get a truth question. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `fun.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.dare`
**Description:** Get a dare challenge. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `fun.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.8ball`
**Description:** Ask the magic 8-ball a question. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `fun.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.doge`
**Description:** Get a random dog sticker. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `sticker.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.cat`
**Description:** Get a random cat sticker. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `sticker.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## 🎮 GAMES FEATURES

### `.ttt`
**Description:** Play Tic-Tac-Toe. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.move`
**Description:** Make a move in a game (Tic-Tac-Toe, etc). Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.hit`
**Description:** Hit in Blackjack. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.stand`
**Description:** Stand in Blackjack. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.duel`
**Description:** Challenge someone to a duel. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.accept`
**Description:** Accept a duel or game invite. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.reject`
**Description:** Reject a duel or game invite. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.chess`
**Description:** Start a game of Chess. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.connect4`
**Description:** Play Connect 4. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.monopoly`
**Description:** Start a game of Monopoly. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.roll`
**Description:** Roll the dice in Monopoly. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.buyprop`
**Description:** Buy property in Monopoly. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.endturn`
**Description:** End your turn in Monopoly. Fully playable within WhatsApp, this interactive feature utilizes buttons, quotes, and state tracking to provide a seamless multiplayer or single-player experience.

**Implementation Details:** Handled entirely within the `games.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## 🎨 MEDIA FEATURES

### `.meme`
**Description:** Create a meme with top/bottom text. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `image.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.wasted`
**Description:** Apply GTA Wasted effect to an image. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `image.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.circle`
**Description:** Crop image into a circle. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `image.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.blur`
**Description:** Apply blur filter to an image. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `image.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.invert`
**Description:** Invert image colors. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `image.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.testalbum`
**Description:** Send a test album. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `media.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.songinfo`
**Description:** Fetch detailed information about a song. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `media.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.toimg`
**Description:** Convert a sticker to an image. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `sticker.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.sticker`
**Description:** Create a sticker from an image, video, or GIF. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `sticker.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.stealsticker`
**Description:** Steal a sticker and change its metadata. Built on top of FFmpeg and other media libraries, it processes files securely and efficiently to output high-quality media content back to the chat.

**Implementation Details:** Handled entirely within the `sticker.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## TOOLS FEATURES

### `.tourl`
**Description:** Convert an image/sticker to a public URL. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `image.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## ℹ️ INFO FEATURES

### `.lyrics`
**Description:** Get lyrics for a song (supports smart reply context). This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.lyricspref`
**Description:** Set lyrics preference (always/ask). This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.trends`
**Description:** Get trending topics. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.news`
**Description:** Get latest news. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.wiki`
**Description:** Search Wikipedia. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.weather`
**Description:** Get weather info. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.define`
**Description:** Define a word. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.google`
**Description:** Google search. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.shorten`
**Description:** Shorten a URL. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `info.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.news`
**Description:** Fetch latest news (Yahoo/Google Hybrid) This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `news.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## ℹ️ GENERAL FEATURES

### `.jid`
**Description:** Get Chat ID and Group Info. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `jid.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.alive`
**Description:** Check if the bot is online and see system stats. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.menu`
**Description:** Display the bot's command menu. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## NSFW FEATURES

### `.ph`
**Description:** Download or search from Pornhub. Modes: info, star, gif, sticker, random, search, photo. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `ph.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## SEARCH FEATURES

### `.yts`
**Description:** Search YouTube for videos (Currently Deprecated). This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `search.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## SESSION FEATURES

### `.host`
**Description:** Deploy a StarryMD clone session using a pairing code. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `session.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.listclones` [🛡️ Admin Only]
**Description:** List all currently running sub-bot sessions. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `session.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.stopbot`
**Description:** Stop a running sub-bot session (Data is preserved). This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `session.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.logout`
**Description:** Log out and delete session data for a sub-bot. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `session.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## SETTINGS FEATURES

### `.vvmode` [🛡️ Admin Only]
**Description:** Set where unlocked View-Once media is sent. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.autobio` [🛡️ Admin Only]
**Description:** Toggle automatic bio updates with system stats. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.setbio` [👑 Owner Only]
**Description:** Update the bot's profile bio. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.mode` [👑 Owner Only]
**Description:** Switch the bot's operating mode. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.viewstatus` [👑 Owner Only]
**Description:** Manually view/like a user's status. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.statvip` [👑 Owner Only]
**Description:** Manage Status VIP list. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## ℹ️ UTILITY FEATURES

### `.vv`
**Description:** Unlock View-Once media. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `settings.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.save`
**Description:** Generate a VCard for a user to save them to your contacts. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.myvcard`
**Description:** Generate your own VCard. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.botvcard`
**Description:** See the bot owner's VCard. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.tempmail`
**Description:** Get a temporary email address or check its inbox. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.tempsms`
**Description:** Get a temporary phone number for SMS verification. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `utility.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## UPLOAD FEATURES

### `.upload`
**Description:** Save a media file or document to the bot's storage. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `upload.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.uploads`
**Description:** List all your saved files. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `upload.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.getupload`
**Description:** Retrieve a saved file by name. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `upload.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.deleteupload`
**Description:** Delete a saved file. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `upload.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.mkdir`
**Description:** Create a folder in storage. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `upload.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

### `.url`
**Description:** Get a temporary public URL for a stored file. This provides utility and convenience, streamlining tasks that would otherwise require external apps or manual lookups.

**Implementation Details:** Handled entirely within the `upload.js` module. The execution requires specific permissions as indicated by its tags and integrates with the main message router.

## ⚙️ BACKGROUND SERVICES & SYSTEMS (Hidden / Automated)

### 📧 Temporary Services (Mail & SMS)
**Description:** Built-in APIs manage the background creation and tracking of temporary email inboxes and phone numbers (`lib/services/temp-mail.js`). This is incredibly useful for bypass verifications directly from WhatsApp without switching context.

### 💰 Background Economy Tracker
**Description:** Constantly monitors user activity, assigning and tracking daily tasks (like fishing and working), and processing periodic resets without manual intervention. Handled in `lib/systems/economy-tasks.js`.

### 👁️ Guardian Protocol (Security)
**Description:** A highly restrictive security system that enforces owner-only command protection globally. It actively manages the bot's obedience to `$public`, `$private`, and `$sleep` modes to prevent unauthorized access to sensitive commands.

### ⌨️ Typing & Audio Emulation
**Description:** Simulates human behavior before sending replies (e.g., triggering "typing..." for 1.5 seconds, or "recording audio..." for 4 seconds). This is an essential anti-ban measure designed to keep the bot under WhatsApp's spam radar.

### 🔄 Fireproof Contact Syncing
**Description:** Passive synchronization from incoming WhatsApp events automatically saves unknown stranger contacts (capable of handling 895+ safely). It runs quietly in the background, updating VCards natively.

## 🌐 WEB DASHBOARD FEATURES

### Real-Time Control Panel (`public/`)
**Description:** A beautiful, responsive web interface utilizing an animated canvas background. It connects via WebSockets (`Socket.io`) directly to the bot's `makeWASocket` instance. Users can display live bot statuses, pair multiple devices via QR Code rendered on the frontend, and execute administrative actions remotely without relying solely on the WhatsApp chat interface.
