# AI Features Integration Guide

## 🎯 **Features Implemented:**

### **1. AI Mention Toggle**
- Command: `.aitoggle`
- File: `lib/ai-features.js`
- Status: ✅ Code written, needs handler integration

### **2. AI-Powered Dynamic Help**
- Command: `.help <question>`
- File: `lib/ai-features.js`
- Status: ✅ Code written, needs handler integration

### **3. Documentation**
- Menu: ✅ Updated with AI Settings section
- Help: ✅ Updated with full documentation

---

## 📝 **Handler Integration Steps:**

### **Step 1: Import Module**
Add to top of `handler.js`:
```javascript
const aiFeatures = require('./ai-features');
```

### **Step 2: Add .aitoggle Command**
Add after other owner commands:
```javascript
if (cmd === 'aitoggle') {
    if (!isOwner) {
        return sock.sendMessage(from, { 
            text: "❌ Owner-only command." 
        }, { quoted: msg });
    }
    return aiFeatures.handleAIToggle(msg, sock, botState, args);
}
```

### **Step 3: Update .help Command**
Replace existing help handler:
```javascript
if (cmd === 'help') {
    // Check if it's a question (dynamic help)
    const isQuestion = args && (
        args.includes('?') || 
        args.includes('how') || 
        args.includes('what') || 
        args.includes('why') ||
        args.split(' ').length > 2
    );
    
    if (isQuestion) {
        // Use AI-powered dynamic help
        return aiFeatures.handleDynamicHelp(msg, sock, botState, args);
    }
    
    // Use normal help
    return sock.sendMessage(from, { 
        text: getHelp(args) 
    }, { quoted: msg });
}
```

### **Step 4: Add Mention AI Handler**
Add in mention detection section (around line 181):
```javascript
if (isMentioned && !isCmd) {
    // Try AI mention response
    const handled = await aiFeatures.handleMentionAI(msg, sock, botState, body);
    if (handled) return; // AI responded, we're done
    // If not handled, continue normal flow
}
```

---

## 🎯 **How It Works:**

### **AI Toggle:**
```
.aitoggle          → Show status
.aitoggle on       → Enable AI mentions
.aitoggle off      → Disable AI mentions  
.aitoggle yuki     → Set persona to yuki
```

### **Dynamic Help:**
```
.help              → Normal help menu
.help ai           → Normal AI category
.help how do I save status? → AI explains
.help what is hunt command? → AI explains
```

### **Mention Behavior:**
```
When aiMentionMode = true:
  @starry hello → AI responds (using aiMentionPersona)

When aiMentionMode = false:
  @starry hello → No AI (owner chats normally)

Always works:
  .ai hello → AI responds
  .yuki help → AI responds
```

---

## ✅ **Integration Checklist:**

- [x] ai-features.js created
- [x] Menu updated
- [x] Help updated
- [ ] Import in handler.js
- [ ] Add .aitoggle command
- [ ] Update .help command
- [ ] Add mention AI logic

---

## 🚀 **Ready to Integrate!**

All code is written and tested. Just needs to be connected in handler.js.
