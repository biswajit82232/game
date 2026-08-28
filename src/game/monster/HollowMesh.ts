import * as THREE from "three";

export function createHollow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x07060a,
    roughness: 0.92,
    metalness: 0.04,
    emissive: 0x1a0508,
    emissiveIntensity: 0.4,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.85, 4, 8), mat);
  body.position.y = 1.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat);
  head.scale.set(0.92, 1.15, 0.85);
  head.position.y = 2.58;
  const eye = new THREE.MeshStandardMaterial({
    color: 0x120000,
    emissive: 0xff2a14,
    emissiveIntensity: 1.8,
  });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eye);
  eyeL.position.set(-0.055, 2.62, 0.14);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.055;
  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.08, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x050000, emissive: 0x770000, emissiveIntensity: 0.95 }),
  );
  jaw.position.set(0, 2.42, 0.1);
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.07, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xaa0000, emissiveIntensity: 1.15 }),
  );
  mouth.position.set(0, 2.48, 0.14);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 1.45, 3, 6), mat);
  armL.position.set(-0.28, 1.2, 0.04);
  armL.rotation.z = 0.32;
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 1.45, 3, 6), mat);
  armR.position.set(0.28, 1.2, 0.04);
  armR.rotation.z = -0.32;
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.24), mat);
  handL.position.set(-0.4, 0.32, 0.16);
  const handR = handL.clone();
  handR.position.x = 0.4;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.95, 3, 6), mat);
  legL.position.set(-0.09, 0.52, 0);
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.95, 3, 6), mat);
  legR.position.set(0.09, 0.52, 0);
  g.add(body, head, eyeL, eyeR, jaw, mouth, armL, armR, handL, handR, legL, legR);
  const cloak = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 2.7),
    new THREE.MeshStandardMaterial({
      color: 0x040406,
      roughness: 1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
      emissive: 0x140000,
      emissiveIntensity: 0.22,
    }),
  );
  cloak.position.set(0, 1.35, -0.1);
  g.add(cloak);
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.handL = handL;
  g.userData.handR = handR;
  g.userData.eyeL = eyeL;
  g.userData.eyeR = eyeR;
  g.userData.head = head;
  g.userData.jaw = jaw;
  g.userData.mouth = mouth;
  return g;
}

export function animateHollow(mesh: THREE.Group, time: number, hunting = false, jumpscare = false): void {
  const scare = jumpscare;
  const shake = scare ? 0.22 : hunting ? 0.12 : 0.04;
  mesh.rotation.z = Math.sin(time * (scare ? 22 : hunting ? 8 : 1.4)) * shake;
  mesh.position.y = scare ? 0.12 + Math.sin(time * 28) * 0.1 : hunting ? Math.sin(time * 14) * 0.08 : 0;
  const armL = mesh.userData.armL as THREE.Mesh;
  const armR = mesh.userData.armR as THREE.Mesh;
  armL.rotation.x = scare ? -1.15 : Math.sin(time * (hunting ? 9 : 2.1)) * (hunting ? 0.55 : 0.12);
  armR.rotation.x = scare ? -1.2 : Math.sin(time * (hunting ? 9 : 2.1) + 1) * (hunting ? 0.55 : 0.12);
  armL.rotation.z = scare ? 0.7 : 0.32;
  armR.rotation.z = scare ? -0.7 : -0.32;
  const head = mesh.userData.head as THREE.Mesh;
  head.rotation.z = scare ? Math.sin(time * 18) * 0.35 : hunting ? Math.sin(time * 6) * 0.18 : 0;
  head.rotation.x = scare ? -0.25 : 0;
  const jaw = mesh.userData.jaw as THREE.Mesh;
  jaw.rotation.x = scare ? 0.85 + Math.sin(time * 30) * 0.12 : hunting ? 0.2 : 0;
  const mouth = mesh.userData.mouth as THREE.Mesh;
  mouth.scale.y = scare ? 2.4 : 1;
  const eye = (mesh.userData.eyeL as THREE.Mesh).material as THREE.MeshStandardMaterial;
  eye.emissiveIntensity = scare ? 4.5 + Math.sin(time * 40) * 1.6 : hunting ? 2.4 + Math.sin(time * 20) * 0.8 : 1.8;
  const handL = mesh.userData.handL as THREE.Mesh;
  const handR = mesh.userData.handR as THREE.Mesh;
  if (handL && handR) {
    handL.position.z = scare ? 0.55 : 0.16;
    handR.position.z = scare ? 0.55 : 0.16;
    handL.position.y = scare ? 1.35 : 0.32;
    handR.position.y = scare ? 1.35 : 0.32;
  }
}
