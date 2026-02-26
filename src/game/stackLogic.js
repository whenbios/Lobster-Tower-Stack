// ── 5 colour tiers: Red → Blue → Yellow → Green → Black ──────────────────
export const TIERS = [
  { lobsterColor: '#ff1a1a', bodyHex: 0xe2e5ea, emissive: 0x110808, metalness: 0.62, roughness: 0.32 }, // 1-15
  { lobsterColor: '#0055ff', bodyHex: 0xe0e4ea, emissive: 0x08080e, metalness: 0.62, roughness: 0.30 }, // 16-30
  { lobsterColor: '#ffcc00', bodyHex: 0xe4e2d8, emissive: 0x100e00, metalness: 0.60, roughness: 0.34 }, // 31-45
  { lobsterColor: '#00cc44', bodyHex: 0xdce4de, emissive: 0x001408, metalness: 0.62, roughness: 0.32 }, // 46-65
  { lobsterColor: '#0a0a0a', bodyHex: 0x3e4048, emissive: 0x030305, metalness: 0.78, roughness: 0.26 }, // 66+
];

export function getTierIndex(blockIndex) {
  if (blockIndex === 0) return null;
  if (blockIndex <= 15) return 0;
  if (blockIndex <= 30) return 1;
  if (blockIndex <= 45) return 2;
  if (blockIndex <= 65) return 3;
  return 4;
}

// ── Top-face lobster logo texture ─────────────────────────────────────────

function buildLobsterCanvas(tintColor) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const cx = cv.getContext('2d');

  // 1. Draw emoji twice — second pass builds up opacity so it looks solid
  cx.font = `150px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('🦞', S / 2, S / 2 + 8);
  cx.globalAlpha = 0.65;
  cx.fillText('🦞', S / 2, S / 2 + 8);
  cx.globalAlpha = 1;

  // 2. Strong tint — tier colour dominates the emoji
  cx.globalCompositeOperation = 'source-atop';
  cx.globalAlpha = 0.78;
  cx.fillStyle = tintColor;
  cx.fillRect(0, 0, S, S);
  cx.globalAlpha = 1;
  cx.globalCompositeOperation = 'source-over';

  // 3. Original silver Mac Mini background
  cx.globalCompositeOperation = 'destination-over';
  cx.fillStyle = '#d6dae0';
  cx.fillRect(0, 0, S, S);
  cx.globalCompositeOperation = 'source-over';

  return cv;
}

export function initTierTextures(THREE) {
  return TIERS.map(t => {
    const tex = new THREE.CanvasTexture(buildLobsterCanvas(t.lobsterColor));
    tex.needsUpdate = true;
    return tex;
  });
}

export function disposeTierTextures(textures) {
  textures.forEach(t => t.dispose());
}

// ── Mac Mini port panel texture ────────────────────────────────────────────
// Drawn on a 5:1 canvas matching the block face aspect ratio (10 wide × 2 tall)

function roundedRect(cx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + w - r, y);
  cx.arcTo(x + w, y, x + w, y + r, r);
  cx.lineTo(x + w, y + h - r);
  cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x + r, y + h);
  cx.arcTo(x, y + h, x, y + h - r, r);
  cx.lineTo(x, y + r);
  cx.arcTo(x, y, x + r, y, r);
  cx.closePath();
}

function drawPort(cx, cx_center, cy_center, w, h, r) {
  const x = cx_center - w / 2;
  const y = cy_center - h / 2;

  // Outer shadow/bezel
  cx.fillStyle = 'rgba(0,0,0,0.60)';
  roundedRect(cx, x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5);
  cx.fill();

  // Dark port recess
  cx.fillStyle = '#111111';
  roundedRect(cx, x, y, w, h, r);
  cx.fill();

  // Subtle inner-top highlight (light catching rim)
  cx.fillStyle = 'rgba(255,255,255,0.10)';
  roundedRect(cx, x + 1, y + 1, w - 2, h * 0.38, Math.max(1, r - 1));
  cx.fill();
}

export function makePortTexture(THREE) {
  // 5:1 canvas → matches the 10-unit wide × 2-unit tall block face
  const W = 512, H = 102;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');

  // Brushed aluminium gradient
  const grad = cx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,   '#cfd3d9');
  grad.addColorStop(0.45,'#c4c8ce');
  grad.addColorStop(1,   '#b6bac2');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, W, H);

  // Very subtle horizontal brush lines
  cx.globalAlpha = 0.06;
  for (let y = 0; y < H; y += 2) {
    cx.fillStyle = y % 4 === 0 ? '#fff' : '#000';
    cx.fillRect(0, y, W, 1);
  }
  cx.globalAlpha = 1;

  // Port row — vertically centred at 58% height
  const rowY  = H * 0.58;
  const portH = H * 0.34; // height of each port hole
  const portHShort = portH * 0.72; // shorter for oval ports (USB-C / jack)

  // Mac Mini M4 back panel layout (left → right):
  // 3× Thunderbolt 4 (USB-C oval), HDMI, 2× USB-A, Ethernet, 3.5 mm jack
  const ports = [
    { xf: 0.065, w: 26, h: portHShort, r: 6  }, // Thunderbolt 1
    { xf: 0.148, w: 26, h: portHShort, r: 6  }, // Thunderbolt 2
    { xf: 0.231, w: 26, h: portHShort, r: 6  }, // Thunderbolt 3
    { xf: 0.345, w: 44, h: portH * 0.82, r: 2 }, // HDMI
    { xf: 0.455, w: 32, h: portH,      r: 2  }, // USB-A 1
    { xf: 0.548, w: 32, h: portH,      r: 2  }, // USB-A 2
    { xf: 0.662, w: 52, h: portH * 1.1, r: 3 }, // Ethernet (wider + taller)
    { xf: 0.790, w: 14, h: 14,         r: 7  }, // 3.5 mm jack (round)
    // Power connector — right edge, half-visible (like real Mac Mini)
    { xf: 0.940, w: 18, h: 18,         r: 9  },
  ];

  ports.forEach(p => {
    drawPort(cx, p.xf * W, rowY, p.w, p.h, p.r);
  });

  // Tiny ventilation slot strip along the top edge (like real Mac Mini)
  cx.globalAlpha = 0.30;
  cx.fillStyle = '#888';
  for (let i = 0; i < 24; i++) {
    const sx = (W * 0.04) + i * (W * 0.04);
    if (sx > W * 0.96) break;
    roundedRect(cx, sx, H * 0.08, W * 0.018, H * 0.10, 1);
    cx.fill();
  }
  cx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

// ── Block mesh factory ─────────────────────────────────────────────────────

/**
 * Creates a Mac Mini-style block with:
 *  - More pronounced rounded corners (Mac Mini real proportions)
 *  - Metallic silver body
 *  - Top face: lobster logo (tier-coloured)
 *  - ONE side face with Mac Mini port panel (portFaceGroup 0=+X, 1=-X, 4=+Z, 5=-Z)
 *    opposite face is plain — rotates each block for variety
 *  - Pivot shifted to min-corner (corner-pivot game coordinate system)
 *
 * @param {number|null} portFaceGroup  RoundedBoxGeometry group index to put ports on
 */
export function makeMacMiniBlock(THREE, RoundedBoxGeometry, w, h, d, tierIndex, textures, portTexture, portFaceGroup = null, baseTopTexture = null, topOverride = null) {
  // Mac Mini has ~28% height-radius → very visible rounding on the short edges
  // Clamp so tiny chopped blocks don't over-round
  const radius = Math.min(h * 0.40, Math.min(w, d) * 0.06, 0.55);
  const geo = new RoundedBoxGeometry(w, h, d, 6, radius);
  geo.applyMatrix4(new THREE.Matrix4().makeTranslation(w / 2, h / 2, d / 2));

  if (tierIndex === null) {
    const baseMat = (groupIdx) => new THREE.MeshStandardMaterial({
      color: 0x1a1c26,
      metalness: 0.72,
      roughness: 0.38,
      ...(groupIdx === 2 && baseTopTexture
        ? { map: baseTopTexture, color: 0xffffff, metalness: 0.10, roughness: 0.55 }
        : {}),
    });
    // Only need multi-material array when there's a top texture to apply
    if (baseTopTexture) {
      return new THREE.Mesh(geo, [baseMat(0), baseMat(1), baseMat(2), baseMat(3), baseMat(4), baseMat(5)]);
    }
    return new THREE.Mesh(geo, baseMat(99));
  }

  const tier = TIERS[tierIndex];

  // Returns a side material; optionally applies the port texture
  const side = (groupIdx) => new THREE.MeshStandardMaterial({
    color: tier.bodyHex,
    metalness: tier.metalness,
    roughness: tier.roughness,
    emissive: tier.emissive,
    ...(portTexture && groupIdx === portFaceGroup
      ? { map: portTexture, roughness: tier.roughness + 0.06 }
      : {}),
  });

  const top = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.22,
    roughness: 0.52,
    map: topOverride ?? textures[tierIndex],
  });

  // RoundedBoxGeometry groups: +X(0), -X(1), +Y-top(2), -Y-bot(3), +Z(4), -Z(5)
  return new THREE.Mesh(geo, [
    side(0),     // +X
    side(1),     // -X
    top,         // +Y — lobster logo
    side(3),     // -Y — bottom, plain (3 never matches portFaceGroup)
    side(4),     // +Z
    side(5),     // -Z
  ]);
}

export function disposeMesh(mesh) {
  mesh.geometry?.dispose();
  const m = mesh.material;
  if (Array.isArray(m)) m.forEach(mat => mat?.dispose());
  else m?.dispose();
}
