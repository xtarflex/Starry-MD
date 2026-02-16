/* 
 * Starry Background Animation
 * A creative coding implementation associated with StarryMD
 */
const canvas = document.getElementById('starry-bg');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];
const STAR_COUNT = 300;
const CONNECTION_DISTANCE = 100;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

class Star {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5; // Slow velocity
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
        this.color = Math.random() > 0.9 ? '#00f3ff' : '#ffffff'; // Occasional cyan star
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around screen
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

// Init Stars
for (let i = 0; i < STAR_COUNT; i++) {
    stars.push(new Star());
}

// Mouse Interaction
let mouse = { x: null, y: null };
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw connections
    ctx.lineWidth = 0.5;
    for (let i = 0; i < stars.length; i++) {
        let star = stars[i];
        star.update();
        star.draw();

        // Connect to mouse
        if (mouse.x) {
            let dx = mouse.x - star.x;
            let dy = mouse.y - star.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 150) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(0, 243, 255, ${1 - distance / 150})`;
                ctx.moveTo(star.x, star.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }
        }
    }

    requestAnimationFrame(animate);
}

animate();
