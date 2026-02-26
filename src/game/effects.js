import { gsap } from "https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm";

const MAX_ACTIVE_SPRITES = 36;

function makeEmojiTexture(emoji) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "72px Segoe UI Emoji, Apple Color Emoji, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2 + 4);
  return canvas;
}

export function createEffects(THREE, scene) {
  const activeSprites = [];
  const lobsterUmbrellaTexture = new THREE.CanvasTexture(makeEmojiTexture("🦞☂️"));
  lobsterUmbrellaTexture.needsUpdate = true;

  function pruneOldestIfNeeded() {
    while (activeSprites.length >= MAX_ACTIVE_SPRITES) {
      const oldest = activeSprites.shift();
      if (!oldest) break;
      scene.remove(oldest.sprite);
      oldest.sprite.material.dispose();
    }
  }

  function spawnLobsterUmbrellas(origin, count = 6) {
    for (let i = 0; i < count; i += 1) {
      pruneOldestIfNeeded();

      const material = new THREE.SpriteMaterial({
        map: lobsterUmbrellaTexture,
        transparent: true
      });
      const sprite = new THREE.Sprite(material);
      const spread = 0.35;
      const dx = (Math.random() - 0.5) * spread;
      const dz = (Math.random() - 0.5) * spread;
      sprite.scale.set(0.6, 0.6, 0.6);
      sprite.position.set(origin.x + dx, origin.y + 0.25 + Math.random() * 0.25, origin.z + dz);

      scene.add(sprite);
      activeSprites.push({ sprite });

      const swingOffset = (Math.random() - 0.5) * 0.24;
      const lifetime = 1.8 + Math.random() * 0.7;

      gsap.to(sprite.position, {
        y: sprite.position.y - 2.5,
        duration: lifetime,
        ease: "sine.in",
        onComplete: () => {
          scene.remove(sprite);
          const index = activeSprites.findIndex((item) => item.sprite === sprite);
          if (index >= 0) activeSprites.splice(index, 1);
          sprite.material.dispose();
        }
      });

      gsap.to(sprite.position, {
        x: sprite.position.x + swingOffset,
        duration: 0.45 + Math.random() * 0.2,
        repeat: Math.max(2, Math.floor(lifetime / 0.5)),
        yoyo: true,
        ease: "sine.inOut"
      });

      gsap.to(sprite.material, {
        opacity: 0,
        delay: lifetime * 0.6,
        duration: lifetime * 0.4,
        ease: "sine.out"
      });
    }
  }

  function animateOverhangDrop(mesh) {
    const spin = (Math.random() - 0.5) * 1.2;
    gsap.to(mesh.position, {
      y: mesh.position.y - 6,
      duration: 1.2,
      ease: "power2.in"
    });
    gsap.to(mesh.rotation, {
      x: mesh.rotation.x + 1.1,
      z: mesh.rotation.z + spin,
      duration: 1.2,
      ease: "power2.in",
      onComplete: () => {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });
  }

  function dispose() {
    activeSprites.forEach(({ sprite }) => {
      scene.remove(sprite);
      sprite.material.dispose();
    });
    activeSprites.length = 0;
    lobsterUmbrellaTexture.dispose();
  }

  return {
    spawnLobsterUmbrellas,
    animateOverhangDrop,
    dispose
  };
}
