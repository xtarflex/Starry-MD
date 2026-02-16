/*
 * Connect / Pairing Logic
 */

// Tabs
const tabBtns = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Deactivate all
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Activate click
        btn.classList.add('active');
        const target = btn.dataset.tab;
        document.getElementById(`${target}-content`).classList.add('active');
    });
});

// Pairing Logic
const pairBtn = document.getElementById('pair-btn');
const phoneInput = document.getElementById('phone-input');
const codeDisplay = document.getElementById('pairing-code-display');
const codeText = codeDisplay.querySelector('h3');

pairBtn.addEventListener('click', () => {
    const number = phoneInput.value;
    if (number.length < 10) {
        alert("Please enter a valid number (e.g., 23480...");
        return;
    }

    // Emit event
    socket.emit('pairing-request', number);
    pairBtn.innerText = "REQUESTING...";
    pairBtn.disabled = true;
});

// Listen for Code
socket.on('pairing-code', (code) => {
    codeDisplay.classList.remove('hidden');
    // Format code: XXXX-XXXX
    let formatted = code;
    if (code.length === 8) {
        formatted = code.slice(0, 4) + "-" + code.slice(4);
    }
    codeText.innerText = formatted;
    pairBtn.innerText = "CODE RECEIVED";
});

// Listen for QR (requires qrcode lib or image data)
// For now, we assume backend sends a raw string, we would need a lib to render it.
// To keep it simple, we'll placeholder this or strictly use Phone Pairing for now
// as we didn't add a client-side QRCode lib in the html yet.
socket.on('qr', (qrData) => {
    // If we had a QR lib, we'd render it here.
    // document.getElementById('qr-status').innerText = "Scan Code Now";
    // TODO: Add qrcode.js via CDN or local assets if needed.
    // For now, we'll just log it.
    console.log("QR Received:", qrData);
});
