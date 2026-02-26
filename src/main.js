import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";
import { createHud } from "./ui/hud.js";
import {
  getTierIndex,
  initTierTextures,
  disposeTierTextures,
  makeMacMiniBlock,
  makePortTexture,
  disposeMesh,
} from "./game/stackLogic.js";
import { createEffects } from "./game/effects.js";

// ── Constants ──────────────────────────────────────────────────────────────
const BLOCK_H    = 2.5;
const MOVE_RANGE = 12;
const BASE_SPEED = 0.15;
const SNAP_DIST  = 0.5;

// ── Audio ──────────────────────────────────────────────────────────────────
const TRACKS = [
  "./src/assets/audio/crab_audio-luxury-apartments-300581.mp3",
  "./src/assets/audio/delosound-inspiring-motivation-synthwave-398285.mp3",
  "./src/assets/audio/juliush-cool-jazz-loops-2641.mp3",
  "./src/assets/audio/the_mountain-synthwave-138606.mp3",
  "./src/assets/audio/vibehorn-cozy-lofi-relax-468509.mp3",
];

const SVG_ON  = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06A7 7 0 0 1 19 12a7 7 0 0 1-5 6.71v2.06A9 9 0 0 0 21 12 9 9 0 0 0 14 3.23z" fill="currentColor"/></svg>`;
const SVG_OFF = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.36l2.45 2.45c.03-.26.05-.52.05-.78zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18L19 19.27 20.27 18 5.27 3 4.27 3zM12 4 9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>`;

let audioEl   = null;
let audioMuted = false;

const audioBtn = document.getElementById("audio-btn");
audioBtn.innerHTML = SVG_ON;

function playRandomTrack() {
  if (audioEl) { audioEl.pause(); audioEl.src = ""; }
  const src = TRACKS[Math.floor(Math.random() * TRACKS.length)];
  audioEl = new Audio(src);
  audioEl.loop   = true;
  audioEl.volume = 0.55;
  audioEl.muted  = audioMuted;
  audioEl.play().catch(() => {});
}

function stopMusic() {
  if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
}

function toggleMute() {
  audioMuted = !audioMuted;
  if (audioEl) audioEl.muted = audioMuted;
  audioBtn.innerHTML  = audioMuted ? SVG_OFF : SVG_ON;
  audioBtn.setAttribute("aria-label", audioMuted ? "Unmute" : "Mute");
}

audioBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMute(); });

// ── Renderer ──────────────────────────────────────────────────────────────
const canvas   = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setClearColor("#C8C4C0", 1);

// ── Scene ─────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();

// ── Orthographic Camera ────────────────────────────────────────────────────
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 1000);
camera.position.set(2, 2, 2);
camera.lookAt(0, 0, 0);

function resizeCamera() {
  const vs = 30;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.left   = window.innerWidth  / -vs;
  camera.right  = window.innerWidth  /  vs;
  camera.top    = window.innerHeight /  vs;
  camera.bottom = window.innerHeight / -vs;
  camera.updateProjectionMatrix();
}
resizeCamera();
window.addEventListener("resize", resizeCamera);

function smoothCamera(targetY, duration = 0.3) {
  gsap.to(camera.position, { y: targetY + 4, duration, ease: "power1.inOut" });
}

// ── Lights (PBR-friendly for metallic Mac Mini blocks) ─────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.50));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
keyLight.position.set(6, 14, 6);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xb8ccff, 0.38);
fillLight.position.set(-6, 2, -6);
scene.add(fillLight);

scene.add(new THREE.HemisphereLight(0x99aabb, 0x3a2e28, 0.42));

// ── Scene Groups ──────────────────────────────────────────────────────────
const grpActive  = new THREE.Group();
const grpPlaced  = new THREE.Group();
const grpChopped = new THREE.Group();
scene.add(grpActive, grpPlaced, grpChopped);

// ── HUD ───────────────────────────────────────────────────────────────────
const hud = createHud();

// ── Tier textures, port texture & effects system ──────────────────────────
const tierTextures = initTierTextures(THREE);
const portTexture  = makePortTexture(THREE);
const effects      = createEffects(THREE, scene);

// ── Mushroom top texture for base platform ────────────────────────────────
const mushroomTexture = new THREE.TextureLoader().load("./src/assets/mushroom.png");

// ── Solana logo — always on block index 3 ─────────────────────────────────
const solanaTexture = new THREE.TextureLoader().load("./src/assets/solana.png");

// ── Game State ────────────────────────────────────────────────────────────
const STATES = { READY: "ready", PLAYING: "playing", ENDED: "ended", RESETTING: "resetting" };
let gameState    = STATES.READY;
let blocks       = [];
let placingReady = true; // false briefly after each new block spawns, prevents edge-miss on fast double-tap

// ── Mesh helpers ──────────────────────────────────────────────────────────

function clearGroup(grp) {
  while (grp.children.length) {
    const m = grp.children[0];
    grp.remove(m);
    disposeMesh(m);
  }
}

// ── Block factory ─────────────────────────────────────────────────────────

function createBlock(prev) {
  const index  = prev ? prev.index + 1 : 0;
  const plane  = index % 2 ? "x" : "z";
  const dimKey = index % 2 ? "w" : "d";

  const w = prev ? prev.w : 10;
  const d = prev ? prev.d : 10;
  const y = BLOCK_H * index;

  const px = prev ? prev.x : 0;
  const pz = prev ? prev.z : 0;

  const speed     = Math.min(BASE_SPEED + index * 0.005, 4);
  const side      = Math.random() > 0.5 ? 1 : -1;
  const spawnAbs  = side * MOVE_RANGE;
  const direction = -side * speed;

  const x = plane === "x" ? spawnAbs : px;
  const z = plane === "z" ? spawnAbs : pz;

  const tierIdx = getTierIndex(index);
  // Alternate port face: +X(0), +Z(4), -X(1), -Z(5) cycling every block
  // Both +X and +Z are always camera-visible, giving maximum port variety
  const PORT_FACES = [0, 4, 1, 5];
  const portFaceGroup = tierIdx === null ? null : PORT_FACES[index % 4];
  const customTopTex  = index === 3 ? solanaTexture : null;

  const mesh = makeMacMiniBlock(THREE, RoundedBoxGeometry, w, BLOCK_H, d, tierIdx, tierTextures, portTexture, portFaceGroup, null, customTopTex);
  mesh.position.set(x, y, z);

  return { index, plane, dimKey, w, h: BLOCK_H, d, x, y, z, tierIdx, portFaceGroup, customTopTex, speed, direction, active: index > 0, missed: false, mesh };
}

// ── Core mechanics ────────────────────────────────────────────────────────

function addBlock() {
  const last = blocks[blocks.length - 1];
  if (last && last.missed) return endGame();

  const score = Math.max(0, blocks.length - 1);
  hud.setGold(score);

  const b = createBlock(last ?? null);
  grpActive.add(b.mesh);
  blocks.push(b);

  smoothCamera(blocks.length * 2);

  // Brief lock so a fast double-tap can't place the block while still at spawn edge
  placingReady = false;
  setTimeout(() => { placingReady = true; }, 350);
}

function placeBlock() {
  if (!placingReady) return;
  const curr = blocks[blocks.length - 1];
  if (!curr?.active) return;
  curr.active = false;

  const prev = blocks[blocks.length - 2];
  if (!prev) return;

  const plane   = curr.plane;
  const prevDim = plane === "x" ? prev.w : prev.d;
  const currDim = plane === "x" ? curr.w : curr.d;
  const overlap = prevDim - Math.abs(curr[plane] - prev[plane]);

  // ── Perfect snap ──────────────────────────────────────────────────────
  if (currDim - overlap < SNAP_DIST) {
    curr.x = prev.x;
    curr.z = prev.z;
    curr.w = prev.w;
    curr.d = prev.d;

    grpActive.remove(curr.mesh);
    disposeMesh(curr.mesh);

    const snapMesh = makeMacMiniBlock(THREE, RoundedBoxGeometry, curr.w, curr.h, curr.d, curr.tierIdx, tierTextures, portTexture, curr.portFaceGroup, null, curr.customTopTex);
    snapMesh.position.set(curr.x, curr.y, curr.z);
    grpPlaced.add(snapMesh);
    curr.mesh = snapMesh;

    gsap.from(snapMesh.scale, { y: 1.35, duration: 0.18, ease: "bounce.out" });

    // Celebratory lobster pops off in a random outward direction
    const snapTop   = { x: curr.x + curr.w / 2, y: curr.y + BLOCK_H, z: curr.z + curr.d / 2 };
    const snapAngle = Math.random() * Math.PI * 2;
    effects.spawnLobsters(snapTop, { x: Math.cos(snapAngle), z: Math.sin(snapAngle) }, 1);

    addBlock();
    return;
  }

  // ── Missed completely ─────────────────────────────────────────────────
  if (overlap <= 0) {
    curr.missed = true;
    grpActive.remove(curr.mesh);
    scene.add(curr.mesh);

    gsap.to(curr.mesh.position, {
      y: curr.y - 30,
      [plane]: curr.mesh.position[plane] + (curr.direction > 0 ? 40 : -40),
      duration: 1,
      ease: "power1.in",
      onComplete: () => {
        scene.remove(curr.mesh);
        disposeMesh(curr.mesh);
      },
    });

    addBlock(); // triggers endGame via missed flag
    return;
  }

  // ── Normal chop ───────────────────────────────────────────────────────
  const placedW = plane === "x" ? overlap : curr.w;
  const placedD = plane === "z" ? overlap : curr.d;
  const chopW   = plane === "x" ? currDim - overlap : curr.w;
  const chopD   = plane === "z" ? currDim - overlap : curr.d;

  let chopX = curr.x;
  let chopZ = curr.z;

  if (curr[plane] < prev[plane]) {
    curr[plane] = prev[plane];
  } else {
    if (plane === "x") chopX = curr.x + overlap;
    else               chopZ = curr.z + overlap;
  }

  curr.w = placedW;
  curr.d = placedD;

  const placedMesh = makeMacMiniBlock(THREE, RoundedBoxGeometry, placedW, curr.h, placedD, curr.tierIdx, tierTextures, portTexture, curr.portFaceGroup, null, curr.customTopTex);
  placedMesh.position.set(curr.x, curr.y, curr.z);

  const chopMesh = makeMacMiniBlock(THREE, RoundedBoxGeometry, chopW, curr.h, chopD, curr.tierIdx, tierTextures, portTexture, curr.portFaceGroup, null, curr.customTopTex);
  chopMesh.position.set(chopX, curr.y, chopZ);

  grpActive.remove(curr.mesh);
  disposeMesh(curr.mesh);

  grpPlaced.add(placedMesh);
  grpChopped.add(chopMesh);
  curr.mesh = placedMesh;

  // Fly overhang piece away
  const flyAmt  = chopMesh.position[plane] > placedMesh.position[plane] ? 40 : -40;
  const rotAxis = plane === "z" ? "x" : "z";

  // Lobsters fly out FROM the chop piece, in the same direction it's launched
  const chopTop = { x: chopX + chopW / 2, y: curr.y + BLOCK_H, z: chopZ + chopD / 2 };
  const flyDir  = {
    x: plane === "x" ? (flyAmt > 0 ? 1 : -1) : 0,
    z: plane === "z" ? (flyAmt > 0 ? 1 : -1) : 0,
  };
  effects.spawnLobsters(chopTop, flyDir, 3 + Math.floor(Math.random() * 3)); // 3–5

  gsap.to(chopMesh.position, {
    y: curr.y - 30,
    [plane]: chopMesh.position[plane] + flyAmt,
    duration: 1,
    ease: "power1.in",
    onComplete: () => {
      grpChopped.remove(chopMesh);
      disposeMesh(chopMesh);
    },
  });
  gsap.to(chopMesh.rotation, {
    [rotAxis]: (Math.random() * 10) - 5,
    y: Math.random() * 0.2,
    delay: 0.05,
    duration: 1,
    ease: "power1.in",
  });

  addBlock();
}

// ── Game state transitions ────────────────────────────────────────────────

function startGame() {
  if (gameState === STATES.PLAYING) return;
  gameState = STATES.PLAYING;
  hud.setGold(0);
  hud.hideMessage();
  playRandomTrack();
  addBlock();
}

function endGame() {
  gameState = STATES.ENDED;
  stopMusic();
  const score = Math.max(0, blocks.length - 2);
  hud.showMessage(
    "Game Over",
    `Score: ${score}`,
    "Click or spacebar to start again",
  );
  window.parent.postMessage({ type: "SCORE", value: score }, "*");
}

function restartGame() {
  if (gameState === STATES.RESETTING) return;
  gameState = STATES.RESETTING;

  clearGroup(grpActive);
  clearGroup(grpChopped);

  const placed    = [...grpPlaced.children];
  const shrinkDur = 0.2;
  const delayStep = 0.02;

  placed.forEach((mesh, i) => {
    const delay = (placed.length - i) * delayStep;
    gsap.to(mesh.scale, {
      x: 0, y: 0, z: 0,
      duration: shrinkDur, delay, ease: "power1.in",
      onComplete: () => { grpPlaced.remove(mesh); disposeMesh(mesh); },
    });
    gsap.to(mesh.rotation, { y: 0.5, duration: shrinkDur, delay, ease: "power1.in" });
  });

  const totalDur = shrinkDur * 2 + placed.length * delayStep;
  smoothCamera(2, totalDur);
  blocks = [];

  setTimeout(() => {
    gameState = STATES.READY;
    initBase();
    startGame();
  }, totalDur * 1000);
}

function onAction() {
  switch (gameState) {
    case STATES.READY:     startGame();   break;
    case STATES.PLAYING:   placeBlock();  break;
    case STATES.ENDED:     restartGame(); break;
  }
}

// ── Input ─────────────────────────────────────────────────────────────────
window.addEventListener("pointerdown", onAction);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); onAction(); }
});

// ── Game loop ─────────────────────────────────────────────────────────────
function tick() {
  const curr = blocks[blocks.length - 1];
  if (curr?.active) {
    const val = curr[curr.plane];
    if (val > MOVE_RANGE || val < -MOVE_RANGE) {
      curr.direction = curr.direction > 0 ? -curr.speed : curr.speed;
    }
    curr[curr.plane] += curr.direction;
    curr.mesh.position[curr.plane] = curr[curr.plane];
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ── Init ──────────────────────────────────────────────────────────────────

function initBase() {
  const mesh = makeMacMiniBlock(THREE, RoundedBoxGeometry, 10, BLOCK_H, 10, null, tierTextures, portTexture, null, mushroomTexture);
  mesh.position.set(0, 0, 0);
  grpPlaced.add(mesh);
  blocks.push({
    index: 0, plane: "z", dimKey: "d",
    w: 10, h: BLOCK_H, d: 10,
    x: 0, y: 0, z: 0,
    tierIdx: null, portFaceGroup: null,
    speed: 0, direction: 0, active: false, missed: false, mesh,
  });
}

initBase();
hud.showMessage("Silicon Lobster Stack", null, "Click or press Space to start");
tick();

window.addEventListener("beforeunload", () => {
  stopMusic();
  renderer.dispose();
  effects.dispose();
  disposeTierTextures(tierTextures);
  portTexture.dispose();
  mushroomTexture.dispose();
  solanaTexture.dispose();
});
