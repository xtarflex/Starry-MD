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

// Listen for QR
socket.on('qr', (qrData) => {
    const qrImg = document.getElementById('qr-image');
    const qrStatus = document.getElementById('qr-status');

    if (typeof QRCode !== 'undefined') {
        QRCode.toDataURL(qrData, { width: 300, margin: 2 }, (err, url) => {
            if (err) {
                console.error("QR Generation Error:", err);
                if (qrStatus) qrStatus.innerText = "Error generating QR Code";
                return;
            }
            if (qrImg) {
                qrImg.src = url;
                qrImg.style.display = "block";
            }
            if (qrStatus) qrStatus.innerText = "Scan Code Now";

            // Hide scanner animation line if it exists
            const scannerLine = document.querySelector('.scanner-line');
            if (scannerLine) scannerLine.style.display = 'none';
        });
    } else {
        console.warn("QRCode library not loaded yet.");
        console.log("QR Data:", qrData);
    }
});
