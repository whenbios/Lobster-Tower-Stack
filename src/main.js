import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { RoundedBoxGeometry } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createHud } from "./ui/hud.js";
import {
  computePlacement,
  createBlockFactory,
  createLobsterTexture,
  nextAxis
} from "./game/stackLogic.js";
import { createEffects } from "./game/effects.js";

const BLOCK_HEIGHT = 0.7;
const MOVE_RANGE = 3.8;
const MOVE_SPEED = 1.55;
const DRIFT_LIMIT = 4.5;
const ENABLE_EFFECTS = false;
const BASE_SIZE = { x: 3, y: BLOCK_HEIGHT, z: 3 };
const DEBUG_RUN_ID = "pre-fix";
let didLogFirstFrame = false;

function debugLog(hypothesisId, location, message, data = {}) {
  fetch("http://127.0.0.1:7646/ingest/5568e563-b342-4148-ac89-535528bcc2d6", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "1f05ac"
    },
    body: JSON.stringify({
      sessionId: "1f05ac",
      runId: DEBUG_RUN_ID,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
}

// #region agent log
debugLog("H2", "src/main.js:38", "main module evaluated", {});
// #endregion

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// #region agent log
debugLog("H3", "src/main.js:52", "renderer initialized", {
  hasCanvas: Boolean(canvas),
  width: window.innerWidth,
  height: window.innerHeight
});
// #endregion

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0d1016, 12, 26);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 80);
camera.position.set(6.4, 6.7, 6.4);
camera.lookAt(0, 0.8, 0);

const ambient = new THREE.AmbientLight(0xffffff, 0.44);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xe4ecff, 1.05);
key.position.set(4.2, 9, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);

const fill = new THREE.DirectionalLight(0xb8c8ff, 0.45);
fill.position.set(-5, 5, -4);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.CylinderGeometry(4.8, 5.8, 0.6, 36),
  new THREE.MeshStandardMaterial({ color: 0x1b1f28, roughness: 0.8, metalness: 0.22 })
);
floor.position.y = -0.4;
floor.receiveShadow = true;
scene.add(floor);

const hud = createHud();
const lobsterTexture = createLobsterTexture(THREE);
const blockFactory = createBlockFactory(THREE, RoundedBoxGeometry, lobsterTexture);
const effects = ENABLE_EFFECTS ? createEffects(THREE, scene) : null;
const clock = new THREE.Clock();

const state = {
  axis: "x",
  score: 0,
  isGameOver: false,
  moveTime: 0,
  blocks: [],
  movingBlock: null
};

function disposeMesh(mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  if (mesh.geometry) mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => mat.dispose());
  } else if (mesh.material) {
    mesh.material.dispose();
  }
}

function clampXZ(position) {
  return {
    ...position,
    x: THREE.MathUtils.clamp(position.x, -DRIFT_LIMIT, DRIFT_LIMIT),
    z: THREE.MathUtils.clamp(position.z, -DRIFT_LIMIT, DRIFT_LIMIT)
  };
}

function updateCameraFocus(targetPosition, targetY) {
  camera.position.x = targetPosition.x + 6.4;
  camera.position.z = targetPosition.z + 6.4;
  camera.position.y = Math.max(6.4, targetY + 6.4);
  camera.lookAt(targetPosition.x, targetY - 0.4, targetPosition.z);
}

function addStaticBlock(size, position, level) {
  const lockedPosition = clampXZ(position);
  const mesh = blockFactory.createBlock(size, level);
  mesh.position.set(lockedPosition.x, lockedPosition.y, lockedPosition.z);
  scene.add(mesh);
  const block = { mesh, size: { ...size }, position: { ...lockedPosition } };
  state.blocks.push(block);
  return block;
}

function buildMovingBlock() {
  const prev = state.blocks[state.blocks.length - 1];
  const level = state.blocks.length;
  const size = { ...prev.size, y: BLOCK_HEIGHT };
  const basePosition = clampXZ({
    x: prev.position.x,
    z: prev.position.z
  });
  const spawn = {
    x: basePosition.x,
    y: prev.position.y + BLOCK_HEIGHT,
    z: basePosition.z
  };
  spawn[state.axis] += MOVE_RANGE;
  const axisMin = basePosition[state.axis] - MOVE_RANGE;
  const axisMax = basePosition[state.axis] + MOVE_RANGE;
  spawn[state.axis] = THREE.MathUtils.clamp(spawn[state.axis], axisMin, axisMax);

  const mesh = blockFactory.createBlock(size, level);
  mesh.position.set(spawn.x, spawn.y, spawn.z);
  scene.add(mesh);

  state.movingBlock = {
    mesh,
    size,
    position: { ...spawn },
    basePosition: { x: basePosition.x, z: basePosition.z }
  };
}

function refreshHud() {
  hud.setGold(state.score);
  hud.setHeight(state.blocks.length - 1);
}

function placeBlock() {
  if (state.isGameOver || !state.movingBlock) return;

  const prev = state.blocks[state.blocks.length - 1];
  const moving = state.movingBlock;
  const result = computePlacement(prev, moving, state.axis);

  if (result.isGameOver) {
    state.isGameOver = true;
    hud.showMessage("Game Over", `Alchemical Gold: ${state.score} | click to restart`);
    window.parent.postMessage({ type: "SCORE", value: state.score }, "*");
    return;
  }

  disposeMesh(moving.mesh);
  const placed = addStaticBlock(result.placed.size, result.placed.position, state.blocks.length);
  state.score += 1;
  refreshHud();

  if (ENABLE_EFFECTS && result.overhang) {
    const overhangMesh = blockFactory.createBlock(result.overhang.size, state.blocks.length);
    overhangMesh.position.set(result.overhang.position.x, result.overhang.position.y, result.overhang.position.z);
    scene.add(overhangMesh);
    effects.animateOverhangDrop(overhangMesh);
    effects.spawnLobsterUmbrellas(
      new THREE.Vector3(result.overhang.position.x, result.overhang.position.y, result.overhang.position.z),
      7
    );
  }

  state.axis = nextAxis(state.axis);
  state.moveTime = 0;
  state.movingBlock = null;

  const focusY = placed.position.y - BLOCK_HEIGHT * 2;
  updateCameraFocus(placed.position, focusY);

  buildMovingBlock();
}

function resetGame() {
  state.blocks.forEach((block) => disposeMesh(block.mesh));
  state.blocks.length = 0;
  disposeMesh(state.movingBlock?.mesh);
  state.movingBlock = null;

  state.axis = "x";
  state.score = 0;
  state.isGameOver = false;
  state.moveTime = 0;

  addStaticBlock(BASE_SIZE, { x: 0, y: 0, z: 0 }, 0);
  buildMovingBlock();
  // #region agent log
  debugLog("H4", "src/main.js:222", "reset complete", {
    blockCount: state.blocks.length,
    hasMovingBlock: Boolean(state.movingBlock),
    movingPos: state.movingBlock ? state.movingBlock.position : null
  });
  // #endregion
  refreshHud();
  hud.hideMessage();

  camera.position.set(6.4, 6.7, 6.4);
  camera.lookAt(0, 0.8, 0);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  if (!didLogFirstFrame) {
    didLogFirstFrame = true;
    // #region agent log
    debugLog("H4", "src/main.js:236", "first animation frame", {
      hasMovingBlock: Boolean(state.movingBlock),
      axis: state.axis,
      isGameOver: state.isGameOver
    });
    // #endregion
  }

  if (!state.isGameOver && state.movingBlock) {
    state.moveTime += delta * MOVE_SPEED;
    const offset = Math.sin(state.moveTime) * MOVE_RANGE;
    const axis = state.axis;
    const orthAxis = axis === "x" ? "z" : "x";
    const axisMin = state.movingBlock.basePosition[axis] - MOVE_RANGE;
    const axisMax = state.movingBlock.basePosition[axis] + MOVE_RANGE;
    state.movingBlock.position[axis] = THREE.MathUtils.clamp(state.movingBlock.basePosition[axis] + offset, axisMin, axisMax);
    state.movingBlock.position[orthAxis] = state.movingBlock.basePosition[orthAxis];
    state.movingBlock.position = clampXZ(state.movingBlock.position);
    state.movingBlock.mesh.position.set(
      state.movingBlock.position.x,
      state.movingBlock.position.y,
      state.movingBlock.position.z
    );
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("pointerdown", () => {
  // #region agent log
  debugLog("H5", "src/main.js:271", "pointerdown received", {
    isGameOver: state.isGameOver,
    hasMovingBlock: Boolean(state.movingBlock)
  });
  // #endregion
  if (state.isGameOver) {
    resetGame();
    return;
  }
  placeBlock();
});

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  event.preventDefault();
  if (state.isGameOver) {
    resetGame();
    return;
  }
  placeBlock();
});

resetGame();
animate();

window.addEventListener("beforeunload", () => {
  if (ENABLE_EFFECTS) {
    effects.dispose();
  }
  lobsterTexture.dispose();
  renderer.dispose();
});

window.addEventListener("error", (event) => {
  // #region agent log
  debugLog("H2", "src/main.js:304", "window error", {
    message: String(event.message || ""),
    filename: String(event.filename || ""),
    lineno: event.lineno ?? null
  });
  // #endregion
});

window.addEventListener("unhandledrejection", (event) => {
  // #region agent log
  debugLog("H2", "src/main.js:316", "unhandled rejection", {
    reason: String(event.reason?.message || event.reason || "")
  });
  // #endregion
});
