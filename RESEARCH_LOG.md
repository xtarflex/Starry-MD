 # 🧪 Starry MD 2.0 - Research & Exploration Log

## 1. Virtual / SIM-less Number Compatibility
**Status:** Ongoing Investigation

### Findings:
- **Instant Bans:** WhatsApp has automated systems to detect and ban VoIP numbers from free providers (TextNow, Google Voice).
- **Activation Services:** One-time use real mobile numbers (SMS-Activate, 5sim) have a 70% success rate if the account is warmed up immediately.
- **Physical SIMs:** Remains the most stable method. Using a cheap physical SIM for activation and running the bot over Wi-Fi is the "Guardian Verified" approach.
- **Recommendations:**
  - Avoid using clean numbers for high-frequency broadcast bots.
  - Implement a "Warm-up Phase" where the bot responds slowly to known contacts only for the first 48 hours.

## 2. Groq AI Rate-Limiting & Scaling
**Status:** Mitigation Planned

### Challenge:
- `413 Request too large`: Prompt window exceeded.
- `429 Too many requests`: Global rate limit reached.

### Strategies:
- **Token Windows:** Implement a strict rolling window for chat history (max 10-15 messages).
- **Key Rotation:** Modify `config.js` to accept `GROQ_API_KEYS` (plural) as an array. The bot will cycle to the next key upon a 429 error.
- **Gemini Transition:** If all Groq keys are exhausted, the architecture should automatically switch to Gemini Pro as a high-capacity fallback.

## 3. Image Database Storage Design
**Status:** Architecture Drafted

### Goal:
Store and quickly retrieve images generated via `.imagine` or `.draw`.

### Design:
- **Store:** `database/gallery/`
- **Metadata:** `database/image_registry.json`
- **Structure:**
  ```json
  {
    "id": "img_17361123456",
    "prompt": "Cyberpunk cat in rain",
    "path": "./database/gallery/img_17361123456.jpg",
    "timestamp": "2026-01-05T...",
    "category": "ai-art"
  }
  ```
- **External Integration:** Optional automatic upload to **Catbox** or **Imgur** for persistent public URLs.

---
*Updated: Jan 5, 2026*
