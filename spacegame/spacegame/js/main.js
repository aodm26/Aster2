import * as THREE from 'three';

// --- 1. STATE & GLOBAL VARIABLES ---
const keys = {};
let score = 0;
let health = 3;
let isTripleShot = false;
let hasShield = false;
let isGameOver = false;
let warpFactor = 1.0;

const bullets = [];
const asteroids = [];
const powerUps = [];

// --- 2. SCENE & CAMERA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000205);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 3. LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const glow = new THREE.PointLight(0x00aaff, 2, 10);
scene.add(glow);

// --- 4. STAR TREK STYLE SHIP ---
const playerGroup = new THREE.Group();
const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
// Nacelle material with Emissive property for pulsing
const nacelleMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0xff0000, emissiveIntensity: 1 });

const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16), mat);
saucer.rotation.x = Math.PI / 2;

const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.5), mat);
neck.position.z = 0.5;

const nacelleL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), nacelleMat);
nacelleL.position.set(-0.7, 0.2, 0.8);
nacelleL.rotation.x = Math.PI / 2;

const nacelleR = nacelleL.clone();
nacelleR.position.x = 0.7;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playPhaserSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playExplosionSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) output[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);

    const gain = audioCtx.createGain();
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}
function startAmbientMusic() {
    const osc = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const lfoGain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = 60; // Deep space hum

    lfo.type = 'sine';
    lfo.frequency.value = 0.5; // Slow pulsing
    lfoGain.gain.value = 20;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.value = 0.05; // Quiet background
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    lfo.start();
}

// --- OVERLAY LOGIC ---
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    audioCtx.resume();
    startAmbientMusic();
    animate(); // Start the game loop only after clicking
});


// SHIELD MESH
const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2, wireframe: true })
);
shieldBubble.visible = false;

playerGroup.add(saucer, neck, nacelleL, nacelleR, shieldBubble);
scene.add(playerGroup);

camera.position.set(0, 12, 18);
camera.lookAt(0, 0, -5);

// --- 5. STARFIELD ---
const starGeo = new THREE.BufferGeometry();
const starStaff = [];
for (let i = 0; i < 4000; i++) {
    starStaff.push(THREE.MathUtils.randFloatSpread(200), THREE.MathUtils.randFloatSpread(200), THREE.MathUtils.randFloatSpread(200));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starStaff, 3));
const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }));
scene.add(starField);

// --- 6. FUNCTIONS (Including Leaderboard) ---
function displayLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    let scores = JSON.parse(localStorage.getItem('highscores') || '[]');
    lb.innerHTML = "<strong>TOP CAPTAINS</strong><br>" +
        scores.map((s, i) => `${i + 1}. ${s}`).join('<br>');
}

function saveScore(s) {
    let scores = JSON.parse(localStorage.getItem('highscores') || '[]');
    scores.push(s);
    scores.sort((a, b) => b - a);
    localStorage.setItem('highscores', JSON.stringify(scores.slice(0, 5)));
    displayLeaderboard();
}

function updateHealthUI() {
    const hb = document.getElementById('health-bar');
    if (hb) hb.innerText = "█".repeat(Math.max(0, health));
}

function handleGameOver() {
    isGameOver = true;
    saveScore(score);
    setTimeout(() => {
        alert("USS Enterprise Destroyed! Final Score: " + score);
        location.reload();
    }, 100);
}

// --- UPDATE FIRE FUNCTION ---
function fire() {
    playPhaserSound(); // phaser call

    const createBullet = (offsetX = 0) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
        b.position.copy(playerGroup.position);
        b.position.x += offsetX;
        scene.add(b);
        bullets.push(b);
    };
    if (isTripleShot) { createBullet(-0.6); createBullet(0); createBullet(0.6); }
    else { createBullet(0); }
}

function spawnAsteroid() {
    if (isGameOver) return;
    
    const size = Math.random() * 1.5 + 0.5; // Sizes between 0.5 and 2.0
    const speedMult = (3.0 - size) * 0.05; // Smaller = Faster
    
    const a = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.1, 0.4), 
            flatShading: true 
        })
    );
    
    a.position.set(THREE.MathUtils.randFloatSpread(40), 0, -80);
    // Store unique stats on the object itself
    a.userData = { 
        speed: speedMult,
        rotation: Math.random() * 0.04
    };
    
    scene.add(a);
    asteroids.push(a);
}

const particles = [];

function createExplosion(position, color) {
    playExplosionSound();
    for (let i = 0; i < 15; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1),
            new THREE.MeshBasicMaterial({ color: color })
        );
        p.position.copy(position);
        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
        );
        p.userData.life = 1.0; // Decay over time
        scene.add(p);
        particles.push(p);
    }
}

function spawnPowerUp() {
    if (isGameOver) return;
    const rand = Math.random();
    let type, color, geo;
    if (rand < 0.4) { type = 'triple'; color = 0xffd700; geo = new THREE.BoxGeometry(0.8, 0.8, 0.8); }
    else if (rand < 0.7) { type = 'shield'; color = 0x00ffff; geo = new THREE.OctahedronGeometry(0.8); }
    else { type = 'health'; color = 0x00ff00; geo = new THREE.TorusGeometry(0.4, 0.15, 8, 16); }

    const p = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, emissive: color }));
    p.userData = { type: type };
    p.position.set(THREE.MathUtils.randFloatSpread(30), 0, -60);
    scene.add(p);
    powerUps.push(p);
}

setInterval(spawnAsteroid, 2000);
setInterval(spawnPowerUp, 9000);

window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Space') fire();
});

// --- 7. MAIN LOOP ---
function animate() {
    if (isGameOver) return;
    requestAnimationFrame(animate);

    // Warp Drive Scaling
    warpFactor = 1.0 + (score / 4000);
    starField.position.z += 0.08 * warpFactor;
    if (starField.position.z > 100) starField.position.z = 0;

    // NACELLE PULSE EFFECT
    // Intensity oscillates based on time, scaled by warp speed
    const pulse = (Math.sin(Date.now() * 0.005 * warpFactor) + 1.2) * warpFactor;
    nacelleMat.emissiveIntensity = pulse;

    // Movement
    const speed = 0.18;
    if (keys['KeyA'] || keys['ArrowLeft']) playerGroup.position.x -= speed;
    if (keys['KeyD'] || keys['ArrowRight']) playerGroup.position.x += speed;
    if (keys['KeyW'] || keys['ArrowUp']) playerGroup.position.z -= speed;
    if (keys['KeyS'] || keys['ArrowDown']) playerGroup.position.z += speed;
    glow.position.copy(playerGroup.position);

    // Power-Up Physics
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].position.z += 0.12 * warpFactor;
        powerUps[i].rotation.y += 0.05;
        if (playerGroup.position.distanceTo(powerUps[i].position) < 1.8) {
            const type = powerUps[i].userData.type;
            if (type === 'triple') { isTripleShot = true; setTimeout(() => isTripleShot = false, 10000); }
            else if (type === 'shield') { hasShield = true; shieldBubble.visible = true; }
            else if (type === 'health') { if (health < 3) health++; updateHealthUI(); }
            scene.remove(powerUps[i]);
            powerUps.splice(i, 1);
        }
    }

// 1. Particle Logic
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.velocity);
        p.userData.life -= 0.02;
        p.material.opacity = p.userData.life;
        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }

    // 2. Asteroid Collision & Movement
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        // Use the asteroid's unique speed + Warp Factor
        a.position.z += a.userData.speed * warpFactor;
        a.rotation.y += a.userData.rotation;

        // Player Hit
        if (playerGroup.position.distanceTo(a.position) < (1.2 + a.geometry.parameters.radius)) {
            createExplosion(a.position, 0xff0000); // Red explosion for player hit
            if (hasShield) {
                hasShield = false;
                shieldBubble.visible = false;
            } else {
                health--;
                updateHealthUI();
                if (health <= 0) { handleGameOver(); return; }
            }
            scene.remove(a);
            asteroids.splice(i, 1);
            continue;
        }

        // Bullet Hit
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j].position.distanceTo(a.position) < a.geometry.parameters.radius + 0.5) {
                createExplosion(a.position, 0xaaaaaa); // Grey explosion for asteroids
                scene.remove(a);
                asteroids.splice(i, 1);
                scene.remove(bullets[j]);
                bullets.splice(j, 1);
                score += 100;
                document.getElementById('score').innerText = score;
                break;
            }
        }
        
        if (a && a.position.z > 30) { scene.remove(a); asteroids.splice(i, 1); }
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].position.z -= 0.8;
        if (bullets[i].position.z < -80) { scene.remove(bullets[i]); bullets.splice(i, 1); }
    }

    renderer.render(scene, camera);
}

// Initialization
updateHealthUI();
displayLeaderboard();
animate();