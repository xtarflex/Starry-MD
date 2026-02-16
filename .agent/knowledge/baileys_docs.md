# Baileys Knowledge Base
**Version:** 7.0.0 (Target) | **Current Project Version:** 7.0.0-rc.9

## 1. Core Architecture
Baileys interacts directly with WhatsApp servers via WebSocket, emulating a legitimate client (Web or Desktop).

*   **Socket (`sock`):** The primary interface created via `makeWASocket`. It handles connection, messaging, and group management.
*   **Events (`sock.ev`):** Emits updates for connection, credentials, messages, stats, etc.
    *   `connection.update`: QR codes, connection status, disconnections (handle `Boom` errors).
    *   `messages.upsert`: Incoming messages.
*   **Authentication:** Managed via `useMultiFileAuthState`. State must include `creds` and `keys`.

## 2. Configuration Best Practices
Proper configuration of `makeWASocket` is critical for stability and avoiding bans.

### Essential Configs
1.  **`auth`:**
    *   **CRITICAL WARNING:** The docs strongly advise **AGAINST** using `useMultiFileAuthState` in production due to high I/O usage.
    *   **Recommendation:** Implement a custom auth state using a database (Redis, SQL, or MongoDB) to store credentials and keys efficiently.
    *   *Current StarryMD:* Uses `useMultiFileAuthState`. This is a performance bottleneck.
2.  **`printQRInTerminal`:** Set to `true` for CLI, `false` if using Pairing Code.
3.  **`logger`:** Uses `pino`. Set level to 'silent' or 'info'.

### Critical Optimizations (MISSING IN STARRY MD)
*   **`getMessage`:** 
    *   **Purpose:** Required for resending messages and **decrypting poll votes**.
    *   **Implementation:** Must accept a `key` and return the full `WAMessage` from your database store.
    *   **Risk:** Without this, polls may fail and peers cannot request frequent message resends.
*   **`cachedGroupMetadata`:**
    *   **Purpose:** Caches group participant lists to avoid fetching metadata on every `sendMessage`.
    *   **Implementation:** Use `node-cache` or similar to store/retrieve metadata by JID.
    *   **Risk:** **High ban risk** due to rate limiting if fetching metadata for every group message.
*   **`markOnlineOnConnect`:**
    *   **Recommendation:** Set to `false` to prevent the bot from constantly triggering "Online" status, which stops phone notifications for the user.
*   **`browser`:**
    *   **Pairing Code:** Must match a valid browser (e.g., Chrome/Ubuntu) for pairing code to work.
    *   **Sync History:** Use `Browsers.macOS("Desktop")` to request full history sync (emulates Desktop app).

## 3. Migration to v7.0.0
### Major Breaking Changes
1.  **ESM Only:** Baileys v7 drops CommonJS (`require`).
    *   **Impact:** Projects using `require('@whiskeysockets/baileys')` (like StarryMD) must migrate to `import` or use dynamic `await import()`.
    *   *Note:* StarryMD currently runs on `rc.9` with `require`, but stable v7 may enforce ESM strictly.
2.  **LID (Local Identifier) System:**
    *   Users now have LIDs (`user_lid@lid`) separate from phone numbers (`user_pn@s.whatsapp.net`).
    *   Groups and Contacts now distinguish between `lid` and `phoneNumber`.
3.  **No ACKs:**
    *   Baileys no longer sends delivery ACKs to avoid bans.
4.  **Protobufs:**
    *   Direct `proto` access reduced. Use `BufferJSON`, `.create()`, `.encode()`, `.decode()`.
    *   New method: `decodeAndHydrate()`.

## 4. Connecting & Pairing
### Connection Logic
*   **QR Code:** Standard method. Available in `connection.update` event (`qr` field).
*   **Pairing Code:**
    *   **Trigger:** Wait for `connection === 'connecting'` OR `qr` to exist.
    *   **Method:** `await sock.requestPairingCode(phoneNumber)`.
    *   **Format:** Phone number must be E.164 **without** the `+` prefix (e.g., `12345678901`).
*   **Reconnection:**
    *   Monitor `connection.update`.
    *   If `connection === 'close'`, check `lastDisconnect.error?.output?.statusCode`.
    *   **Restart Required:** If `DisconnectReason.restartRequired`, destroy and recreate the socket immediately.

## 5. History Sync
*   **Initial Sync:** Start-up data (chats, contacts, messages) arrives via `messaging-history.set` event.
*   **Best Practice:** Store this data in your database to populate `getMessage`.
*   **On-Demand:** Use `sock.fetchMessageHistory` to request older messages from the phone.
*   **Disabling:** Set `shouldSyncHistoryMessage: () => false` in socket config if history is not needed (reduces startup load).

## 6. Receiving Updates & Events
*   **`messages.upsert`:** Primary event for incoming messages.
    *   **Types:** `notify` (real-time, new) vs `append` (history/sync).
    *   **Action:** Iterate through `messages` array. Handle `notify` type for bot commands.
*   **`messages.update`:** Status updates (delivered, read) or edits.
*   **`chats.upsert` / `chats.update`:** New chats or validation of existing ones.
*   **`groups.upsert` / `groups.update`:** Group metadata changes.

## 7. Messaging & Groups
*   **Sending:** Use `sock.sendMessage(jid, content)`.
    *   Supports: Text, Media, Location, Polls, etc.
    *   **Forwarding:** Use `sendMessage` with `forward` option.
*   **Groups:**
    *   **Create:** `await sock.groupCreate(subject, participants)`.
    *   **Events:** Listen to `group-participants.update` for joins/leaves (Welcome/Left messages).
    *   **Metadata:** Cached metadata is crucial here (see Config).

## 8. Privacy Management
*   **Blocklist:** `sock.fetchBlocklist()` and `sock.updateBlockStatus(jid, "block"/"unblock")`.
*   **Privacy Settings:**
    *   `updateLastSeenPrivacy("all" | "contacts" | "none")`
    *   `updateReadReceiptsPrivacy("all" | "none")`
    *   `updateProfilePicturePrivacy`
    *   `updateStatusPrivacy`

## 9. Advanced Features
*   **App State:** Supports Archive, Mute/Unmute, Pin, and Disappearing Mode via `sock.chatModify`.
*   **Business:** Supports Catalog/Product querying. Profile modification is limited.
*   **USync (Contact Sync):**
    *   Use `USyncQuery` to fetch specific data (Status, Avatar, Devices).
    *   Builder Pattern: `new USyncQuery().withContactProtocol().withStatusProtocol()...`
*   **Message Reliability:**
    *   `MessageRetryManager` handles delivery failures.
    *   Check `isMacError()` to detect decryption failures (often due to state mismatch).

## 10. Error Handling (DisconnectReason)
| Code | Name | Description | Action |
| :--- | :--- | :--- | :--- |
| **401** | `loggedOut` | Session invalid/Logged out on phone. | **Critical:** Delete `auth_info` & Request new QR. |
| **403** | `forbidden` | Ban or privacy restriction. | Alert user. |
| **408** | `timedOut` | Connection timed out. | Reconnect. |
| **411** | `multideviceMismatch` | Device state desync. | Re-sync or restart. |
| **428** | `connectionClosed` | Socket closed unexpectedly. | Reconnect. |
| **440** | `connectionReplaced` | Logged in on another session/process. | **Stop** this process to avoid conflict. |
| **500** | `badSession` | Session data corrupted. | Restore from backup or re-login. |
| **515** | `restartRequired` | Internal restart needed. | Reconnect immediately. |

## 13. API Reference & Utilities
### Enumerations
*   **`RetryReason`:** Specific error codes for debugging.
    *   `SignalErrorBadMac` (7): Decryption fail.
    *   `SignalErrorInvalidSignature` (5): Identity key mismatch.
    *   `AdvFailure` (12): Device verification fail.
    *   `SignalErrorFutureMessage` (6): Time sync issue.
*   **`SyncState`:** Connection state machine.
    *   `0`: Connecting
    *   `1`: AwaitingInitialSync (Buffering)
    *   `2`: Syncing (Processing History)
    *   `3`: Online (Ready)
*   **`WAJIDDomains`:** `s.whatsapp.net` (phone), `lid` (device), `broadcast` (status/group).
*   **`QueryIds` (Newsletter):**
    *   `CREATE`: "8823471724422422"
    *   `METADATA`: "6563316087068696"
    *   `FOLLOW`: "7871414976211147"
    *   `UNMUTE`: "9864994326891137"

### Utility Functions
*   **JID Handling:**
    *   `areJidsSameUser(jid1, jid2)`: Handles LID vs PN comparison.
*   **Security:**
    *   `aesDecrypt(buffer, key)`: AES-256-CBC decryption.
    *   `addTransactionCapability(state, logger, params)`: Wraps Auth State with transaction logic (e.g., for SQL DBs).
*   **Messaging:**
    *   `aggregateMessageKeysNotFromMe(keys)`: Groups keys for bulk read receipts.
    *   `assertMediaContent(content)`: Type-guard returning inner media message or throwing error.
*   **Helpers:**
    *   `bindWaitForEvent(ev, event)`: Promisified event listener (useful for awaiting initial connection).
    *   `bytesToCrockford(buffer)`: Converts buffer to Crockford Base32 (used for IDs).

### Key Functions (Deep Dive)
| Function | Description | Usage Note |
| :--- | :--- | :--- |
| **`downloadContentFromMessage`** | Downloads raw content (stream) from a message node. | Use for large media to avoid memory issues. Returns `Transform` stream. |
| **`downloadMediaMessage`** | High-level wrapper to download and decrypt media. | Returns `Buffer`. Throws if not a media message. |
| **`generateWAMessage`** | Creates a full `WAMessage` object from content. | Used for creating messages before sending (e.g., for relaying). |
| **`generateWAMessageFromContent`** | Simpler helper to create `WAMessage` from content. | |
| **`processHistoryMessage`** | Processes a history sync item. | Returns object with `chats`, `contacts`, `messages` from the sync. |
| **`makeWASocket`** | Main entry point. Creates the socket connection. | Returns `sock` object with methods like `sendMessage`, `groupCreate`, etc. |
| **`useMultiFileAuthState`** | File-based auth state. | **Hyperefficient** for bots, but DB is preferred for high-scale. Docs say "I wouldn't endorse this for any production level use". |
| **`makeCacheableSignalKeyStore`** | Wraps a `SignalKeyStore` with memory caching. | **Essential** when using DB auth to prevent excessive DB reads. |
| **`fetchLatestBaileysVersion`** | Fetches version JSON from GitHub. | ensure `version` in socket config is up-to-date. |
| **`extractMessageContent`** | Unwraps message content. | Extracts inner message from `viewOnceMessage` or `ephemeralMessage`. |
| **`areJidsSameUser`** | Compares two JIDs. | **Critical** for checking if `user_pn` and `user_lid` are the same person. |
| **`jidDecode`** | Decodes JID string. | Returns standard `{ user, server, device }` object. |
| **`jidEncode`** | Encodes JID components. | Helper to construct JIDs. |
| **`jidNormalizedUser`** | Normalizes JID. | Removes device/agent info to get the "bare" user JID. |
| **`bindWaitForConnectionUpdate`** | Wait for connection event. | Helper to await specific connection states (e.g. `open`). |
| **`generateProfilePicture`** | Generates a valid profile picture buffer. | Handles resizing/cropping for WhatsApp standards. |
| **`chatModificationToAppPatch`** | Creates App State patch. | Helper for Archive/Pin/Mute operations. |
| **`waUploadToServer`** | Uploads media to WA servers. | *Note: Documentation link returned 404, likely deprecated or internal.* |

## 14. StarryMD Gap Analysis

| Feature | Status | Action Required |
| :--- | :--- | :--- |
| **`getMessage`** | ❌ Missing | **CRITICAL:** Implement store lookup in `makeWASocket` config to support Polls/Resends. |
| **`cachedGroupMetadata`** | ❌ Missing | **CRITICAL:** Implement `node-cache` for group metadata to prevent bans. |
| **Error Handling** | ⚠️ Basic | Improve `connection.update` logic to handle `401` (Logout) vs `515` (Restart) vs `440` (Conflict). |
| **Auth State Performance** | ⚠️ Risk | `useMultiFileAuthState` is high I/O. **Recommendation:** Migrate to DB-based auth (Redis/SQL). |
| **ESM Compatibility** | ⚠️ Risk | Project uses CJS. Plan migration to ESM or dynamic imports. |
| **LID Support** | ⚠️ Unknown | Verify if `handler.js` logic withstands LID-based JIDs. |

## 12. Reference Links
*   [Socket Configuration](https://baileys.wiki/docs/socket/configuration/)
*   [Connecting Guide](https://baileys.wiki/docs/socket/connecting/)
*   [History Sync](https://baileys.wiki/docs/socket/history-sync/)
*   [DisconnectReason Enum](https://baileys.wiki/docs/api/enumerations/DisconnectReason)
*   [USyncQuery Class](https://baileys.wiki/docs/api/classes/USyncQuery)
*   [GitHub Releases](https://github.com/WhiskeySockets/Baileys/releases)

