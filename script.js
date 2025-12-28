/**
 * UI & MODAL HANDLING
 */
// Setup Modal Logic
function setupModals() {
    const privacyBtn = document.getElementById('btn-privacy');
    const aboutBtn = document.getElementById('btn-about');
    const madeByBtn = document.getElementById('btn-madeby');
    
    const privacyModal = document.getElementById('modal-privacy');
    const aboutModal = document.getElementById('modal-about');
    
    const closeBtns = document.querySelectorAll('.close-btn');

    function openModal(modal, e) {
        e.stopPropagation(); // Prevent game start
        modal.classList.add('active');
    }

    function closeModal() {
        privacyModal.classList.remove('active');
        aboutModal.classList.remove('active');
    }

    privacyBtn.addEventListener('click', (e) => openModal(privacyModal, e));
    aboutBtn.addEventListener('click', (e) => openModal(aboutModal, e));
    
    // Made By - Direct Link
    madeByBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open('https://www.linkedin.com/in/yaswanth-naidu/', '_blank');
    });

    // Close on 'X' click
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
    });

    // Prevent clicks inside modal from starting game or closing modal
    document.querySelectorAll('.modal-content').forEach(content => {
        content.addEventListener('click', (e) => e.stopPropagation());
        content.addEventListener('mousedown', (e) => e.stopPropagation());
        content.addEventListener('touchstart', (e) => e.stopPropagation());
    });

    // Close if clicking outside modal content (on backdrop)
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal();
        });
    });
}
setupModals();

/**
 * AUDIO SYSTEM (Web Audio API)
 */
const AudioSys = {
    ctx: null,
    init: function() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    },
    playTone: function(freq, type = 'sine', duration = 0.5, vol = 0.005) { 
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playChord: function(baseFreq) {
        this.playTone(baseFreq, 'sine', 1.5, 0.004);
        this.playTone(baseFreq * 1.2, 'sine', 1.5, 0.0022);
        this.playTone(baseFreq * 1.5, 'sine', 1.5, 0.0022);
    },
    playSuccess: function(intensity) {
        const randomShift = (Math.random() * 60) - 30;
        const baseFreq = 220 + (intensity * 300) + randomShift;
        this.playTone(baseFreq, 'sine', 0.8, 0.005); 
        this.playTone(baseFreq * 2, 'triangle', 0.4, 0.0015);
    },
    playFail: function() {
        const randomShift = (Math.random() * 20) - 10;
        this.playTone(100 + randomShift, 'sawtooth', 0.4, 0.004);
        this.playTone(95 + randomShift, 'sawtooth', 0.4, 0.004);
    },
    playCharge: function() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        const startFreq = 100 + (Math.random() * 20);
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 1); 
        gain.gain.setValueAtTime(0.0004, this.ctx.currentTime);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        
        return { osc, gain };
    },
    playHighscore: function() {
        this.playTone(440, 'sine', 0.2, 0.004);
        setTimeout(() => this.playTone(554, 'sine', 0.2, 0.004), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.4, 0.004), 200);
    }
};

/**
 * GAME ENGINE
 */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const overlay = document.getElementById('overlay');
const statusText = document.getElementById('status-text');
const scoreContainer = document.getElementById('score-container');
const scoreDisplay = document.getElementById('score-display');
const highscoreDisplay = document.getElementById('highscore-display');
const healthContainer = document.getElementById('health-bar-container');
const healthBar = document.getElementById('health-bar');
const toast = document.getElementById('toast');

let width, height, centerX, centerY, maxRadius;

// Game State
const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2 };
let currentState = STATE.MENU;

// Gameplay Variables
let pulses = []; 
let playerRing = { active: false, radius: 0 };
let particles = [];
let score = 0;
let highscore = localStorage.getItem('cyrcles_highscore') || 0;

// HEALTH SYSTEM VARIABLES
const MAX_HEALTH = 25;
let currentHealth = MAX_HEALTH;

let pulseTimer = 0;
let activeChargeSound = null;
let hasShownToast = false;

// Configuration
// UPDATED SPEED VALUES
const BASE_PULSE_SPEED = 1.05; 
const SPEED_INCREMENT = 0.01;  // Drastically reduced to prevent overlap
const SCORE_INTERVAL = 10;     // Speed increases every 10 points
const PLAYER_GROWTH_SPEED = 3.5; 
const ALIGNMENT_TOLERANCE = 15; 

// Expanded Color Palette (No Red, No Dark)
const PALETTE = [
    '#4cc9f0', // Cyan
    '#ff9f1c', // Orange
    '#2ec4b6', // Teal
    '#9d4edd', // Purple
    '#f72585', // Pink
    '#fee440', // Yellow
    '#ccff33', // Lime
    '#00ffff', // Bright Aqua
    '#e0aaff', // Lavender
    '#ffadad'  // Light Coral (Not pure red)
];

highscoreDisplay.textContent = `BEST: ${highscore}`;

function resize() {
    // High DPI Scaling logic for sharpness
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    
    // Set canvas size in screen pixels
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Scale internal drawing buffer
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Scale context to match
    ctx.scale(dpr, dpr);

    centerX = width / 2;
    centerY = height / 2;
    maxRadius = Math.max(width, height) * 0.6;
}
window.addEventListener('resize', resize);
resize();

// Helpers
function getCurrentColor() {
    const index = Math.floor(score / 100) % PALETTE.length;
    return PALETTE[index];
}

function getCurrentSpeed() {
    const multiplier = Math.floor(score / SCORE_INTERVAL);
    return BASE_PULSE_SPEED + (multiplier * SPEED_INCREMENT);
}

// Input Handling
let isHolding = false;

function startHold(e) {
    // Check if clicking footer links or modals
    if (e.target.closest('.footer-links') || e.target.closest('.modal-content') || e.target.closest('.modal-backdrop')) {
        return; 
    }

    if (e.type === 'touchstart') e.preventDefault();
    if (currentState === STATE.MENU || currentState === STATE.GAMEOVER) {
        resetGame();
        return;
    }
    
    if (currentState === STATE.PLAYING && !isHolding) {
        isHolding = true;
        playerRing.active = true;
        playerRing.radius = 0;
        
        if(activeChargeSound) {
            try { activeChargeSound.osc.stop(); } catch(e){}
        }
        activeChargeSound = AudioSys.playCharge();
    }
}

function endHold(e) {
    // Check if clicking footer links or modals
    if (e.target.closest('.footer-links') || e.target.closest('.modal-content') || e.target.closest('.modal-backdrop')) {
        return;
    }

    if (e.type === 'touchend') e.preventDefault();
    if (currentState === STATE.PLAYING && isHolding) {
        isHolding = false;
        
        if (activeChargeSound) {
            const now = AudioSys.ctx.currentTime;
            activeChargeSound.gain.gain.linearRampToValueAtTime(0, now + 0.1);
            activeChargeSound.osc.stop(now + 0.1);
            activeChargeSound = null;
        }

        checkAlignment();
    }
}

document.addEventListener('mousedown', startHold);
document.addEventListener('mouseup', endHold);
document.addEventListener('touchstart', startHold, { passive: false });
document.addEventListener('touchend', endHold, { passive: false });

function resetGame() {
    AudioSys.init();
    currentState = STATE.PLAYING;
    score = 0;
    currentHealth = MAX_HEALTH;
    pulses = [];
    particles = [];
    playerRing = { active: false, radius: 0 };
    isHolding = false;
    hasShownToast = false;
    
    // UI Update
    overlay.classList.add('hidden');
    scoreContainer.style.opacity = '1'; 
    healthContainer.style.opacity = '1';
    updateHealthUI();
    updateScoreUI();
    
    AudioSys.playChord(220);
    
    // Reset Timing
    lastTime = 0;
}

function spawnPulse() {
    pulses.push({
        radius: 0,
        speed: getCurrentSpeed(), 
        alpha: 1,
        id: Date.now()
    });
}

function checkAlignment() {
    let bestDiff = Infinity;
    let targetIndex = -1;

    for (let i = 0; i < pulses.length; i++) {
        // Ensure the pulse is reasonably large so we don't accidentally match 
        // a brand new dot in the center against a large player ring
        if (pulses[i].radius > 15) {
            let diff = Math.abs(pulses[i].radius - playerRing.radius);
            if (diff < bestDiff) {
                bestDiff = diff;
                targetIndex = i;
            }
        }
    }

    // Check alignment using updated tolerance
    if (targetIndex !== -1 && bestDiff < ALIGNMENT_TOLERANCE) {
        success(bestDiff, pulses[targetIndex]);
        pulses.splice(targetIndex, 1); 
    } else {
        fail();
    }
    
    const color = (targetIndex !== -1 && bestDiff < ALIGNMENT_TOLERANCE) ? getCurrentColor() : '#ff4444';
    createReleaseEffect(playerRing.radius, color);
    
    playerRing.radius = 0;
    playerRing.active = false;
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    AudioSys.playHighscore();
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function success(diff, pulse) {
    const accuracy = 1 - (diff / ALIGNMENT_TOLERANCE);
    
    score++;
    if (currentHealth < MAX_HEALTH) {
        currentHealth++;
    }
    
    if (score > highscore) {
        highscore = score;
        localStorage.setItem('cyrcles_highscore', highscore);
        highscoreDisplay.textContent = `BEST: ${highscore}`;
        if (!hasShownToast && score > 1) {
            showToast("NEW RECORD!");
            hasShownToast = true;
        }
    }
    
    AudioSys.playSuccess(accuracy);
    updateHealthUI();
    updateScoreUI();
    createParticles(pulse.radius, getCurrentColor());
}

function fail() {
    currentHealth--;
    AudioSys.playFail();
    shakeScreen();
    updateHealthUI();
    
    if (currentHealth <= 0) {
        gameOver();
    } else {
        createParticles(playerRing.radius, '#ff4444');
    }
}

function gameOver() {
    currentState = STATE.GAMEOVER;
    overlay.classList.remove('hidden');
    
    document.querySelector('.instruction').style.display = 'none';
    document.querySelector('.tap-prompt').textContent = "Tap to Retry";
    document.querySelector('.title').textContent = "GAME OVER";
    statusText.textContent = `Score: ${score}  |  Best: ${highscore}`;
    
    scoreContainer.style.opacity = '0';
    healthContainer.style.opacity = '0';
    
    if (activeChargeSound) {
        try{ activeChargeSound.osc.stop(); } catch(e){}
        activeChargeSound = null;
    }
}

function updateHealthUI() {
    const pct = (currentHealth / MAX_HEALTH) * 100;
    healthBar.style.width = `${pct}%`;
    
    if (currentHealth > 12) { 
        healthBar.style.backgroundColor = '#ffffff';
        healthBar.style.boxShadow = '0 0 4px rgba(255, 255, 255, 0.4)';
    } else if (currentHealth > 5) { 
        healthBar.style.backgroundColor = '#ffd700';
        healthBar.style.boxShadow = '0 0 6px rgba(255, 215, 0, 0.5)';
    } else { 
        healthBar.style.backgroundColor = '#ff4444';
        healthBar.style.boxShadow = '0 0 8px rgba(255, 68, 68, 0.6)';
    }
}

function updateScoreUI() {
    scoreDisplay.textContent = `${score}`;
}

function createParticles(radius, color) {
    const isRed = color === '#ff4444';
    const count = isRed ? 10 : 20;
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            vx: Math.cos(angle) * (Math.random() * 4),
            vy: Math.sin(angle) * (Math.random() * 4),
            life: 1.0,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

function createReleaseEffect(radius, color) {
    particles.push({
        type: 'ring',
        radius: radius,
        life: 1.0,
        color: color,
        lineWidth: 4
    });
}

let shakeIntensity = 0;
function shakeScreen() {
    shakeIntensity = 8;
}

// --- MAIN LOOP WITH DELTA TIME ---
let lastTime = 0;

function loop(timestamp) {
    // Because we scaled the context, we must clear using logical dimensions
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    if (shakeIntensity > 0) {
        ctx.save();
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
        shakeIntensity *= 0.9;
        if (shakeIntensity < 0.5) shakeIntensity = 0;
    }

    // Delta Time Logic
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Cap delta time to prevent huge jumps (e.g. tab switching)
    const safeDelta = Math.min(deltaTime, 100); 
    // Normalize to 60 FPS (16.66ms per frame)
    const timeFactor = safeDelta / (1000 / 60);

    if (currentState === STATE.PLAYING) {
        // Increment timer by equivalent frames
        pulseTimer += (1 * timeFactor);
        
        const currentSpeed = getCurrentSpeed();
        // Adjust spawn rate to match new speed: faster pulses need faster spawns
        const spawnRate = Math.max(20, 50 * (BASE_PULSE_SPEED / currentSpeed));
        
        if (pulses.length === 0 || pulseTimer > spawnRate) {
            spawnPulse();
            pulseTimer = 0;
        }

        // Draw Target Pulses (White)
        ctx.lineWidth = 2;
        for (let i = pulses.length - 1; i >= 0; i--) {
            let p = pulses[i];
            // Move based on timeFactor
            p.radius += p.speed * timeFactor;
            
            if (p.radius > maxRadius) {
                p.alpha -= 0.02 * timeFactor;
            }

            if (p.alpha <= 0) {
                pulses.splice(i, 1);
                currentHealth--; 
                updateHealthUI();
                if (currentHealth <= 0) gameOver();
                continue;
            }

            const opacity = p.alpha * 0.4;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.arc(centerX, centerY, p.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw Player Ring
        if (isHolding) {
            // Grow based on timeFactor
            playerRing.radius += (currentSpeed * PLAYER_GROWTH_SPEED * timeFactor);
            const currentColor = getCurrentColor();

            ctx.fillStyle = currentColor + '33'; 
            ctx.beginPath();
            ctx.arc(centerX, centerY, playerRing.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = currentColor; 
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, playerRing.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= 0.04 * timeFactor;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        if (p.type === 'ring') {
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = p.life * 0.5;
            ctx.lineWidth = p.lineWidth;
            ctx.beginPath();
            ctx.arc(centerX, centerY, p.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
            p.radius += 3 * timeFactor; 
        } else {
            p.x += p.vx * timeFactor;
            p.y += p.vy * timeFactor;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    if (shakeIntensity > 0) {
        ctx.restore();
    }

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);