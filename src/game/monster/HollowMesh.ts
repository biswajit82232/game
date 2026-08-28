import * as THREE from "three";

export function createHollow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x050508,
    roughness: 1,
    metalness: 0,
    emissive: 0x050510,
    emissiveIntensity: 0.15,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.15, 0.22), mat);
  body.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.16), mat);
  head.position.y = 2.55;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), mat);
  armL.position.set(-0.28, 1.1, 0.05);
  armL.rotation.z = 0.18;
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.08), mat);
  armR.position.set(0.28, 1.1, 0.05);
  armR.rotation.z = -0.18;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), mat);
  legL.position.set(-0.1, 0.55, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), mat);
  legR.position.set(0.1, 0.55, 0);
  g.add(body, head, armL, armR, legL, legR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export function animateHollow(mesh: THREE.Group, time: number): void {
  const sway = Math.sin(time * 1.4) * 0.04;
  mesh.rotation.z = sway;
  const armL = mesh.userData.armL as THREE.Mesh;
  const armR = mesh.userData.armR as THREE.Mesh;
  armL.rotation.x = Math.sin(time * 2.1) * 0.12;
  armR.rotation.x = Math.sin(time * 2.1 + 1) * 0.12;
}
