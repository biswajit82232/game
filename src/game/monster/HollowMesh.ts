import * as THREE from "three";

export function createHollow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x050508,
    roughness: 1,
    metalness: 0,
    emissive: 0x120008,
    emissiveIntensity: 0.35,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.45, 0.24), mat);
  body.position.y = 1.5;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.2), mat);
  head.position.y = 2.78;
  const eye = new THREE.MeshStandardMaterial({
    color: 0x220000,
    emissive: 0xff2211,
    emissiveIntensity: 1.6,
  });
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.03), eye);
  eyeL.position.set(-0.055, 2.8, 0.11);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.055;
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.06, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x440000, emissiveIntensity: 0.8 }),
  );
  mouth.position.set(0, 2.68, 0.12);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.9, 0.07), mat);
  armL.position.set(-0.34, 1.15, 0.06);
  armL.rotation.z = 0.28;
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.9, 0.07), mat);
  armR.position.set(0.34, 1.15, 0.06);
  armR.rotation.z = -0.28;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.22, 0.1), mat);
  legL.position.set(-0.1, 0.55, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.22, 0.1), mat);
  legR.position.set(0.1, 0.55, 0);
  g.add(body, head, eyeL, eyeR, mouth, armL, armR, legL, legR);
  const cloak = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 2.4),
    new THREE.MeshStandardMaterial({
      color: 0x030305,
      roughness: 1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    }),
  );
  cloak.position.set(0, 1.35, -0.08);
  g.add(cloak);
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.eyeL = eyeL;
  g.userData.eyeR = eyeR;
  g.userData.head = head;
  return g;
}

export function animateHollow(mesh: THREE.Group, time: number, hunting = false): void {
  const shake = hunting ? 0.12 : 0.04;
  mesh.rotation.z = Math.sin(time * (hunting ? 8 : 1.4)) * shake;
  mesh.position.y = hunting ? Math.sin(time * 14) * 0.08 : 0;
  const armL = mesh.userData.armL as THREE.Mesh;
  const armR = mesh.userData.armR as THREE.Mesh;
  armL.rotation.x = Math.sin(time * (hunting ? 9 : 2.1)) * (hunting ? 0.55 : 0.12);
  armR.rotation.x = Math.sin(time * (hunting ? 9 : 2.1) + 1) * (hunting ? 0.55 : 0.12);
  const head = mesh.userData.head as THREE.Mesh;
  head.rotation.z = hunting ? Math.sin(time * 6) * 0.18 : 0;
  const eye = (mesh.userData.eyeL as THREE.Mesh).material as THREE.MeshStandardMaterial;
  eye.emissiveIntensity = hunting ? 2.4 + Math.sin(time * 20) * 0.8 : 1.6;
}
