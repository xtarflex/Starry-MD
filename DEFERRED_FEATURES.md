# 🚀 StarryMD: Deferred Features & Future Roadmap

This document tracks all features, modules, and enhancements that have been postponed or put on hold during current development phases. These items are reserved for future updates.

---

## 🎵 **1. Audio Lab (Specialized Filters)**
These filters require specific FFmpeg complex filter strings and were deferred to prioritize core stability.
- [x] `.bass` – Deep bass boost integration.
- [x] `.reverse` – Reverse audio playback.
- [x] `.blown` / `.earrape` – High-gain distortion filter.
- [x] `.deep` – Pitch shift (low).
- [x] `.high` – Pitch shift (high/nightcore).
- [x] `.echo` – Audio delay/echo effect.
- [x] `.tremolo` – Rapid amplitude modulation.

## 🤖 **2. AI & Persona Expansion**
Enhancements to the bot's intelligent interaction capabilities.
- [ ] **AI Long-Term Memory**: Implementation of a database-backed conversation history (PostgreSQL/MongoDB) for multi-session context.
- [ ] **Persona Voice Synthesis**: Integration with ElevenLabs or similar APIs to make personas send real-time voice notes.
- [x] **Vision Integration**: Enabling the AI to "see" and describe images replied to with `.ai`.
- [x] **Custom Persona Builder**: An owner-only command to define new personas dynamically (`.newpersona name | system_prompt`).

## 🛡️ **3. Advanced Guardian Protocol**
Advanced security and group management automation.
- [x] **Anti-Link 2.0**: Intelligent link detection that distinguishes between "safe" links (verified domains) and "malicious" ones.
- [x] **Spam Detection**: A rolling-window message frequency analyzer to auto-mute/kick spammers.
- [ ] **Ghost Member Audit**: A command to identify and list completely inactive members in a group.
- [ ] **Scheduled Status/Bio**: Automatic rotation of the bot's WhatsApp bio/status based on time or weather.

## 🤝 **4. Contact & Interaction Polish**
Refining the "human" feel of the bot.
- [x] **Presence Handshake Refinement**: Adding randomized delays and "recording audio..." status emulations before sending VCards.
- [x] **Auto-Greeting**: Personalized welcome messages based on the time of day (Good Morning/Night) for new DM contacts.
- [ ] **VCard Customization**: Allowing owners to set custom fields in the `.myvcard` output.

---

*Last updated: January 2026*
