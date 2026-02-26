const TIERS = [
  { color: "#c8ccd2", emissive: "#111111", roughness: 0.28, metalness: 0.82 },
  { color: "#7a818d", emissive: "#13151a", roughness: 0.3, metalness: 0.86 },
  { color: "#2e3440", emissive: "#161b28", roughness: 0.35, metalness: 0.78 },
  { color: "#8e3dff", emissive: "#00a3ff", roughness: 0.24, metalness: 0.72 }
];

function getTierForLevel(level) {
  return TIERS[Math.floor(level / 15) % TIERS.length];
}

export function createLobsterTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f3f6fb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "155px Segoe UI Emoji, Apple Color Emoji, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🦞", canvas.width / 2, canvas.height / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createBlockFactory(THREE, RoundedBoxGeometry, lobsterTexture) {
  function makeMaterials(level) {
    const tier = getTierForLevel(level);
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: tier.color,
      metalness: tier.metalness,
      roughness: tier.roughness,
      emissive: tier.emissive
    });
    const topMaterial = sideMaterial.clone();
    topMaterial.map = lobsterTexture;
    topMaterial.emissiveIntensity = 0.45;
    return [sideMaterial, sideMaterial.clone(), topMaterial, sideMaterial.clone(), sideMaterial.clone(), sideMaterial.clone()];
  }

  function createBlock(size, level) {
    const geometry = new RoundedBoxGeometry(size.x, size.y, size.z, 3, 0.08);
    const materials = makeMaterials(level);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.size = { ...size };
    return mesh;
  }

  return { createBlock };
}

function toBounds(position, size) {
  return {
    min: {
      x: position.x - size.x / 2,
      y: position.y - size.y / 2,
      z: position.z - size.z / 2
    },
    max: {
      x: position.x + size.x / 2,
      y: position.y + size.y / 2,
      z: position.z + size.z / 2
    }
  };
}

export function computeAabbOverlap(prevBlock, currBlock) {
  const prevBounds = toBounds(prevBlock.position, prevBlock.size);
  const currBounds = toBounds(currBlock.position, currBlock.size);

  const x = Math.min(prevBounds.max.x, currBounds.max.x) - Math.max(prevBounds.min.x, currBounds.min.x);
  const z = Math.min(prevBounds.max.z, currBounds.max.z) - Math.max(prevBounds.min.z, currBounds.min.z);
  return { x, z };
}

export function computePlacement(prevBlock, currBlock, axis) {
  const overlap = computeAabbOverlap(prevBlock, currBlock);
  const activeOverlap = overlap[axis];
  if (activeOverlap <= 0) {
    return { isGameOver: true };
  }

  const axisSize = currBlock.size[axis];
  const overhangSize = axisSize - activeOverlap;
  const placed = {
    size: { ...currBlock.size, [axis]: activeOverlap },
    position: {
      ...currBlock.position,
      [axis]: (currBlock.position[axis] + prevBlock.position[axis]) / 2
    }
  };

  let overhang = null;
  if (overhangSize > 0.0001) {
    const delta = currBlock.position[axis] - prevBlock.position[axis];
    const direction = delta >= 0 ? 1 : -1;
    overhang = {
      size: { ...currBlock.size, [axis]: overhangSize },
      position: {
        ...placed.position,
        [axis]: placed.position[axis] + direction * (placed.size[axis] / 2 + overhangSize / 2)
      }
    };
  }

  return {
    isGameOver: false,
    placed,
    overhang,
    overlap
  };
}

export function nextAxis(axis) {
  return axis === "x" ? "z" : "x";
}
