const container = document.getElementById("game-container");
const scoreEl = document.getElementById("score");
const ammoEl = document.getElementById("ammo");

let score = 0;
let keys = {};

// 2 COIN = 1 LASTİK ÖRDEK EKONOMİSİ
let coinCount = 0;
let rubberDuckCount = 0;
const maxRubberDucks = 5;

// Karakter Hareket Değişkenleri
let duckAngle = 0;
const baseSpeed = 0.34;
const playerRadius = 1.6;
let isSprinting = false;

// Oyuncu Gaga İtişi & Savrulma Fiziği
let isPecking = false;
let peckTimer = 0;
let peckCooldown = 0;
let playerKnockbackX = 0;
let playerKnockbackZ = 0;
let screenShake = 0;

// Dinamik Yürüme Animasyonu
let playerWalkCycle = 0;

// 1. Sahne, Gökyüzü ve Gündüz Işıklandırması
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0e7ff);
scene.fog = new THREE.FogExp2(0xa0e7ff, 0.007);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xfff8e7, 0.95);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.3);
sunLight.position.set(50, 80, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

// 2. Çimenlik Zemin
const arenaSize = 140;
const arenaLimit = arenaSize / 2 - 4;

function createGrassTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#55a630";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 3500; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "#2b9348" : "#80b918";
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        ctx.fillRect(x, y, 4, 4);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    return texture;
}

const grassFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(arenaSize, arenaSize),
    new THREE.MeshStandardMaterial({ map: createGrassTexture(), roughness: 0.9 })
);
grassFloor.rotation.x = -Math.PI / 2;
grassFloor.receiveShadow = true;
scene.add(grassFloor);

// 3. Gölet, Kıyı Taşları ve Nilüferler
const pondRadius = 22;
const pond = new THREE.Mesh(
    new THREE.CircleGeometry(pondRadius, 48),
    new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 })
);
pond.rotation.x = -Math.PI / 2;
pond.position.y = 0.05;
pond.receiveShadow = true;
scene.add(pond);

const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d99ae, roughness: 0.8 });
for (let a = 0; a < Math.PI * 2; a += 0.28) {
    const rDist = pondRadius + (Math.random() * 1.2 - 0.6);
    const rx = Math.cos(a) * rDist;
    const rz = Math.sin(a) * rDist;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.9, 1), rockMat);
    rock.position.set(rx, 0.4, rz);
    rock.scale.set(1, 0.6, 1);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
}

const lilyMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.5 });
const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff70a6, roughness: 0.3 });
let lilies = [];

for (let i = 0; i < 7; i++) {
    const lGroup = new THREE.Group();
    const lPad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 16), lilyMat);
    lGroup.add(lPad);

    const lFlower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 1), flowerMat);
    lFlower.position.set(0.3, 0.2, 0.2);
    lGroup.add(lFlower);

    const dist = 5 + Math.random() * (pondRadius - 8);
    const ang = Math.random() * Math.PI * 2;
    lGroup.position.set(Math.cos(ang) * dist, 0.08, Math.sin(ang) * dist);
    scene.add(lGroup);
    lilies.push({ group: lGroup, baseY: 0.08, offset: Math.random() * Math.PI * 2 });
}

// 4. Bulutlar
let clouds = [];
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.9 });

function createCloud(x, y, z) {
    const cGroup = new THREE.Group();
    const puffCount = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < puffCount; i++) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2 + Math.random() * 1.8, 1), cloudMat);
        puff.position.set((i - puffCount / 2) * 2.8, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.8);
        cGroup.add(puff);
    }
    cGroup.position.set(x, y, z);
    scene.add(cGroup);
    clouds.push(cGroup);
}
createCloud(-40, 32, -30);
createCloud(20, 28, 40);
createCloud(50, 35, -50);
createCloud(-60, 30, 20);

// 5. Park Engelleri
let solidObstacles = [];

function buildParkEnvironment() {
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf4f1de, roughness: 0.7 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.7 });
    const postSpacing = 6;
    const half = arenaSize / 2 - 2;

    function buildFenceLine(startX, startZ, endX, endZ) {
        const dist = Math.hypot(endX - startX, endZ - startZ);
        const count = Math.floor(dist / postSpacing);
        const dx = (endX - startX) / count;
        const dz = (endZ - startZ) / count;

        for (let i = 0; i <= count; i++) {
            const px = startX + dx * i;
            const pz = startZ + dz * i;

            const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.8, 0.45), postMat);
            post.position.set(px, 0.9, pz);
            post.castShadow = true;
            scene.add(post);

            if (i < count) {
                const rail1 = new THREE.Mesh(new THREE.BoxGeometry(dx !== 0 ? postSpacing : 0.2, 0.25, dz !== 0 ? postSpacing : 0.2), fenceMat);
                rail1.position.set(px + dx / 2, 1.3, pz + dz / 2);
                rail1.castShadow = true;
                scene.add(rail1);

                const rail2 = new THREE.Mesh(new THREE.BoxGeometry(dx !== 0 ? postSpacing : 0.2, 0.25, dz !== 0 ? postSpacing : 0.2), fenceMat);
                rail2.position.set(px + dx / 2, 0.65, pz + dz / 2);
                rail2.castShadow = true;
                scene.add(rail2);
            }
        }
    }

    buildFenceLine(-half, -half, half, -half);
    buildFenceLine(-half, half, half, half);
    buildFenceLine(-half, -half, -half, half);
    buildFenceLine(half, -half, half, half);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x38b000, roughness: 0.8 });

    for (let i = 0; i < 16; i++) {
        let tx = (Math.random() - 0.5) * (arenaSize - 20);
        let tz = (Math.random() - 0.5) * (arenaSize - 20);
        if (Math.hypot(tx, tz) < pondRadius + 6) continue;

        const treeGroup = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 4.5, 8), woodMat);
        trunk.position.y = 2.25;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 1), foliageMat);
        foliage.position.y = 5.6;
        foliage.castShadow = true;
        treeGroup.add(foliage);

        treeGroup.position.set(tx, 0, tz);
        scene.add(treeGroup);
        solidObstacles.push({ x: tx, z: tz, radius: 2.2 });
    }

    const flowerWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const flowerYellow = new THREE.MeshStandardMaterial({ color: 0xffea00 });
    const flowerPetalGeo = new THREE.DodecahedronGeometry(0.22, 0);

    for (let i = 0; i < 35; i++) {
        let fx = (Math.random() - 0.5) * (arenaSize - 20);
        let fz = (Math.random() - 0.5) * (arenaSize - 20);
        if (Math.hypot(fx, fz) < pondRadius + 2) continue;

        const fl = new THREE.Mesh(flowerPetalGeo, Math.random() > 0.5 ? flowerWhite : flowerYellow);
        fl.position.set(fx, 0.15, fz);
        fl.scale.set(1, 0.5, 1);
        scene.add(fl);
    }
}
buildParkEnvironment();

// ==============================================================
// 6. UZATILMIŞ DİNAMİK TURUNCU ÖRDEK BACAKLARI (WADDLE İÇİN)
// ==============================================================
const footOrangeMat = new THREE.MeshStandardMaterial({ 
    color: 0xff5e00, 
    roughness: 0.35 
});

const hipHeight = 0.82; // Bacakların bağlandığı kalça yüksekliği

function createDuckFoot() {
    const footPivot = new THREE.Group();

    // Uzatılmış Bacak Kemiği (0.42 -> 0.76)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.76, 8), footOrangeMat);
    leg.position.y = -0.38;
    leg.castShadow = true;
    footPivot.add(leg);

    // Belirgin ve Geniş Perdeli Palet Ayak
    const footPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.65), footOrangeMat);
    footPaddle.position.set(0, -0.76, -0.18);
    footPaddle.castShadow = true;
    footPivot.add(footPaddle);

    return footPivot;
}

// ==============================================================
// 7. OYUNCU ÖRDEK MODELİ
// ==============================================================
const playerGroup = new THREE.Group();
scene.add(playerGroup);

const shadowGeo = new THREE.CircleGeometry(1.3, 24);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b4332, transparent: true, opacity: 0.4, depthWrite: false });
const footShadow = new THREE.Mesh(shadowGeo, shadowMat);
footShadow.rotation.x = -Math.PI / 2;
footShadow.position.y = 0.03;
playerGroup.add(footShadow);

// Oyuncunun Uzatılmış Bacakları
const playerLeftFoot = createDuckFoot();
playerLeftFoot.position.set(-0.48, hipHeight, 0);
playerGroup.add(playerLeftFoot);

const playerRightFoot = createDuckFoot();
playerRightFoot.position.set(0.48, hipHeight, 0);
playerGroup.add(playerRightFoot);

let playerDuckMesh = null;
let duckTemplate = null;

const loader = new THREE.GLTFLoader();

loader.load('./models/duck.glb', (gltf) => {
    const raw = gltf.scene;

    const box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const footCutoff = box.min.y + size.y * 0.20;

    raw.traverse((child) => {
        if (child.isMesh) {
            const name = (child.name || "").toLowerCase();
            if (name.includes('foot') || name.includes('feet') || name.includes('leg') || name.includes('ayak')) {
                child.visible = false;
                return;
            }

            if (child.geometry && child.geometry.attributes.position) {
                child.geometry = child.geometry.clone();
                const pos = child.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    let vy = pos.getY(i);
                    if (vy < footCutoff) {
                        pos.setY(i, footCutoff);
                    }
                }
                pos.needsUpdate = true;
                child.geometry.computeVertexNormals();
            }

            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
        }
    });

    raw.position.x = -center.x;
    raw.position.y = -footCutoff;
    raw.position.z = -center.z;
    raw.rotation.y = Math.PI;

    const wrapper = new THREE.Group();
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetScale = 3.2 / maxDim;
    wrapper.scale.set(targetScale, targetScale, targetScale);
    wrapper.add(raw);

    duckTemplate = wrapper;
    playerDuckMesh = duckTemplate.clone(true);
    playerDuckMesh.position.y = hipHeight; // Uzun bacakların üstüne oturtuldu!
    playerGroup.add(playerDuckMesh);

    for (let i = 0; i < 4; i++) {
        spawnBotWithModel();
    }
}, undefined, (err) => {
    console.error("duck.glb yükleme hatası:", err);
});

// ==============================================================
// 8. DÜŞEN COİNLER
// ==============================================================
let droppedCoins = [];
const coinGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.16, 20);
const coinMat = new THREE.MeshStandardMaterial({ 
    color: 0xffd000, 
    metalness: 0.75, 
    roughness: 0.25, 
    emissive: 0xffa500, 
    emissiveIntensity: 0.45 
});

function spawnDroppedCoin(x, y, z, pushDirX = 0, pushDirZ = 0) {
    const coinMesh = new THREE.Mesh(coinGeo, coinMat);
    coinMesh.rotation.z = Math.PI / 2;
    coinMesh.position.set(x, y + 1.8, z);
    coinMesh.castShadow = true;
    scene.add(coinMesh);

    droppedCoins.push({
        mesh: coinMesh,
        vx: pushDirX * 0.38 + (Math.random() - 0.5) * 0.14,
        vy: 0.42 + Math.random() * 0.12,
        vz: pushDirZ * 0.38 + (Math.random() - 0.5) * 0.14,
        baseY: 1.35,
        isLanded: false,
        floatTime: Math.random() * Math.PI * 2,
        life: 600
    });
}

// ==========================================
// 9. SORU İŞARETLİ KUTULAR
// ==========================================
function createQuestionBoxTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(0, 0, 256, 256);

    ctx.lineWidth = 16;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(12, 12, 232, 232);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(28, 28, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(228, 28, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(28, 228, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(228, 228, 6, 0, Math.PI * 2); ctx.fill();

    ctx.font = "bold 155px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 128, 136);

    return new THREE.CanvasTexture(canvas);
}

const questionBoxMat = new THREE.MeshStandardMaterial({
    map: createQuestionBoxTexture(),
    emissive: 0x3d2600,
    roughness: 0.35,
    metalness: 0.1
});
const boxGeometry = new THREE.BoxGeometry(1.85, 1.85, 1.85);

let boxes = [];

function spawnBox() {
    if (boxes.length < 6) {
        const boxGroup = new THREE.Group();

        const boxMesh = new THREE.Mesh(boxGeometry, questionBoxMat);
        boxMesh.castShadow = true;
        boxGroup.add(boxMesh);

        const glowRing = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 1.4, 20),
            new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
        );
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.y = -1.15;
        boxGroup.add(glowRing);

        const spawnX = (Math.random() - 0.5) * (arenaSize - 25);
        const spawnZ = (Math.random() - 0.5) * (arenaSize - 25);
        boxGroup.position.set(spawnX, 1.6, spawnZ);

        scene.add(boxGroup);
        boxes.push({ group: boxGroup, mesh: boxMesh, baseY: 1.6, floatOffset: Math.random() * Math.PI * 2 });
    }
}
setInterval(spawnBox, 2800);

// ==========================================
// 10. BOT ÖRDEKLER (UZUN BACAKLI)
// ==========================================
let bots = [];
const botRadius = 1.8;

function spawnBotWithModel() {
    if (!duckTemplate) return;
    const botDuck = duckTemplate.clone(true);
    botDuck.position.y = hipHeight;

    const spawnX = (Math.random() - 0.5) * 50;
    const spawnZ = (Math.random() - 0.5) * 50;
    
    const botGroup = new THREE.Group();
    botGroup.position.set(spawnX, 0, spawnZ);
    botGroup.add(botDuck);

    const bShadow = footShadow.clone();
    botGroup.add(bShadow);

    const bLeftFoot = createDuckFoot();
    bLeftFoot.position.set(-0.48, hipHeight, 0);
    botGroup.add(bLeftFoot);

    const bRightFoot = createDuckFoot();
    bRightFoot.position.set(0.48, hipHeight, 0);
    botGroup.add(bRightFoot);

    scene.add(botGroup);

    const startAngle = Math.random() * Math.PI * 2;
    bots.push({
        group: botGroup,
        mesh: botDuck,
        leftFoot: bLeftFoot,
        rightFoot: bRightFoot,
        angle: startAngle,
        targetAngle: startAngle,
        speed: 0.08 + Math.random() * 0.03,
        walkCycle: Math.random() * 10,
        changeDirectionTimer: 0,
        pushVelocityX: 0,
        pushVelocityZ: 0,
        spinVelocity: 0,
        isInPondPenalty: false,
        isAngry: false,
        revengeTimer: 0,
        isPeckingBack: false,
        peckBackTimer: 0,
        hasCoin: true
    });
}

// ==========================================
// 11. GAGA İTİŞİ & TÜY SİSTEMİ
// ==========================================
let feathers = [];
const featherMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

function spawnFeathers(x, y, z) {
    for (let i = 0; i < 9; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), featherMat);
        f.scale.set(1.4, 0.4, 0.8);
        f.position.set(x + (Math.random() - 0.5) * 0.6, y + 0.5, z + (Math.random() - 0.5) * 0.6);
        scene.add(f);

        feathers.push({
            mesh: f,
            vx: (Math.random() - 0.5) * 0.22,
            vy: 0.1 + Math.random() * 0.14,
            vz: (Math.random() - 0.5) * 0.22,
            rotSpeed: 0.2,
            life: 42
        });
    }
}

function performPeckAttack() {
    if (peckCooldown > 0 || isPecking) return;

    isPecking = true;
    peckTimer = 14;
    peckCooldown = 26;

    const forwardX = -Math.sin(duckAngle);
    const forwardZ = -Math.cos(duckAngle);
    const peckReachX = playerGroup.position.x + forwardX * 2.2;
    const peckReachZ = playerGroup.position.z + forwardZ * 2.2;

    bots.forEach(bot => {
        const dist = Math.hypot(bot.group.position.x - peckReachX, bot.group.position.z - peckReachZ);
        if (dist < 2.6) {
            const pushDirX = bot.group.position.x - playerGroup.position.x;
            const pushDirZ = bot.group.position.z - playerGroup.position.z;
            const len = Math.hypot(pushDirX, pushDirZ) || 1;

            bot.pushVelocityX = (pushDirX / len) * 1.35;
            bot.pushVelocityZ = (pushDirZ / len) * 1.35;
            bot.spinVelocity = 0.35;

            spawnDroppedCoin(bot.group.position.x, 0.8, bot.group.position.z, pushDirX / len, pushDirZ / len);

            bot.isAngry = true;
            bot.revengeTimer = 22;

            spawnFeathers(bot.group.position.x, 1.2, bot.group.position.z);
            score += 25;
            scoreEl.innerText = score;
        }
    });
}

// ==========================================
// 12. LASTİK ÖRDEK (FIRLATILAN)
// ==========================================
const yellowDuckMat = new THREE.MeshStandardMaterial({ 
    color: 0xffea00, 
    emissive: 0xffaa00, 
    emissiveIntensity: 0.45,
    roughness: 0.2
});
const orangeBeakMat = new THREE.MeshStandardMaterial({ 
    color: 0xff4400, 
    emissive: 0xaa2200, 
    emissiveIntensity: 0.35, 
    roughness: 0.25 
});
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

function createRubberDuckMesh() {
    const rubberDuckGroup = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 16), yellowDuckMat);
    body.scale.set(1.1, 0.95, 1.45);
    body.castShadow = true;
    rubberDuckGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), yellowDuckMat);
    head.position.set(0, 0.6, -0.42);
    head.castShadow = true;
    rubberDuckGroup.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.46, 12), orangeBeakMat);
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, 0.54, -0.88);
    rubberDuckGroup.add(beak);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    eyeR.position.set(0.25, 0.72, -0.62);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    eyeL.position.set(-0.25, 0.72, -0.62);
    rubberDuckGroup.add(eyeR);
    rubberDuckGroup.add(eyeL);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.38, 10), yellowDuckMat);
    tail.rotation.x = Math.PI / 3.0;
    tail.position.set(0, 0.38, 0.85);
    rubberDuckGroup.add(tail);

    const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.2, 0.08, 10, 24),
        new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.65 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.2;
    rubberDuckGroup.add(halo);

    rubberDuckGroup.scale.set(2.2, 2.2, 2.2);
    return rubberDuckGroup;
}

let thrownRubberDucks = [];
let duckSplashParticles = [];
const splashMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.85 });

function updateHUD() {
    let duckText = rubberDuckCount > 0 ? `🐥 x${rubberDuckCount}` : `🐥 x0`;
    let coinText = `🪙 ${coinCount}/2 Coin`;

    ammoEl.innerText = `${duckText} | ${coinText}`;
    ammoEl.style.color = rubberDuckCount > 0 ? "#ffd166" : "#ffffff";
}

function throwRubberDuck() {
    if (rubberDuckCount <= 0) return;
    const rDuck = createRubberDuckMesh();
    const forwardX = -Math.sin(duckAngle);
    const forwardZ = -Math.cos(duckAngle);

    rDuck.position.set(
        playerGroup.position.x + forwardX * 2.5, 
        1.7, 
        playerGroup.position.z + forwardZ * 2.5
    );
    scene.add(rDuck);

    thrownRubberDucks.push({
        group: rDuck,
        dirX: forwardX * 0.78,
        dirZ: forwardZ * 0.78,
        spinSpeed: 0.14,
        life: 120
    });

    rubberDuckCount--;
    updateHUD();
}

window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === "Space") { e.preventDefault(); throwRubberDuck(); }
    if (e.key === "Shift" || e.code === "ShiftLeft") isSprinting = true;
    if (e.key === "e" || e.key === "E") performPeckAttack();
});

window.addEventListener("keyup", (e) => { 
    keys[e.key.toLowerCase()] = false; 
    if (e.key === "Shift" || e.code === "ShiftLeft") isSprinting = false;
});

// Oyun Döngüsü
let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    pond.material.opacity = 0.8 + Math.sin(elapsedTime * 2.5) * 0.08;
    lilies.forEach(l => {
        l.group.position.y = l.baseY + Math.sin(elapsedTime * 2.0 + l.offset) * 0.02;
    });

    clouds.forEach(c => {
        c.position.x += 0.02;
        if (c.position.x > arenaSize / 2 + 20) c.position.x = -arenaSize / 2 - 20;
    });

    // Oyuncu Gaga Animasyonu
    if (peckCooldown > 0) peckCooldown--;
    if (isPecking) {
        peckTimer--;
        if (playerDuckMesh) {
            playerDuckMesh.position.z = THREE.MathUtils.lerp(playerDuckMesh.position.z, -0.65, 0.4);
            playerDuckMesh.rotation.x = THREE.MathUtils.lerp(playerDuckMesh.rotation.x, 0.38, 0.4);
        }
        if (peckTimer <= 0) isPecking = false;
    } else if (playerDuckMesh) {
        playerDuckMesh.position.z = THREE.MathUtils.lerp(playerDuckMesh.position.z, 0, 0.2);
    }

    // Yön Kontrolleri
    let turn = 0;
    if (keys["arrowleft"] || keys["a"]) turn += 1;
    if (keys["arrowright"] || keys["d"]) turn -= 1;
    duckAngle += turn * 0.052;

    let moveAmount = 0;
    const currentSpeed = isSprinting ? baseSpeed * 1.55 : baseSpeed;

    if (keys["arrowup"] || keys["w"]) moveAmount = currentSpeed;
    else if (keys["arrowdown"] || keys["s"]) moveAmount = -currentSpeed * 0.55;

    const isMoving = Math.abs(moveAmount) > 0.01;
    const isTurning = turn !== 0;

    // Hareket ve Geri Savrulma
    let nextX = playerGroup.position.x - Math.sin(duckAngle) * moveAmount + playerKnockbackX;
    let nextZ = playerGroup.position.z - Math.cos(duckAngle) * moveAmount + playerKnockbackZ;

    playerKnockbackX *= 0.86;
    playerKnockbackZ *= 0.86;

    for (let obs of solidObstacles) {
        const dist = Math.hypot(nextX - obs.x, nextZ - obs.z);
        if (dist < playerRadius + obs.radius) {
            const pushAngle = Math.atan2(nextZ - obs.z, nextX - obs.x);
            nextX = obs.x + Math.cos(pushAngle) * (playerRadius + obs.radius + 0.05);
            nextZ = obs.z + Math.sin(pushAngle) * (playerRadius + obs.radius + 0.05);
            break;
        }
    }

    if (Math.abs(nextX) < arenaLimit) playerGroup.position.x = nextX;
    if (Math.abs(nextZ) < arenaLimit) playerGroup.position.z = nextZ;

    // ==============================================================
    // UZUN BACAKLARLA BELİRGİN PAYTAK YÜRÜYÜŞ (WADDLE)
    // ==============================================================
    const inPond = Math.hypot(playerGroup.position.x, playerGroup.position.z) < pondRadius - 1.0;
    const targetBaseY = inPond ? 0.35 : hipHeight;

    if (isMoving) {
        const stepSpeed = isSprinting ? 0.30 : 0.20;
        playerWalkCycle += stepSpeed;

        // Geniş açılı bacak savrulması (Uzun bacak adımı)
        const legSwing = Math.sin(playerWalkCycle) * (isSprinting ? 0.85 : 0.65);
        playerLeftFoot.rotation.x = legSwing;
        playerRightFoot.rotation.x = -legSwing;

        // Yukarı kalkma & yere basma yaylanması
        playerLeftFoot.position.y = hipHeight + Math.max(0, Math.sin(playerWalkCycle)) * 0.20;
        playerRightFoot.position.y = hipHeight + Math.max(0, -Math.sin(playerWalkCycle)) * 0.20;

        // Gövdenin komik paytak salınımı (Waddle)
        if (playerDuckMesh && !isPecking) {
            const waddleAngle = Math.sin(playerWalkCycle) * (isSprinting ? 0.28 : 0.20);
            playerDuckMesh.rotation.z = THREE.MathUtils.lerp(playerDuckMesh.rotation.z, waddleAngle, 0.35);
            playerDuckMesh.rotation.x = THREE.MathUtils.lerp(playerDuckMesh.rotation.x, (isSprinting ? 0.24 : 0.10), 0.3);
            playerDuckMesh.position.y = THREE.MathUtils.lerp(playerDuckMesh.position.y, targetBaseY + Math.abs(Math.sin(playerWalkCycle)) * 0.16, 0.3);
        }

        footShadow.scale.setScalar(1.0 - Math.abs(Math.sin(playerWalkCycle)) * 0.15);
    } else {
        // Durunca ayaklar dikelir
        playerLeftFoot.rotation.x = THREE.MathUtils.lerp(playerLeftFoot.rotation.x, 0, 0.25);
        playerRightFoot.rotation.x = THREE.MathUtils.lerp(playerRightFoot.rotation.x, 0, 0.25);
        playerLeftFoot.position.y = THREE.MathUtils.lerp(playerLeftFoot.position.y, hipHeight, 0.25);
        playerRightFoot.position.y = THREE.MathUtils.lerp(playerRightFoot.position.y, hipHeight, 0.25);

        if (playerDuckMesh && !isPecking) {
            playerDuckMesh.rotation.z = THREE.MathUtils.lerp(playerDuckMesh.rotation.z, 0, 0.25);
            playerDuckMesh.rotation.x = THREE.MathUtils.lerp(playerDuckMesh.rotation.x, 0, 0.25);
            playerDuckMesh.position.y = THREE.MathUtils.lerp(playerDuckMesh.position.y, targetBaseY, 0.25);
        }
        footShadow.scale.setScalar(1.0);
    }

    playerGroup.rotation.y = duckAngle;

    // Kamera Takibi
    const camDist = 6.5;
    const camHeight = 3.4;
    let shakeOffsetX = (Math.random() - 0.5) * screenShake;
    let shakeOffsetZ = (Math.random() - 0.5) * screenShake;
    screenShake *= 0.85;

    const targetCamX = playerGroup.position.x + Math.sin(duckAngle) * camDist + shakeOffsetX;
    const targetCamZ = playerGroup.position.z + Math.cos(duckAngle) * camDist + shakeOffsetZ;
    const targetCamY = playerGroup.position.y + camHeight;

    camera.position.x += (targetCamX - camera.position.x) * 0.2;
    camera.position.y += (targetCamY - camera.position.y) * 0.2;
    camera.position.z += (targetCamZ - camera.position.z) * 0.2;
    camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1.2, playerGroup.position.z);

    // Kutu Toplama
    for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i];
        b.mesh.rotation.y += 0.028;
        b.group.position.y = b.baseY + Math.sin(elapsedTime * 3.2 + b.floatOffset) * 0.28;

        if (playerGroup.position.distanceTo(b.group.position) < 2.6) {
            scene.remove(b.group);
            boxes.splice(i, 1);

            coinCount++;
            if (coinCount >= 2) {
                if (rubberDuckCount < maxRubberDucks) rubberDuckCount++;
                coinCount = 0;
            }
            updateHUD();
        }
    }

    // Düşen Coinler
    for (let i = droppedCoins.length - 1; i >= 0; i--) {
        const c = droppedCoins[i];

        if (!c.isLanded) {
            c.mesh.position.x += c.vx;
            c.mesh.position.y += c.vy;
            c.mesh.position.z += c.vz;
            c.vy -= 0.016;
            c.mesh.rotation.y += 0.15;

            if (c.mesh.position.y <= c.baseY) {
                c.mesh.position.y = c.baseY;
                c.isLanded = true;
                c.vx = 0;
                c.vz = 0;
            }
        } else {
            c.floatTime += 0.05;
            c.mesh.position.y = c.baseY + Math.sin(c.floatTime) * 0.18;
            c.mesh.rotation.y += 0.05;
        }

        c.life--;

        if (playerGroup.position.distanceTo(c.mesh.position) < 2.2) {
            scene.remove(c.mesh);
            droppedCoins.splice(i, 1);

            coinCount++;
            if (coinCount >= 2) {
                if (rubberDuckCount < maxRubberDucks) rubberDuckCount++;
                coinCount = 0;
            }
            score += 50;
            scoreEl.innerText = score;
            updateHUD();
            continue;
        }

        if (c.life <= 0) {
            scene.remove(c.mesh);
            droppedCoins.splice(i, 1);
        }
    }

    // Uçuşan Tüyler
    for (let i = feathers.length - 1; i >= 0; i--) {
        const f = feathers[i];
        f.mesh.position.x += f.vx;
        f.mesh.position.y += f.vy;
        f.mesh.position.z += f.vz;
        f.vy -= 0.005;
        f.mesh.rotation.y += f.rotSpeed;
        f.life--;

        if (f.life <= 0 || f.mesh.position.y < 0.1) {
            scene.remove(f.mesh);
            feathers.splice(i, 1);
        }
    }

    // Fırlatılan Lastik Ördekler
    for (let i = thrownRubberDucks.length - 1; i >= 0; i--) {
        const rd = thrownRubberDucks[i];
        rd.group.position.x += rd.dirX;
        rd.group.position.z += rd.dirZ;
        rd.group.rotation.x += rd.spinSpeed;
        rd.group.rotation.y += rd.spinSpeed * 0.8;

        if (Math.random() > 0.3) {
            const p = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), splashMat);
            p.position.copy(rd.group.position);
            p.position.y += (Math.random() - 0.5) * 0.3;
            scene.add(p);
            duckSplashParticles.push({ mesh: p, life: 28 });
        }

        rd.life--;

        if (rd.life <= 0 || Math.abs(rd.group.position.x) > arenaLimit || Math.abs(rd.group.position.z) > arenaLimit) {
            scene.remove(rd.group);
            thrownRubberDucks.splice(i, 1);
            continue;
        }

        for (let bIndex = bots.length - 1; bIndex >= 0; bIndex--) {
            const bot = bots[bIndex];
            if (rd.group.position.distanceTo(bot.group.position) < 2.8) {
                spawnFeathers(bot.group.position.x, 1.2, bot.group.position.z);
                spawnDroppedCoin(bot.group.position.x, 1.2, bot.group.position.z, 0.4, 0.2);
                spawnDroppedCoin(bot.group.position.x, 1.2, bot.group.position.z, -0.4, -0.2);

                scene.remove(bot.group);
                bots.splice(bIndex, 1);
                scene.remove(rd.group);
                thrownRubberDucks.splice(i, 1);
                score += 100;
                scoreEl.innerText = score;
                break;
            }
        }
    }

    // Köpük temizliği
    for (let i = duckSplashParticles.length - 1; i >= 0; i--) {
        const sp = duckSplashParticles[i];
        sp.mesh.scale.multiplyScalar(0.93);
        sp.life--;
        if (sp.life <= 0) {
            scene.remove(sp.mesh);
            duckSplashParticles.splice(i, 1);
        }
    }

    // BOTLARIN UZUN BACAKLI HAREKETİ
    bots.forEach(b => {
        const botInPond = Math.hypot(b.group.position.x, b.group.position.z) < pondRadius - 1.0;
        const botTargetBaseY = botInPond ? 0.35 : hipHeight;

        if (Math.abs(b.pushVelocityX) > 0.05 || Math.abs(b.pushVelocityZ) > 0.05) {
            b.group.position.x += b.pushVelocityX;
            b.group.position.z += b.pushVelocityZ;
            b.pushVelocityX *= 0.88;
            b.pushVelocityZ *= 0.88;

            b.group.rotation.y += b.spinVelocity;
            b.spinVelocity *= 0.9;
        } 
        else if (b.isAngry) {
            b.revengeTimer--;

            const toPlayerX = playerGroup.position.x - b.group.position.x;
            const toPlayerZ = playerGroup.position.z - b.group.position.z;
            const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

            b.angle = Math.atan2(-toPlayerX, -toPlayerZ);
            b.group.rotation.y = b.angle;

            if (distToPlayer > 2.2) {
                b.group.position.x -= Math.sin(b.angle) * (b.speed * 2.3);
                b.group.position.z -= Math.cos(b.angle) * (b.speed * 2.3);

                b.walkCycle += 0.30;
                const bLegSwing = Math.sin(b.walkCycle) * 0.85;
                b.leftFoot.rotation.x = bLegSwing;
                b.rightFoot.rotation.x = -bLegSwing;

                b.leftFoot.position.y = hipHeight + Math.max(0, Math.sin(b.walkCycle)) * 0.20;
                b.rightFoot.position.y = hipHeight + Math.max(0, -Math.sin(b.walkCycle)) * 0.20;

                b.mesh.rotation.z = Math.sin(b.walkCycle) * 0.26;
                b.mesh.position.y = botTargetBaseY + Math.abs(Math.sin(b.walkCycle)) * 0.16;
            } else {
                b.isPeckingBack = true;
                b.peckBackTimer = 12;
                b.isAngry = false;

                const len = distToPlayer || 1;
                playerKnockbackX = (toPlayerX / len) * 1.4;
                playerKnockbackZ = (toPlayerZ / len) * 1.4;
                screenShake = 0.55;

                if (coinCount > 0) {
                    coinCount--;
                    spawnDroppedCoin(playerGroup.position.x, 1.0, playerGroup.position.z, -toPlayerX / len, -toPlayerZ / len);
                } else if (rubberDuckCount > 0) {
                    rubberDuckCount--;
                    coinCount = 1;
                    spawnDroppedCoin(playerGroup.position.x, 1.0, playerGroup.position.z, -toPlayerX / len, -toPlayerZ / len);
                }
                updateHUD();

                spawnFeathers(playerGroup.position.x, 1.2, playerGroup.position.z);
            }

            if (b.revengeTimer <= -80) b.isAngry = false;
        } 
        else {
            b.changeDirectionTimer++;
            if (b.changeDirectionTimer > 120) {
                b.targetAngle += (Math.random() - 0.5) * 1.2;
                b.changeDirectionTimer = 0;
            }

            let diff = b.targetAngle - b.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            b.angle += diff * 0.05;

            b.group.position.x -= Math.sin(b.angle) * b.speed;
            b.group.position.z -= Math.cos(b.angle) * b.speed;
            b.group.rotation.y = b.angle;

            b.walkCycle += 0.14;
            const bLegSwing = Math.sin(b.walkCycle) * 0.60;
            b.leftFoot.rotation.x = bLegSwing;
            b.rightFoot.rotation.x = -bLegSwing;

            b.leftFoot.position.y = hipHeight + Math.max(0, Math.sin(b.walkCycle)) * 0.14;
            b.rightFoot.position.y = hipHeight + Math.max(0, -Math.sin(b.walkCycle)) * 0.14;

            b.mesh.rotation.z = Math.sin(b.walkCycle) * 0.18;
            b.mesh.position.y = botTargetBaseY + Math.abs(Math.sin(b.walkCycle)) * 0.12;
        }

        if (b.isPeckingBack) {
            b.peckBackTimer--;
            b.mesh.position.z = THREE.MathUtils.lerp(b.mesh.position.z, -0.65, 0.4);
            b.mesh.rotation.x = THREE.MathUtils.lerp(b.mesh.rotation.x, 0.38, 0.4);
            if (b.peckBackTimer <= 0) b.isPeckingBack = false;
        } else if (!b.isAngry) {
            b.mesh.position.z = THREE.MathUtils.lerp(b.mesh.position.z, 0, 0.2);
        }

        const botDistToCenter = Math.hypot(b.group.position.x, b.group.position.z);
        if (botDistToCenter < pondRadius - 1.0) {
            if (!b.isInPondPenalty) {
                b.isInPondPenalty = true;
                score += 250;
                scoreEl.innerText = score;
                spawnDroppedCoin(b.group.position.x, 1.0, b.group.position.z, 0, 0);
                spawnFeathers(b.group.position.x, 0.6, b.group.position.z);
            }
        } else {
            b.isInPondPenalty = false;
        }

        if (Math.abs(b.group.position.x) > arenaLimit - 6 || Math.abs(b.group.position.z) > arenaLimit - 6) {
            b.targetAngle = Math.atan2(b.group.position.x, b.group.position.z);
        }
    });

    renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

spawnBox();
updateHUD();
animate();