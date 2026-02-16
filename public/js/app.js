/*
 * Starry MD Dashboard Logic
 */
const socket = io();
const terminalOutput = document.getElementById('terminal-output');

// Status Elements
const uptimeEl = document.getElementById('uptime');
const modeEl = document.getElementById('mode');
const ownerEl = document.getElementById('owner');
const connStatusEl = document.getElementById('connection-status');

// Init
socket.on('init', (data) => {
    addLog('SYSTEM', data.message);
    fetchStatus();
});

// Listen for connection error (e.g., bot not ready)
socket.on('error', (msg) => {
    addLog('ERROR', msg);
    // If bot isn't initialized, show pairing screen
    if (msg.includes('Bot not initialized')) {
        document.getElementById('connect-overlay').classList.remove('hidden');
    }
});

// Stream Log
socket.on('log', (data) => {
    addLog(data.tag, data.message, data.timestamp);
});

// Helper: Add Log Line
function addLog(tag, message, timestamp = Date.now()) {
    const div = document.createElement('div');
    const timeStr = new Date(timestamp).toLocaleTimeString();

    let className = 'info';
    if (tag === 'ERROR') className = 'error';
    if (tag === 'WARN') className = 'warn';
    if (tag === 'SYSTEM') className = 'system';
    if (tag === 'CONN') className = 'conn';

    div.className = `log-line ${className}`;
    div.innerHTML = `<span class="timestamp">[${timeStr}]</span> <span class="tag">[${tag}]</span> ${message}`;

    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Fetch Status periodically
function fetchStatus() {
    fetch('/api/status')
        .then(res => res.json())
        .then(data => {
            if (modeEl) modeEl.innerText = data.mode.toUpperCase();

            const hours = Math.floor(data.uptime / 3600);
            const minutes = Math.floor((data.uptime % 3600) / 60);
            if (uptimeEl) uptimeEl.innerText = `${hours}h ${minutes}m`;

            if (ownerEl) ownerEl.innerText = data.owner || "Unknown";
        })
        .catch(err => console.error(err));
}

setInterval(fetchStatus, 5000);

// --- Control Panel Logic ---
const btnRestart = document.getElementById('btn-restart');
const btnClear = document.getElementById('btn-clear');
const btnAudio = document.getElementById('btn-audio');
const btnPing = document.getElementById('btn-ping');

if (btnRestart) {
    btnRestart.addEventListener('click', () => {
        if (confirm("Are you sure you want to restart the bot?")) {
            socket.emit('command-restart');
            addLog('WEB', 'Restart command sent...');
        }
    });
}

if (btnClear) {
    btnClear.addEventListener('click', () => {
        terminalOutput.innerHTML = '';
        addLog('WEB', 'Terminal cleared locally.');
    });
}

if (btnAudio) {
    btnAudio.addEventListener('click', () => {
        socket.emit('command-test-audio');
        addLog('WEB', 'Testing audio presence...');
    });
}

if (btnPing) {
    btnPing.addEventListener('click', () => {
        socket.emit('command-ping');
    });
}

// --- Pairing Overlay Logic ---
const overlay = document.getElementById('connect-overlay');
const btnPairManual = document.getElementById('btn-pair-manual');

// Toggle Overlay Manually
if (btnPairManual) {
    btnPairManual.addEventListener('click', () => {
        overlay.classList.toggle('hidden');
    });
}

// Close overlay on click outside
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
        overlay.classList.add('hidden');
    }
});
