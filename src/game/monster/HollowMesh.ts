import * as THREE from "three";

/** Tall ghostly figure — readable silhouette, glowing eyes, soft body light. */
export function createHollow(): THREE.Group {
  const g = new THREE.Group();

  const shroudMat = new THREE.MeshStandardMaterial({
    color: 0xb8c4d8,
    roughness: 0.55,
    metalness: 0.05,
    emissive: 0x1a2840,
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a2030,
    roughness: 0.85,
    metalness: 0.1,
    emissive: 0x0a1020,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.88,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x66ddff,
    emissiveIntensity: 4.5,
    roughness: 0.2,
  });

  // Sheet / body — tapered ghost form
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.55, 12, 1, true), shroudMat);
  body.position.y = 1.35;
  body.rotation.x = Math.PI;

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.1, 12, 1, true), shroudMat);
  skirt.position.y = 0.45;
  skirt.rotation.x = Math.PI;
  skirt.scale.set(1, 0.7, 1);

  // Head under hood
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), darkMat);
  head.position.y = 2.55;
  head.scale.set(0.95, 1.15, 0.9);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), shroudMat);
  hood.position.y = 2.62;
  hood.rotation.x = 0.15;

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), eyeMat);
  eyeL.position.set(-0.09, 2.58, 0.22);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;

  const eyeGlow = new THREE.PointLight(0x7adfff, 1.8, 5.5, 2);
  eyeGlow.position.set(0, 2.55, 0.35);

  // Long hanging arms
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.35, 4, 8), darkMat);
  armL.position.set(-0.42, 1.55, 0.05);
  armL.rotation.z = 0.45;
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.35, 4, 8), darkMat);
  armR.position.set(0.42, 1.55, 0.05);
  armR.rotation.z = -0.45;

  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), darkMat);
  handL.position.set(-0.62, 0.72, 0.12);
  const handR = handL.clone();
  handR.position.x = 0.62;

  // Soft aura so it never reads as a black box in the dark
  const aura = new THREE.PointLight(0x4a7aaa, 2.4, 8, 1.8);
  aura.position.set(0, 1.6, 0);

  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0x88bbff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    }),
  );
  rim.position.y = 1.5;
  rim.scale.set(0.7, 1.4, 0.7);

  g.add(body, skirt, head, hood, eyeL, eyeR, armL, armR, handL, handR, eyeGlow, aura, rim);
  g.userData.armL = armL;
  g.userData.armR = armR;
  g.userData.handL = handL;
  g.userData.handR = handR;
  g.userData.eyeL = eyeL;
  g.userData.eyeR = eyeR;
  g.userData.head = head;
  g.userData.hood = hood;
  g.userData.aura = aura;
  g.userData.eyeGlow = eyeGlow;
  g.userData.body = body;
  return g;
}

export function animateHollow(mesh: THREE.Group, time: number, hunting = false, jumpscare = false): void {
  const scare = jumpscare;
  const shake = scare ? 0.2 : hunting ? 0.1 : 0.035;
  mesh.rotation.z = Math.sin(time * (scare ? 20 : hunting ? 7 : 1.2)) * shake;
  mesh.position.y = scare
    ? 0.15 + Math.sin(time * 26) * 0.08
    : 0.08 + Math.sin(time * (hunting ? 5 : 1.8)) * (hunting ? 0.1 : 0.05);

  const armL = mesh.userData.armL as THREE.Mesh;
  const armR = mesh.userData.armR as THREE.Mesh;
  armL.rotation.x = scare ? -0.9 : Math.sin(time * (hunting ? 8 : 1.8)) * (hunting ? 0.45 : 0.15);
  armR.rotation.x = scare ? -0.95 : Math.sin(time * (hunting ? 8 : 1.8) + 1.2) * (hunting ? 0.45 : 0.15);
  armL.rotation.z = scare ? 0.85 : 0.45 + Math.sin(time * 1.4) * 0.08;
  armR.rotation.z = scare ? -0.85 : -0.45 - Math.sin(time * 1.4) * 0.08;

  const head = mesh.userData.head as THREE.Mesh;
  head.rotation.z = scare ? Math.sin(time * 16) * 0.3 : hunting ? Math.sin(time * 5) * 0.12 : 0;

  const eye = (mesh.userData.eyeL as THREE.Mesh).material as THREE.MeshStandardMaterial;
  eye.emissiveIntensity = scare ? 7 + Math.sin(time * 35) * 2 : hunting ? 5.5 + Math.sin(time * 12) * 1.2 : 4.2;

  const aura = mesh.userData.aura as THREE.PointLight;
  const eyeGlow = mesh.userData.eyeGlow as THREE.PointLight;
  if (aura) aura.intensity = scare ? 6 : hunting ? 3.8 + Math.sin(time * 10) * 0.8 : 2.2;
  if (eyeGlow) eyeGlow.intensity = scare ? 5 : hunting ? 3.2 : 1.8;

  const handL = mesh.userData.handL as THREE.Mesh;
  const handR = mesh.userData.handR as THREE.Mesh;
  if (handL && handR) {
    handL.position.y = scare ? 1.5 : 0.72 + Math.sin(time * 2) * 0.04;
    handR.position.y = scare ? 1.5 : 0.72 + Math.sin(time * 2 + 1) * 0.04;
    handL.position.z = scare ? 0.55 : 0.12;
    handR.position.z = scare ? 0.55 : 0.12;
  }

  const body = mesh.userData.body as THREE.Mesh;
  if (body) {
    const mat = body.material as THREE.MeshStandardMaterial;
    mat.opacity = scare ? 0.92 : hunting ? 0.8 : 0.68;
    mat.emissiveIntensity = scare ? 1.2 : hunting ? 0.85 : 0.55;
  }
}
