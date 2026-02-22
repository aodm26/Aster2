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
let targetRoll = 0;

let ufo = null;
let ufoActive = false;
let lastUfoShot = 0;
let ufoSpawningInitiated = false;
let ufoSpawnTimer = 0;
let lastUfoDefeatTime = 0;
let nextUfoDelay = 0; // The randomized wait time


let ufoHP = 20;
let maxUfoHP = 20; // Added this to track percentage for the bar
let maxHealth = 3;
let ufoLevel = 1;
let targetPitch = 0; // Added to prevent undefined error in animate()
let ufosDefeated = 0;
let asteroidSpawnInterval = 2000; // Base speed: 2 seconds
let lastAsteroidSpawn = 0;

const ufoProjectiles = [];

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

// --- 3. ADVANCED SHIP CONSTRUCTION ---
const playerGroup = new THREE.Group();

// Materials
const hullMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.3, roughness: 0.4 });
const engineMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x00ccff, emissiveIntensity: 2 });
const deflectorMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff4400, emissiveIntensity: 1.5 });

// Primary Hull (Saucer) - Increased segments for smoothness
const saucer = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.15, 32), hullMat);
saucer.rotation.x = Math.PI / 2;

// Bridge Dome
const bridge = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), hullMat);
bridge.position.set(0, 0.1, 0);
saucer.add(bridge);

// Secondary Hull (Engineering)
const engHull = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 1.2, 16), hullMat);
engHull.position.set(0, -0.3, 0.9);
engHull.rotation.x = Math.PI / 2;

// Neck (Connecting Saucer to Engineering)
const neck = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.4), hullMat);
neck.position.set(0, -0.1, 0.4);
neck.rotation.x = -Math.PI / 4;

// Deflector Dish (Glowing front)
const dish = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), deflectorMat);
dish.position.set(0, 0, -0.6); // Attached to front of engHull
engHull.add(dish);

// Nacelles (Warp Engines)
const nacelleGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.8, 12);
const nacelleL = new THREE.Mesh(nacelleGeo, engineMat);
nacelleL.position.set(-0.8, 0.1, 1.4);
nacelleL.rotation.x = Math.PI / 2;

const nacelleR = nacelleL.clone();
nacelleR.position.x = 0.8;

// Pylons (Holding Nacelles)
const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.2), hullMat);
pylonL.position.set(-0.4, 0, 1.1);
pylonL.rotation.z = Math.PI / 6;

const pylonR = pylonL.clone();
pylonR.position.x = 0.4;
pylonR.rotation.z = -Math.PI / 6;

// Re-add Shield
const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15, wireframe: true })
);
shieldBubble.visible = false;

playerGroup.add(saucer, engHull, neck, pylonL, pylonR, nacelleL, nacelleR, shieldBubble);
scene.add(playerGroup);

camera.position.set(0, 12, 18);
camera.lookAt(0, 0, -5);

// --- 4. BEAM LASER MESH ---
const beamMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1, 12), // Radius 0.3, Height 1
    new THREE.MeshBasicMaterial({
        color: 0xcc00ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending // This makes it look like "light"
    })
);

beamMesh.rotation.x = Math.PI / 2; // Lay it flat
scene.add(beamMesh);
const beamLight = new THREE.PointLight(0xcc00ff, 5, 15);
beamLight.visible = false;
scene.add(beamLight);

// --- 5. STARFIELD ---
const starGeo = new THREE.BufferGeometry();
const starStaff = [];
for (let i = 0; i < 4000; i++) {
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
            if (timerEl) timerEl.innerText = `${mins}:${secs}`;
        }
    }, 1000);


});

//ufo
function spawnUfo() {
    if (ufoActive) return;
    ufoActive = true;

    ufoHP = 15 + (ufoLevel * 10);
    maxUfoHP = ufoHP;

    ufo = new THREE.Group();

    // 1. Saucer Body with higher metalness for reflections
    const body = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 32, 12),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1, roughness: 0.2 })
    );
    body.scale.y = 0.3;

    // 2. Glowing Cockpit
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 5 })
    );
    dome.position.y = 0.1;

    // 3. UNDER-LIGHT (Makes it very visible)
    const ufoLight = new THREE.PointLight(0x00ff00, 10, 15);
    ufoLight.position.set(0, -1, 0);

    // 4. Energy Rim (Visual feedback for hits)
    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(1.9, 0.05, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    rim.rotation.x = Math.PI / 2;

    ufo.add(body, dome, ufoLight, rim);
    ufo.position.set(0, 0, -80);
    scene.add(ufo);

    const bossUI = document.getElementById('boss-ui');
    if (bossUI) bossUI.style.display = 'block';

}

function fireUfoProjectile() {
    const proj = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff00ff }) // Purple enemy fire
    );
    proj.position.copy(ufo.position);
    scene.add(proj);
    ufoProjectiles.push(proj);
}

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
    const healthBar = document.getElementById('health-bar');
    if (!healthBar) return;

    let barDisplay = "";
    // Draw slots based on the dynamic maxHealth
    for (let i = 0; i < maxHealth; i++) {
        barDisplay += (i < health) ? "█" : "░";
    }
    healthBar.innerText = barDisplay;

    // Color coding
    healthBar.style.color = (health <= 1) ? "#ff3333" : "#00ffcc";
}

function displayLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    let scores = JSON.parse(localStorage.getItem('highscores') || '[]');
    lb.innerHTML = "<strong>TOP CAPTAINS</strong><br>" + scores.map((s, i) => `${i + 1}. ${s}`).join('<br>');
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
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6), life: 1.0
        };
        scene.add(p);
        particles.push(p);
    }
}

function spawnAsteroid() {
    if (isGameOver) return;

    // 1. VARIETY IN SHAPE
    // We mix Icosahedrons (smooth rocks), Tetrahedrons (sharp shards), and Dodecahedrons (blocky)
    const geometries = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.TetrahedronGeometry(1, 0),
        new THREE.DodecahedronGeometry(1, 0)
    ];
    const baseGeo = geometries[Math.floor(Math.random() * geometries.length)];

    // 2. VARIETY IN SIZE
    const isHeavy = Math.random() > 0.85;
    // Scale is now randomized even for regular asteroids
    const size = isHeavy ? 3.8 : (Math.random() * 1.5 + 0.5);

    // 3. VARIETY IN COLOR (Space Palettes)
    const colors = [
        0xDAA520, // Goldenrod (Standard)
        0x8B4513, // Saddle Brown (Iron-rich)
        0x696969, // Dim Gray (Carbonaceous)
        0xA9A9A9  // Dark Gray (Silicate)
    ];
    const color = isHeavy ? 0xff0000 : colors[Math.floor(Math.random() * colors.length)];

    const a = new THREE.Mesh(
    baseGeo,
    new THREE.MeshStandardMaterial({
        color: color,
        flatShading: true, // Highlights the facets of the rock
        roughness: 0.5,
        metalness: 0.2,
        emissive: color,   // Adds a faint glow of its own color
        emissiveIntensity: 0.2 // Just enough to make it visible in the dark
    })
);

    // Apply the random size scale
    a.scale.set(size, size, size);

    // Add minor distortion so they aren't perfect spheres
    a.scale.x *= (0.8 + Math.random() * 0.4);
    a.scale.y *= (0.8 + Math.random() * 0.4);

    // 4. VARIETY IN POSITION & PHYSICS
    a.position.set(THREE.MathUtils.randFloatSpread(32), 0, -150);

    a.userData = {
        speed: (isHeavy ? 0.04 : (4 - size) * 0.06),
        hp: isHeavy ? 4 : 1, // Heavies are now slightly tougher
        isHeavy: isHeavy,
        color: color,
        // Random tumble/rotation on all 3 axes
        rotX: (Math.random() - 0.5) * 0.05,
        rotY: (Math.random() - 0.5) * 0.05,
        // The sine-wave curve properties we added earlier
        curveAmount: (Math.random() - 0.5) * 0.2,
        curveSpeed: Math.random() * 0.03
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
            scores.slice(0, 5).map((s, i) => `<p style='margin:5px 0'>${i + 1}. ${s}</p>`).join('');
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
    if (e.code === 'Space' && beamPowerTime <= 0) {
        playPhaserSound();
        const fire = (off) => {
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            b.position.copy(playerGroup.position); b.position.x += off; scene.add(b); bullets.push(b);
        };
        isTripleShot ? (fire(-0.6), fire(0), fire(0.6)) : fire(0);
    }
});

document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    audioCtx.resume();
    setInterval(spawnAsteroid, 2000 + warpFactor / 5); // Spawn rate increases with score
    setInterval(spawnPowerUp, 9000);
    animate();
});

function handleUfoDefeat() {
    createExplosion(ufo.position, 0x00ff00);
    
    ufosDefeated++; 
    
    // UPDATE THE UI ELEMENT HERE
    const ufoCountEl = document.getElementById('ufo-counter');
    if (ufoCountEl) {
        ufoCountEl.innerText = ufosDefeated;
    }

    maxHealth += 1; 
    health = maxHealth; 
    updateHealthUI(); 
    addScore(2000);
    
    // UI cleanup
    document.getElementById('boss-ui').style.display = 'none';
    scene.remove(ufo);
    ufo = null;
    ufoActive = false;

    // Cooldown logic
    lastUfoDefeatTime = Date.now();
    ufoSpawningInitiated = false;
    nextUfoDelay = Math.random() * (20000 - 5000) + 5000;
}

function updateBossUI() {
    const fill = document.getElementById('boss-hp-fill');
    if (fill) {
        const pct = Math.max(0, (ufoHP / maxUfoHP) * 100);
        fill.style.width = pct + "%";
    }
}
/// --- 9. MAIN LOOP ---
function animate() {
    if (isGameOver) return;
    requestAnimationFrame(animate);

    const now = Date.now();

    // Divisor increased to 100 for a much slower, gradual ramp-up
    // This means every 1,000 points reduces the delay by only 10ms
    asteroidSpawnInterval = Math.max(600, 2000 - (score / 100));

    if (now - lastAsteroidSpawn > asteroidSpawnInterval) {
        spawnAsteroid();
        lastAsteroidSpawn = now;
    }

    // --- 1. CAMERA & WORLD UPDATES ---
    // Smoothly return camera to center (0, 12, 18)
    camera.position.x += (0 - camera.position.x) * 0.1;
    camera.position.y += (12 - camera.position.y) * 0.1;

    warpFactor = 1.0 + (score / 5000);

        // Update UI (toFixed(1) keeps it to one decimal point like "1.2c")
    const velocityEl = document.getElementById('velocity');
    if (velocityEl) velocityEl.innerText = warpFactor.toFixed(1);

    starField.position.z += 0.15 * warpFactor;
    if (starField.position.z > 100) starField.position.z = 0;

    if (comboTimer > 0) comboTimer--;
    else {
        combo = 0;
        if (document.getElementById('multiplier-ui')) document.getElementById('multiplier-ui').innerText = "";
    }

    // --- 2. SHIP MOVEMENT & DYNAMIC BANKING ---
    const speed = 0.2;
    if (keys['KeyA'] || keys['ArrowLeft']) { playerGroup.position.x -= speed; targetRoll = 0.4; }
    else if (keys['KeyD'] || keys['ArrowRight']) { playerGroup.position.x += speed; targetRoll = -0.4; }
    else { targetRoll = 0; }

    if (keys['KeyW'] || keys['ArrowUp']) { playerGroup.position.z -= speed; targetPitch = 0.15; }
    else if (keys['KeyS'] || keys['ArrowDown']) { playerGroup.position.z += speed; targetPitch = -0.15; }
    else { targetPitch = 0; }

    playerGroup.position.x = Math.max(-18, Math.min(18, playerGroup.position.x));
    playerGroup.position.z = Math.max(-18, Math.min(16, playerGroup.position.z));
    playerGroup.position.y = 0;

    playerGroup.rotation.z = THREE.MathUtils.lerp(playerGroup.rotation.z, targetRoll, 0.1);
    playerGroup.rotation.x = THREE.MathUtils.lerp(playerGroup.rotation.x, targetPitch, 0.1);

    // --- 3. CONTINUOUS BEAM LASER ---
    if (keys['Space'] && beamPowerTime > 0) {
        beamMesh.visible = true;
        beamLight.visible = true;
        beamPowerTime--;

        // 1. SCALE: Make the beam very long (e.g., 60 units)
        const beamLength = 60;
        beamMesh.scale.set(1, beamLength, 1);

        // 2. POSITION: Move it forward by half its length so it starts at the ship
        // If we don't do this, the beam will stick out the back of the ship too!
        beamMesh.position.set(
            playerGroup.position.x,
            playerGroup.position.y,
            playerGroup.position.z - (beamLength / 2)
        );

        // 3. LIGHTING: Keep the glow at the ship's nose
        beamLight.position.set(playerGroup.position.x, 0, playerGroup.position.z - 2);

        // FX: Add some "recoil" shake
        camera.position.x += (Math.random() - 0.5) * 0.1;

        // 4. HIT DETECTION (Beam Collision)
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            // Check if asteroid is in front of ship and aligned with the beam width
            if (a.position.z < playerGroup.position.z &&
                Math.abs(a.position.x - playerGroup.position.x) < a.geometry.parameters.radius + 0.5) {

                a.userData.hp -= 0.2; // High damage per frame
                if (a.material.emissive) a.material.emissive.setHex(0xffffff);

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

    // --- 4. UFO BOSS LOGIC (WITH VARIABLE DELAY) ---
    if (score >= 5000 && !ufoActive) {
        const timeSinceLastDefeat = Date.now() - lastUfoDefeatTime;

        // Only start the spawn sequence if we haven't started yet 
        // AND enough time has passed since the last one died
        if (!ufoSpawningInitiated && timeSinceLastDefeat > nextUfoDelay) {
            ufoSpawningInitiated = true;
            ufoSpawnTimer = 180; // 3-second visual warning countdown

            const multiUI = document.getElementById('multiplier-ui');
            if (multiUI) {
                multiUI.innerText = "WARNING: HIGH-ENERGY SIGNATURE DETECTED";
                multiUI.style.color = "#ff0000";
            }
        }

        // While the warning is active, shake the camera and count down
        if (ufoSpawningInitiated && ufoSpawnTimer > 0) {
            ufoSpawnTimer--;
            camera.position.x += (Math.random() - 0.5) * 0.08;

            if (ufoSpawnTimer === 1) {
                spawnUfo();
            }
        }
    }

    if (ufoActive && ufo) {
        ufo.position.z = THREE.MathUtils.lerp(ufo.position.z, -40, 0.02);
        ufo.position.x = THREE.MathUtils.lerp(ufo.position.x, playerGroup.position.x, 0.03);
        ufo.rotation.y += 0.05;

        if (Date.now() - lastUfoShot > 2000) {
            fireUfoProjectile();
            lastUfoShot = Date.now();
        }

        // Standard Phasers Hit Detection
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            if (bullet.position.distanceTo(ufo.position) < 3.2) {
                ufoHP--;
                updateBossUI();
                if (ufo.children[0]) {
                    ufo.children[0].material.emissive.setHex(0x00ff00);
                    setTimeout(() => { if (ufo) ufo.children[0].material.emissive.setHex(0x000000); }, 50);
                }
                createExplosion(bullet.position, 0x00ff00);
                scene.remove(bullet);
                bullets.splice(j, 1);
            }
        }

        // Beam Hit Detection
        if (beamMesh.visible && Math.abs(ufo.position.x - playerGroup.position.x) < 2.8) {
            ufoHP -= 0.15;
            updateBossUI();
            if (ufo.children[0]) ufo.children[0].material.emissive.setHex(0x00ff00);
        }

        if (ufoHP <= 0) handleUfoDefeat();
    }

    // --- 5. UFO PROJECTILES ---
    for (let i = ufoProjectiles.length - 1; i >= 0; i--) {
        const p = ufoProjectiles[i];
        p.position.z += 0.5;
        if (p.position.distanceTo(playerGroup.position) < 1.5) {
            if (!hasShield) {
                health--;
                updateHealthUI();
                if (health <= 0) { handleGameOver(); return; }
            } else {
                hasShield = false;
                shieldBubble.visible = false;
            }
            scene.remove(p);
            ufoProjectiles.splice(i, 1);
            createExplosion(playerGroup.position, 0xff00ff);
            continue;
        }
        if (p.position.z > 30) { scene.remove(p); ufoProjectiles.splice(i, 1); }
    }

    // --- 6. POWER-UPS & ASTEROIDS ---
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i]; p.position.z += 0.12 * warpFactor;
        if (playerGroup.position.distanceTo(p.position) < 2.0) {
            if (p.userData.type === 'laser') beamPowerTime = 300;
            else if (p.userData.type === 'triple') { isTripleShot = true; setTimeout(() => isTripleShot = false, 10000); }
            else if (p.userData.type === 'shield') { hasShield = true; shieldBubble.visible = true; }
            else if (p.userData.type === 'health') { if (health < maxHealth) health++; updateHealthUI(); }
            scene.remove(p); powerUps.splice(i, 1);
        }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.position.z += a.userData.speed * warpFactor;
        a.position.x += Math.sin(a.position.z * a.userData.curveSpeed) * a.userData.curveAmount;
        a.rotation.x += a.userData.rotX || 0.02;
        a.rotation.y += a.userData.rotY || 0.01;
        a.position.y = 0;

        if (playerGroup.position.distanceTo(a.position) < 1.5 + a.geometry.parameters.radius) {
            if (hasShield) { hasShield = false; shieldBubble.visible = false; }
            else { health--; updateHealthUI(); if (health <= 0) { handleGameOver(); return; } }
            createExplosion(a.position, 0xff0000); scene.remove(a); asteroids.splice(i, 1); continue;
        }

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (bullets[j].position.distanceTo(a.position) < a.geometry.parameters.radius + 0.6) {
                a.userData.hp--;
                if (a.userData.hp <= 0) {
                    if (a.userData.isHeavy) camera.position.x += (Math.random() - 0.5) * 1.5;
                    createExplosion(a.position, a.userData.color);
                    addScore(a.userData.isHeavy ? 300 : 100);
                    scene.remove(a); asteroids.splice(i, 1);
                } else {
                    a.material.emissive.setHex(0xffffff);
                    setTimeout(() => { if (a && a.material) a.material.emissive.setHex(0x000000); }, 50);
                }
                scene.remove(bullets[j]); bullets.splice(j, 1); break;
            }
        }
        if (a && a.position.z > 30) { scene.remove(a); asteroids.splice(i, 1); }
    }

    // --- 7. BULLET MOVEMENT & FX ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].position.z -= 1.2;
        if (bullets[i].position.z < -200) { scene.remove(bullets[i]); bullets.splice(i, 1); }
    }

    engineMat.emissiveIntensity = 1.5 + Math.sin(Date.now() * 0.005) * 0.5;
    deflectorMat.emissiveIntensity = 1 + Math.sin(Date.now() * 0.002) * 0.3;

    // --- 8. PARTICLES CLEANUP ---
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.position.add(p.userData.velocity);
        p.userData.life -= 0.02;
        p.material.opacity = p.userData.life;
        p.scale.multiplyScalar(0.96);
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }

    renderer.render(scene, camera);
}
// Change the very last lines to this:
window.onload = () => {
    updateHealthUI();
    displayLeaderboard();
};