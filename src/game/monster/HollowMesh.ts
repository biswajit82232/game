import * as THREE from "three";

export function createHollow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x050508,
    roughness: 0.95,
    metalness: 0.02,
    emissive: 0x120408,
    emissiveIntensity: 0.35,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.95, 6, 10), mat);
  body.position.y = 1.45;
  body.scale.set(0.85, 1, 0.7);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), mat);
  head.scale.set(0.88, 1.25, 0.82);
  head.position.y = 2.62;
  const eye = new THREE.MeshStandardMaterial({
    color: 0x080000,
    emissive: 0xff1a08,
    emissiveIntensity: 2.2,
  });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eye);
  eyeL.position.set(-0.05, 2.66, 0.14);
  eyeL.scale.set(1.4, 0.7, 0.6);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.05;
  const jaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.07, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x040000, emissive: 0x660000, emissiveIntensity: 1.0 }),
  );
  jaw.position.set(0, 2.44, 0.1);
  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.06, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x990000, emissiveIntensity: 1.2 }),
  );
  mouth.position.set(0, 2.5, 0.14);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 1.55, 4, 8), mat);
  armL.position.set(-0.3, 1.25, 0.05);
  armL.rotation.z = 0.35;
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 1.55, 4, 8), mat);
  armR.position.set(0.3, 1.25, 0.05);
  armR.rotation.z = -0.35;
  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.26), mat);
  handL.position.set(-0.42, 0.28, 0.18);
  const handR = handL.clone();
  handR.position.x = 0.42;
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.0, 4, 8), mat);
  legL.position.set(-0.09, 0.5, 0);
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.0, 4, 8), mat);
  legR.position.set(0.09, 0.5, 0);
  g.add(body, head, eyeL, eyeR, jaw, mouth, armL, armR, handL, handR, legL, legR);
  const cloak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 2.4, 10, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x030305,
      roughness: 1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      emissive: 0x100000,
      emissiveIntensity: 0.18,
    }),
  );
  cloak.position.set(0, 1.2, -0.05);
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
  armL.rotation.z = scare ? 0.7 : 0.35;
  armR.rotation.z = scare ? -0.7 : -0.35;
  const head = mesh.userData.head as THREE.Mesh;
  head.rotation.z = scare ? Math.sin(time * 18) * 0.35 : hunting ? Math.sin(time * 6) * 0.18 : 0;
  head.rotation.x = scare ? -0.25 : 0;
  const jaw = mesh.userData.jaw as THREE.Mesh;
  jaw.rotation.x = scare ? 0.85 + Math.sin(time * 30) * 0.12 : hunting ? 0.2 : 0;
  const mouth = mesh.userData.mouth as THREE.Mesh;
  mouth.scale.y = scare ? 2.4 : 1;
  const eye = (mesh.userData.eyeL as THREE.Mesh).material as THREE.MeshStandardMaterial;
  eye.emissiveIntensity = scare ? 5 + Math.sin(time * 40) * 1.8 : hunting ? 2.8 + Math.sin(time * 20) * 0.9 : 2.2;
  const handL = mesh.userData.handL as THREE.Mesh;
  const handR = mesh.userData.handR as THREE.Mesh;
  if (handL && handR) {
    handL.position.z = scare ? 0.55 : 0.18;
    handR.position.z = scare ? 0.55 : 0.18;
    handL.position.y = scare ? 1.35 : 0.28;
    handR.position.y = scare ? 1.35 : 0.28;
  }
}
