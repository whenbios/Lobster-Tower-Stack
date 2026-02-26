import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";

const MAX_LOBSTERS = 10;

export function createEffects(THREE, scene) {
  // ── Shared geometries — reused by every lobster instance ─────────────────
  const G = {
    body:    new THREE.SphereGeometry(0.30, 8, 6),
    head:    new THREE.SphereGeometry(0.22, 8, 6),
    claw:    new THREE.SphereGeometry(0.17, 7, 5),
    armCyl:  new THREE.CylinderGeometry(0.045, 0.058, 0.30, 5),
    tailA:   new THREE.SphereGeometry(0.20, 7, 5),
    tailB:   new THREE.SphereGeometry(0.14, 6, 4),
    tailC:   new THREE.SphereGeometry(0.10, 5, 4),
    eye:     new THREE.SphereGeometry(0.048, 5, 4),
    pupil:   new THREE.SphereGeometry(0.028, 4, 3),
    antenna: new THREE.CylinderGeometry(0.012, 0.020, 0.58, 4),
    // Umbrella parts
    canopy:  new THREE.ConeGeometry(0.62, 0.30, 10, 1),
    handle:  new THREE.CylinderGeometry(0.018, 0.018, 1.10, 5),
    hook:    new THREE.TorusGeometry(0.055, 0.014, 4, 8, Math.PI),
  };

  // ── Shared spoke geometry (umbrella ribs) — add to G ─────────────────────
  G.spoke = new THREE.CylinderGeometry(0.006, 0.006, 0.60, 3);

  // ── Shared materials ──────────────────────────────────────────────────────
  const M = {
    red:    new THREE.MeshStandardMaterial({ color: 0xdd2f1f, roughness: 0.58, metalness: 0.05 }),
    eyeW:   new THREE.MeshStandardMaterial({ color: 0xf5ece0, roughness: 0.7 }),
    eyeB:   new THREE.MeshStandardMaterial({ color: 0x060202, roughness: 0.9, emissive: new THREE.Color(0x060202) }),
    // Lime-green umbrella — clearly contrasts with the red lobster body
    canopy: new THREE.MeshStandardMaterial({ color: 0x88dd00, roughness: 0.60, side: THREE.DoubleSide }),
    spoke:  new THREE.MeshStandardMaterial({ color: 0x66aa00, roughness: 0.72 }),
    handle: new THREE.MeshStandardMaterial({ color: 0x7a4020, roughness: 0.82 }),
  };

  // active groups currently in scene
  const pool = [];

  // ── Build one lobster+umbrella group ──────────────────────────────────────
  function buildLobster() {
    const g = new THREE.Group();
    const mk = (geo, mat) => new THREE.Mesh(geo, mat);

    // ── Body (elongated sphere)
    const body = mk(G.body, M.red);
    body.scale.set(1.0, 1.55, 0.82);
    g.add(body);

    // ── Head
    const head = mk(G.head, M.red);
    head.position.y = 0.46;
    g.add(head);

    // ── Eyes (white sphere + dark pupil)
    for (const xe of [-0.10, 0.10]) {
      const white = mk(G.eye, M.eyeW);
      white.position.set(xe, 0.53, 0.17);
      g.add(white);

      const pupil = mk(G.pupil, M.eyeB);
      pupil.position.set(xe, 0.53, 0.20);
      g.add(pupil);
    }

    // ── Claws (each side: big oval claw + arm connector)
    for (const s of [-1, 1]) {
      const claw = mk(G.claw, M.red);
      claw.scale.set(1.35, 0.88, 0.88);
      claw.position.set(s * 0.51, 0.20, 0);
      g.add(claw);

      const arm = mk(G.armCyl, M.red);
      arm.rotation.z = s * -0.78;
      arm.position.set(s * 0.27, 0.23, 0);
      g.add(arm);
    }

    // ── Tail (3 decreasing spheres below body)
    const tail = mk(G.tailA, M.red);
    tail.position.y = -0.45;
    g.add(tail);

    const tailB = mk(G.tailB, M.red);
    tailB.position.y = -0.66;
    g.add(tailB);

    const tailC = mk(G.tailC, M.red);
    tailC.position.y = -0.81;
    g.add(tailC);

    // ── Antennae
    for (const s of [-1, 1]) {
      const ant = mk(G.antenna, M.red);
      ant.rotation.z = s * -0.38;
      ant.position.set(s * 0.10, 0.75, 0.06);
      g.add(ant);
    }

    // ── Umbrella group (parachute above lobster) ──────────────────────────
    const umb = new THREE.Group();
    umb.position.y = 1.28;

    // Canopy: cone flipped so wide rim faces up, apex down (classic parasol silhouette)
    const canopy = mk(G.canopy, M.canopy);
    canopy.rotation.x = Math.PI; // wide base at top, apex at bottom
    umb.add(canopy);

    // Spokes (8 ribs — use shared geo + mat)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = mk(G.spoke, M.spoke);
      spoke.rotation.z = Math.PI / 2 - 0.45;
      spoke.rotation.y = a;
      spoke.position.set(Math.cos(a) * 0.28, -0.06, Math.sin(a) * 0.28);
      umb.add(spoke);
    }

    // Handle: straight rod from canopy apex downward
    const handleM = mk(G.handle, M.handle);
    handleM.position.y = -0.69;
    umb.add(handleM);

    // Curved hook at bottom of handle
    const hook = mk(G.hook, M.handle);
    hook.rotation.z = Math.PI / 2;
    hook.position.y = -1.25;
    umb.add(hook);

    g.add(umb);
    return g;
  }

  // ── Pool pruning ──────────────────────────────────────────────────────────
  function pruneOldest() {
    if (pool.length >= MAX_LOBSTERS) {
      const old = pool.shift();
      scene.remove(old);
      // Shared G/M not disposed here — only in dispose()
    }
  }

  // ── Public: spawn lobsters from a chopped block piece ─────────────────────
  /**
   * @param {{ x:number, y:number, z:number }} position  top-centre of chop piece
   * @param {{ x:number, z:number }}           flyDir    direction the chop flew (normalised)
   * @param {number}                           count
   */
  function spawnLobsters(position, flyDir, count = 2) {
    for (let i = 0; i < count; i++) {
      pruneOldest();

      const lobster = buildLobster();

      const s = 1.10 + Math.random() * 0.50;
      lobster.scale.set(s, s, s);

      // Each lobster spawns at a random offset within a disc around the chop centre
      const spawnAngle  = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * 1.2;
      lobster.position.set(
        position.x + Math.cos(spawnAngle) * spawnRadius,
        position.y + 0.2,
        position.z + Math.sin(spawnAngle) * spawnRadius,
      );
      lobster.rotation.y = Math.random() * Math.PI * 2;

      scene.add(lobster);
      pool.push(lobster);

      // ── Each lobster gets its own random 360° fly direction ──────────────
      const flyAngle  = Math.random() * Math.PI * 2;
      const speed     = 4.5 + Math.random() * 3.5;
      const vx        = Math.cos(flyAngle) * speed;
      const vz        = Math.sin(flyAngle) * speed;

      const fallDist  = 65  + Math.random() * 25;
      const fallTime  = 3.5 + Math.random() * 0.8;
      const popHeight = 2.0 + Math.random() * 1.0;
      const popTime   = 0.28;
      const totalTime = popTime + fallTime;

      const targetX = lobster.position.x + vx * totalTime;
      const targetZ = lobster.position.z + vz * totalTime;
      gsap.to(lobster.position, {
        x: targetX,
        z: targetZ,
        duration: totalTime,
        ease: 'none',
      });

      // Vertical phase 1: quick upward pop
      const peakY = lobster.position.y + popHeight;
      gsap.to(lobster.position, {
        y: peakY,
        duration: popTime,
        ease: 'power2.out',
        onComplete: () => {
          // Vertical phase 2: gravity fall
          gsap.to(lobster.position, {
            y: peakY - fallDist,
            duration: fallTime,
            ease: 'power2.in',
            onComplete: () => {
              scene.remove(lobster);
              const idx = pool.indexOf(lobster);
              if (idx >= 0) pool.splice(idx, 1);
            },
          });
        },
      });

      // Tumble through full flight arc
      gsap.to(lobster.rotation, {
        x: lobster.rotation.x + (Math.random() - 0.5) * Math.PI * 5.0,
        y: lobster.rotation.y + (Math.random() * 8 - 4) * Math.PI,
        z: lobster.rotation.z + (Math.random() - 0.5) * Math.PI * 4.0,
        duration: totalTime,
        ease: 'none',
      });
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  function dispose() {
    pool.forEach(g => scene.remove(g));
    pool.length = 0;
    Object.values(G).forEach(geo => geo.dispose());
    Object.values(M).forEach(mat => mat.dispose());
  }

  return { spawnLobsters, dispose };
}
