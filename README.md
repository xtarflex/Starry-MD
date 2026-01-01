# 🌌 Starry MD v2.0

> **Advanced WhatsApp Bot with Neural Intelligence**

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Version](https://img.shields.io/badge/version-2.0.3-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

## 🚀 Features

### 🤖 AI Intelligence
- Multiple chat personas (Default, Rude, Pirate, Mom)
- AI image generation (`.imagine`, `.draw`)
- Context-aware conversations
- Mention-based triggers (`@starry`)

### 📊 Status Management
- Auto-view and auto-like statuses (scheduled)
- **VIP Status List** - Priority users get instant view/like
- **Manual View** (`.vs`) - View specific user's statuses on demand
- **Notification Toggle** (`.statnotify`) - Control new poster alerts
- Status poster tracking & analytics (`.statstats`)
- Configurable schedule and buffer (`.setsched`, `.setbuffer`)
- Dual-routing status saver (`.save dm` / `.save me`)

### 🛡️ Privacy & Security
- Three modes: `$public`, `$private`, `$sleep`
- Guardian Protocol (enforces mode obedience)
- Stranger handshake protocol with anti-ban measures
- Typing emulation for natural interaction
- Owner-only command protection
- Global rate limiting (3s cooldown)

### 📂 Contact Management
- Fireproof contact syncing (895+ contacts)
- VCard generation and sharing
- Paginated contact list (`.contacts`)
- Auto-save stranger contacts
- Passive sync from WhatsApp events

### 🎨 Media Tools
- Sticker creation with WebP conversion
- Metadata thief (replaces with bot metadata)
- View-once media unlocker (`.vv`)
- FFmpeg-powered processing

### 👑 Group Commands
- Admin management (`.promote`, `.demote`, `.add`)
- Member analytics (`.mem`, `.memghost`)
- Moderation (`.kick`, `.warn`, `.mute`)
- Tag all members (`.tagall`)
- Anti-link protection (`.antilink`)

### 🔧 Diagnostics & Logs
- System monitoring (`.runtime`, `.sys`, `.db`)
- Log management (`.logs`, `.clearlog`)
- Feature request tracking (`.request`, `.pullreq`)
- Status statistics (`.statstats`)

### ⚡ Auto-Reactions
- **Word-boundary matching** - No more false triggers
- 43 keywords across 22 emojis
- Multi-word phrase support ("good morning")
- Rate-limiting to prevent spam
- Auto-delete cooldown reactions (❄️)
- Owner-managed reaction database

### 🧠 Intelligence
- **Command suggestions** for typos (Levenshtein distance)
- Auto-delete error messages (5s)
- Comprehensive `.help` system with changelog
- `.menu` for quick command reference

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/yourusername/StarryMD.git
cd StarryMD

# Install dependencies
npm install

# Configure
cp config.example.js config.js
# Edit config.js with your details

# Run
node index.js
```

## 🎯 Quick Start

1. **First Time Setup**
   ```
   .menu     # View all commands
   .help     # Read detailed guide
   .ping     # Test bot connection
   ```

2. **Owner Commands**
   ```
   $private  # Enable stealth mode
   $public   # Enable public mode
   $sleep    # Enable auto-pilot
   ```

3. **Essential Commands**
   ```
   .menu     # Command list
   .help     # Detailed guide with rules
   .contacts # View saved contacts (paginated)
   .statstats # Status poster rankings
   ```

## 📖 Command Prefixes

- **`.`** - Tool commands (public/owner)
- **`$`** - System modes (owner only)

## 🔐 Bot Rules

### Privacy Laws
- Owner-only commands require authentication
- Saved Messages commands work only in your DM
- Group commands respect admin hierarchy

### Usage Rules
- Commands are case-insensitive
- Quote messages for context commands
- Rate limiting on AI requests

### Anti-Spam Protocol
- Handshake system for unknown contacts
- Auto-block for repeated violations
- Typing emulation for anti-ban

## 📝 Changelog

### v2.0.3 (2026-01-01)
- ✅ Status tracking & analytics (`.statstats`)
- ✅ Group member commands (`.mem`, `.memghost`)
- ✅ Log management system (`.logs`, `.clearlog`, `.pullreq`)
- ✅ Help system with detailed guide (`.help`)

### v2.0.2 (2026-01-01)
- ✅ Sticker WebP conversion + metadata thief
- ✅ Contact pagination (`.contacts <page>`)
- ✅ Block/unblock/report commands
- ✅ Message deletion (`.del`)

### v2.0.1 (2026-01-01)
- ✅ Fireproof contact syncing
- ✅ Multi-word keyword reactions
- ✅ Status scheduler with buffer
- ✅ Loading animations (`.alpha`)

## 🛠️ Tech Stack

- **Baileys** - WhatsApp Web API
- **Node.js** - Runtime environment
- **FFmpeg** - Media processing
- **Gemini AI** - Intelligence engine
- **fs-extra** - File operations

## 📚 Documentation

- **`.menu`** - View command list
- **`.help`** - Detailed guide with rules, categories, and changelog
- **`.request <feature>`** - Submit feature requests
- **`.pullreq`** - View all requests (owner)

## 🤝 Contributing

Feature requests are welcome! Use `.request <description>` in the bot or submit a GitHub issue.

## 📄 License

MIT License - see LICENSE file for details

## 🌟 Credits

Built with ❤️ by **Starry Team**

---

**Total Features:** 19+ implemented commands and auto-features

**Status:** ✅ Active Development
