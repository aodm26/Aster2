import * as THREE from 'three';

// --- 1. GAME STATE ---
const keys = {};
let score = 0;
let health = 3;
let isTripleShot = false;
let hasShield = false;
let isGameOver = false;
let warpFactor = 1.0;
let combo = 0;
let comboTimer = 0;
let beamPowerTime = 0;

let startTime = 0;
let elapsedTime = 0;

const COMBO_MAX_TIME = 400; // Time (in frames) before combo resets

const bullets = [];
const asteroids = [];
const powerUps = [];
const particles = [];

// --- 2. SCENE & CAMERA SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000205);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const glow = new THREE.PointLight(0x00aaff, 2, 10);
scene.add(glow);

// --- 3. SHIP CONSTRUCTION (USS Enterprise Style) ---
const playerGroup = new THREE.Group();
const shipMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const nacelleMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0xff0000, emissiveIntensity: 1 });

const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16), shipMat);
saucer.rotation.x = Math.PI / 2;

const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.5), shipMat);
neck.position.z = 0.5;

const nacelleL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8), nacelleMat);
nacelleL.position.set(-0.7, 0.2, 0.8);
nacelleL.rotation.x = Math.PI / 2;

const nacelleR = nacelleL.clone();
nacelleR.position.x = 0.7;

const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2, wireframe: true })
);
shieldBubble.visible = false;

playerGroup.add(saucer, neck, nacelleL, nacelleR, shieldBubble);
scene.add(playerGroup);

camera.position.set(0, 12, 18);
camera.lookAt(0, 0, -5);

// --- 4. BEAM LASER MESH ---
const beamMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xcc00ff, transparent: true, opacity: 0.8 })
);
beamMesh.rotation.x = Math.PI / 2;
beamMesh.visible = false;
scene.add(beamMesh);

const beamLight = new THREE.PointLight(0xcc00ff, 5, 15);
beamLight.visible = false;
scene.add(beamLight);

// --- 5. STARFIELD ---
const starGeo = new THREE.BufferGeometry();
const starStaff = [];
for(let i=0; i<4000; i++) {
    starStaff.push(THREE.MathUtils.randFloatSpread(200), THREE.MathUtils.randFloatSpread(200), THREE.MathUtils.randFloatSpread(200));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starStaff, 3));
const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }));
scene.add(starField);

// --- 6. AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    audioCtx.resume();
    
    // START THE CLOCK HERE
    startTime = Date.now(); 
    setInterval(() => {
        if (!isGameOver) {
            elapsedTime = Math.floor((Date.now() - startTime) / 1000);
            const mins = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
            const secs = (elapsedTime % 60).toString().padStart(2, '0');
            const timerEl = document.getElementById('timer');
            if(timerEl) timerEl.innerText = `${mins}:${secs}`;
        }
    }, 1000);

   
});

function playPhaserSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function playExplosionSound() {
    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) output[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, audioCtx.currentTime);
    const gain = audioCtx.createGain();
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    noise.start();
}

// --- 7. CORE FUNCTIONS ---
function updateHealthUI() {
    const hb = document.getElementById('health-bar');
    if (hb) hb.innerText = "█".repeat(Math.max(0, health));
}

function displayLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    let scores = JSON.parse(localStorage.getItem('highscores') || '[]');
    lb.innerHTML = "<strong>TOP CAPTAINS</strong><br>" + scores.map((s, i) => `${i+1}. ${s}`).join('<br>');
}



function addScore(points) {
    combo++;
    comboTimer = COMBO_MAX_TIME;
    const multiplier = Math.floor(combo / 5) + 1;
    score += points * multiplier;
    document.getElementById('score').innerText = score;
    const multiUI = document.getElementById('multiplier-ui');
    if (multiUI && multiplier > 1) multiUI.innerText = `${multiplier}X COMBO!`;
}

function createExplosion(position, color) {
    playExplosionSound();
    for (let i = 0; i < 15; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.15), 
        new THREE.MeshBasicMaterial({ color: color, transparent: true }));
        p.position.copy(position);
        p.userData = {
             velocity: new THREE.Vector3((Math.random()-0.5)*0.6, 
            (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6), life: 1.0 };
        scene.add(p);
        particles.push(p);
    }
}

function spawnAsteroid() {
    if (isGameOver) return;
    const isHeavy = Math.random() > 0.85; 
    const size = isHeavy ? 3.6 : (Math.random() * 1.8 + 0.6);
    const color = isHeavy ? 0xff0000 : 0xDAA520; 
    
    const a = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({ color: color, flatShading: true, roughness: 0.9 })
    );
    
    a.position.set(THREE.MathUtils.randFloatSpread(32), 0, -150);
    
    a.userData = { 
        // Increased base speeds (Regular: ~0.06, Heavy: 0.04)
        speed: (isHeavy ? 0.04 : (3.6 - size) * 0.06), 
        hp: isHeavy ? 3 : 1, 
        isHeavy: isHeavy, 
        color: color, 
        rotation: Math.random() * 0.02,
        // Curved Trajectory Properties
        curveAmount: (Math.random() - 0.5) * 0.15, // How "wide" the curve is
        curveSpeed: Math.random() * 0.02 // how fast it oscillates
    };
    
    scene.add(a);
    asteroids.push(a);
}
function spawnPowerUp() {
    if (isGameOver) return;
    const rand = Math.random();
    let type, color, geo;
    if (rand < 0.25) { type = 'triple'; color = 0xffd700; geo = new THREE.BoxGeometry(0.8, 0.8, 0.8); }
    else if (rand < 0.5) { type = 'shield'; color = 0x00ffff; geo = new THREE.OctahedronGeometry(0.8); }
    else if (rand < 0.75) { type = 'health'; color = 0x00ff00; geo = new THREE.TorusGeometry(0.4, 0.15, 8, 16); }
    else { type = 'laser'; color = 0xcc00ff; geo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12); }
    const p = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color }));
    p.userData = { type }; p.position.set(THREE.MathUtils.randFloatSpread(50), 0, -150);
    scene.add(p); powerUps.push(p);
}

function handleGameOver() {
    isGameOver = true;
    
    // 1. Save High Scores to LocalStorage
    let scores = JSON.parse(localStorage.getItem('highscores') || '[]');
    scores.push(score);
    scores.sort((a, b) => b - a);
    localStorage.setItem('highscores', JSON.stringify(scores.slice(0, 5)));

    // 2. Get the final time from the UI
    const finalTime = document.getElementById('timer')?.innerText || "00:00";

    // 3. Populate the Game Over Overlay
    const statsEl = document.getElementById('final-stats');
    if (statsEl) {
        statsEl.innerHTML = `FINAL SCORE: ${score}<br>TIME IN SECTOR: ${finalTime}`;
    }

    const lbDisplay = document.getElementById('leaderboard-display');
    if (lbDisplay) {
        lbDisplay.innerHTML = "<h3 style='margin:10px 0'>TOP CAPTAINS</h3>" + 
            scores.slice(0, 5).map((s, i) => `<p style='margin:5px 0'>${i+1}. ${s}</p>`).join('');
    }

    // 4. Reveal the Overlay
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        overlay.style.display = 'flex'; // Changed from 'none' to 'flex'
    }

    // 5. Cleanup the "Pixels" (Particles)
    // We clear the scene objects so the background looks clean behind the overlay
    particles.forEach(p => scene.remove(p));
    asteroids.forEach(a => scene.remove(a));
    bullets.forEach(b => scene.remove(b));
    
    // Note: We no longer call location.reload() here. 
    // The "RE-ENGAGE" button in the HTML will handle the reload.
}

// --- 8. INPUTS ---
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if(e.code === 'Space' && beamPowerTime <= 0) {
        playPhaserSound();
        const fire = (off) => {
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({color: 0x00ffff}));
            b.position.copy(playerGroup.position); b.position.x += off; scene.add(b); bullets.push(b);
        };
        isTripleShot ? (fire(-0.6), fire(0), fire(0.6)) : fire(0);
    }
});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    audioCtx.resume();
    setInterval(spawnAsteroid, 2000 + warpFactor/5); // Spawn rate increases with score
    setInterval(spawnPowerUp, 9000);
    animate();
});

// --- 9. MAIN LOOP ---
function animate() {
    if (isGameOver) return;
    requestAnimationFrame(animate);

    // 1. CAMERA & WORLD UPDATES
    // Return camera to center from any screen shake
    camera.position.x += (0 - camera.position.x) * 0.1;
    camera.position.y += (12 - camera.position.y) * 0.1;

    warpFactor = 1.0 + (score / 5000);

    starField.position.z += 0.15 * warpFactor;
    if(starField.position.z > 100) starField.position.z = 0;

    // Combo Timer Decay
    if (comboTimer > 0) comboTimer--; 
    else { combo = 0; if(document.getElementById('multiplier-ui')) document.getElementById('multiplier-ui').innerText = ""; }

    // 2. SHIP MOVEMENT (Locked Y Axis)
    const speed = 0.2;
    if (keys['KeyA'] || keys['ArrowLeft']) playerGroup.position.x -= speed;
    if (keys['KeyD'] || keys['ArrowRight']) playerGroup.position.x += speed;
    if (keys['KeyW'] || keys['ArrowUp']) playerGroup.position.z -= speed;
    if (keys['KeyS'] || keys['ArrowDown']) playerGroup.position.z += speed;

    // Enforce Boundaries (x: left/right, z: forward/back, y: locked)
    playerGroup.position.x = Math.max(-16, Math.min(16, playerGroup.position.x));
    playerGroup.position.z = Math.max(-12, Math.min(16, playerGroup.position.z));
    playerGroup.position.y = 0; // Hard lock on Y axis

    // 3. CONTINUOUS BEAM LASER (Purple Power-up)
    if (keys['Space'] && beamPowerTime > 0) {
        beamMesh.visible = true;
        beamLight.visible = true;
        beamPowerTime--;

        // Position beam at ship, extending 50 units forward
        beamMesh.position.set(playerGroup.position.x, 0, playerGroup.position.z - 25);
        beamMesh.scale.set(1, 50, 1);
        beamLight.position.set(playerGroup.position.x, 0, playerGroup.position.z - 5);
        
        // Vibration effect for the beam
        camera.position.x += (Math.random() - 0.5) * 0.06;

        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            const xDist = Math.abs(a.position.x - playerGroup.position.x);
            // Check if asteroid is in the path of the horizontal beam
            if (xDist < a.geometry.parameters.radius + 0.4 && a.position.z < playerGroup.position.z) {
                a.userData.hp -= 0.15; // Damage over time
                a.material.emissive.setHex(0xffffff); // Heat glow
                
                if (a.userData.hp <= 0) {
                    createExplosion(a.position, a.userData.color);
                    addScore(a.userData.isHeavy ? 300 : 100);
                    scene.remove(a);
                    asteroids.splice(i, 1);
                }
            }
        }
    } else {
        beamMesh.visible = false;
        beamLight.visible = false;
    }

    // 4. POWER-UPS & PARTICLES
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i]; p.position.z += 0.12 * warpFactor;
        if (playerGroup.position.distanceTo(p.position) < 2.0) {
            if (p.userData.type === 'laser') beamPowerTime = 300;
            else if (p.userData.type === 'triple') { isTripleShot = true; setTimeout(()=>isTripleShot=false, 10000); }
            else if (p.userData.type === 'shield') { hasShield = true; shieldBubble.visible = true; }
            else if (p.userData.type === 'health') { if (health < 3) health++; updateHealthUI(); }
            scene.remove(p); powerUps.splice(i, 1);
        }
    }

    // 5. ASTEROID PHYSICS & PHASER COLLISION
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        
        // Base speed multiplied by the score-based warpFactor
        const currentSpeed = a.userData.speed * warpFactor;
        a.position.z += currentSpeed;

        // Curved movement (Sine wave)
        a.position.x += Math.sin(a.position.z * a.userData.curveSpeed) * a.userData.curveAmount;
        
        a.rotation.x += a.userData.rotation;
        a.position.y = 0; // Ensure asteroids stay on plane

        // Player Impact
        if (playerGroup.position.distanceTo(a.position) < 1.5 + a.geometry.parameters.radius) {
            if (hasShield) { hasShield = false; shieldBubble.visible = false; } 
            else { health--; updateHealthUI(); if (health <= 0) { handleGameOver(); return; } }
            createExplosion(a.position, 0xff0000); scene.remove(a); asteroids.splice(i, 1); continue;
        }

        // Standard Phasers (Bullets)
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j].position.distanceTo(a.position) < a.geometry.parameters.radius + 0.6) {
                a.userData.hp--;
                if (a.userData.hp <= 0) {
                    if (a.userData.isHeavy) camera.position.x += (Math.random()-0.5)*2;
                    createExplosion(a.position, a.userData.color);
                    addScore(a.userData.isHeavy ? 300 : 100);
                    scene.remove(a); asteroids.splice(i, 1);
                } else {
                    a.material.emissive.setHex(0xffffff);
                    setTimeout(() => { if(a && a.material) a.material.emissive.setHex(0x000000); }, 50);
                }
                scene.remove(bullets[j]); bullets.splice(j, 1); break;
            }
        }
        if (a && a.position.z > 30) { scene.remove(a); asteroids.splice(i, 1); }
    }

    // 6. BULLET MOVEMENT
    for (let i = bullets.length - 1; i >= 0; i--) {
        // Projectiles move forward
        bullets[i].position.z -= 1.2; // Slightly faster phasers for the longer distance
        
        // Extended distance: Clean up at -200 instead of -100
        if(bullets[i].position.z < -200) {
            scene.remove(bullets[i]);
            bullets.splice(i, 1);
        }}

        // --- PARTICLES CLEANUP ---
for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    
    // Move the particle
    p.position.add(p.userData.velocity);
    
    // Fade out
    p.userData.life -= 0.02; // Decrease life every frame
    p.material.opacity = p.userData.life;
    
    // Shrink slightly for a better effect
    p.scale.multiplyScalar(0.96);

    // If life is gone, remove from scene AND array
    if (p.userData.life <= 0) {
        scene.remove(p);            // Remove from 3D world
        particles.splice(i, 1);     // Remove from tracking array
    }
}

    renderer.render(scene, camera);
}

updateHealthUI();
displayLeaderboard();