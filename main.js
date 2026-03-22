import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 2.5, 8);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.85;
controls.update();

// --- Render target for scene B (matches screen size) ---
let portalRT = new THREE.WebGLRenderTarget(
  window.innerWidth * Math.min(window.devicePixelRatio, 2),
  window.innerHeight * Math.min(window.devicePixelRatio, 2)
);

// ============================================================
// PORTAL DIMENSIONS
// ============================================================
const portalWidth = 3;
const portalHeight = 4;
const frameThickness = 0.3;
const frameDepth = 0.25;
const portalY = portalHeight / 2;
const portalZ = 0;

// ============================================================
// SCENE A — Desert world (outer)
// ============================================================
const sceneA = new THREE.Scene();

const skyCanvasA = createGradientSky(
  ["#1a0533", "#6b2fa0", "#d4556b", "#f4a261", "#e9c46a"],
  1024
);
sceneA.background = new THREE.CanvasTexture(skyCanvasA);

// Desert ground
const desertGeo = new THREE.PlaneGeometry(100, 100, 64, 64);
const desertPos = desertGeo.attributes.position;
for (let i = 0; i < desertPos.count; i++) {
  const x = desertPos.getX(i);
  const y = desertPos.getY(i);
  desertPos.setZ(
    i,
    Math.sin(x * 0.3) * Math.cos(y * 0.2) * 0.8 +
      Math.sin(x * 0.7 + y * 0.5) * 0.3
  );
}
desertGeo.computeVertexNormals();
const desert = new THREE.Mesh(
  desertGeo,
  new THREE.MeshStandardMaterial({ color: 0xd4a04a, roughness: 0.9 })
);
desert.rotation.x = -Math.PI / 2;
desert.receiveShadow = true;
sceneA.add(desert);

// Dunes
for (let i = 0; i < 10; i++) {
  const dune = new THREE.Mesh(
    new THREE.SphereGeometry(3 + Math.random() * 5, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xc8943e, roughness: 1 })
  );
  const angle = Math.random() * Math.PI * 2;
  const dist = 12 + Math.random() * 30;
  dune.position.set(Math.cos(angle) * dist, -1.5, Math.sin(angle) * dist);
  dune.scale.set(1, 0.3, 1);
  dune.receiveShadow = true;
  sceneA.add(dune);
}

// Lighting A
const sunA = new THREE.DirectionalLight(0xffcc88, 2);
sunA.position.set(5, 10, 5);
sunA.castShadow = true;
sunA.shadow.mapSize.set(1024, 1024);
sunA.shadow.camera.near = 0.5;
sunA.shadow.camera.far = 50;
sunA.shadow.camera.left = -15;
sunA.shadow.camera.right = 15;
sunA.shadow.camera.top = 15;
sunA.shadow.camera.bottom = -15;
sceneA.add(sunA);
sceneA.add(new THREE.AmbientLight(0xffa07a, 0.4));

// Railroad tracks
createRailroad(sceneA);

// Yellow ball A
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.3 })
);
ball.position.set(-1.8, 0.12, 3);
ball.castShadow = true;
sceneA.add(ball);

// --- Portal frame (visible border) ---
const frameMat = new THREE.MeshStandardMaterial({
  color: 0xdddddd,
  roughness: 0.25,
  metalness: 0.6,
});

const frameShape = new THREE.Shape();
const hw = portalWidth / 2 + frameThickness;
const hh = portalHeight / 2 + frameThickness;
frameShape.moveTo(-hw, -hh);
frameShape.lineTo(hw, -hh);
frameShape.lineTo(hw, hh);
frameShape.lineTo(-hw, hh);
frameShape.lineTo(-hw, -hh);

const holeShape = new THREE.Path();
const ihw = portalWidth / 2;
const ihh = portalHeight / 2;
holeShape.moveTo(-ihw, -ihh);
holeShape.lineTo(ihw, -ihh);
holeShape.lineTo(ihw, ihh);
holeShape.lineTo(-ihw, ihh);
holeShape.lineTo(-ihw, -ihh);
frameShape.holes.push(holeShape);

const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
  depth: frameDepth,
  bevelEnabled: true,
  bevelThickness: 0.05,
  bevelSize: 0.05,
  bevelSegments: 2,
});
const frameMesh = new THREE.Mesh(frameGeo, frameMat);
frameMesh.position.set(0, portalY, portalZ - frameDepth / 2);
frameMesh.castShadow = true;
frameMesh.receiveShadow = true;
sceneA.add(frameMesh);

// --- Portal plane (shows scene B via screen-space UV mapping) ---
const portalMat = new THREE.ShaderMaterial({
  uniforms: {
    tPortal: { value: portalRT.texture },
  },
  vertexShader: `
    varying vec4 vClipPos;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vClipPos = gl_Position;
    }
  `,
  fragmentShader: `
    uniform sampler2D tPortal;
    varying vec4 vClipPos;
    void main() {
      // Convert clip-space to screen-space UV
      vec2 uv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
      gl_FragColor = texture2D(tPortal, uv);
    }
  `,
});

const portalMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(portalWidth, portalHeight),
  portalMat
);
portalMesh.position.set(0, portalY, portalZ);
sceneA.add(portalMesh);

// ============================================================
// SCENE B — Blue night pier world (seen through portal)
// ============================================================
const sceneB = new THREE.Scene();

// Sky sphere
const skyCanvasB = createGradientSky(
  ["#020b1a", "#0a2342", "#0f4c75", "#3282b8", "#5cb8e4"],
  1024
);
sceneB.background = new THREE.CanvasTexture(skyCanvasB);

// Ocean
const oceanGeo = new THREE.PlaneGeometry(100, 100, 64, 64);
const ocean = new THREE.Mesh(
  oceanGeo,
  new THREE.MeshStandardMaterial({
    color: 0x0a3d62,
    roughness: 0.4,
    metalness: 0.3,
  })
);
ocean.rotation.x = -Math.PI / 2;
ocean.receiveShadow = true;
sceneB.add(ocean);

// Pier
const pierMat = new THREE.MeshStandardMaterial({
  color: 0xcc4455,
  roughness: 0.6,
});
const pierTop = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 50), pierMat);
pierTop.position.set(0, 0.5, -15);
pierTop.receiveShadow = true;
pierTop.castShadow = true;
sceneB.add(pierTop);

// Pier plank lines
for (let z = -40; z <= 10; z += 0.4) {
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.16, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xaa3344, roughness: 0.7 })
  );
  plank.position.set(0, 0.51, z);
  sceneB.add(plank);
}

// Railings
const railMat = new THREE.MeshStandardMaterial({
  color: 0xcc4455,
  roughness: 0.5,
  metalness: 0.2,
});
for (const side of [-1, 1]) {
  for (let z = -40; z <= 10; z += 2) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8),
      railMat
    );
    post.position.set(side * 2, 1.2, z);
    post.castShadow = true;
    sceneB.add(post);
  }
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 50),
    railMat
  );
  rail.position.set(side * 2, 1.9, -15);
  sceneB.add(rail);
}

// Stars
const starGeo = new THREE.BufferGeometry();
const starVerts = [];
for (let i = 0; i < 800; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.45;
  const r = 80;
  starVerts.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}
starGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starVerts, 3)
);
sceneB.add(
  new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 })
  )
);

// Lighting B
const moonB = new THREE.DirectionalLight(0x88bbff, 1.8);
moonB.position.set(-5, 12, -5);
moonB.castShadow = true;
moonB.shadow.mapSize.set(1024, 1024);
sceneB.add(moonB);
sceneB.add(new THREE.AmbientLight(0x4488bb, 0.5));

// Yellow ball B
const ballB = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.3 })
);
ballB.position.set(1.2, 0.62, 3);
ballB.castShadow = true;
sceneB.add(ballB);

// ============================================================
// TEXT OVERLAY
// ============================================================
const overlay = document.createElement("div");
overlay.style.cssText = `
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 10;
  mix-blend-mode: difference;
  color: white;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  text-transform: uppercase;
`;

function createOrganicText(text, x, y, fontSize, seed) {
  const container = document.createElement("div");
  container.style.cssText = `
    position: absolute; left: ${x}; top: ${y};
    font-size: ${fontSize}px; font-weight: 300;
    letter-spacing: 0.25em;
    display: flex; gap: 1px;
  `;
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (const char of text) {
    const span = document.createElement("span");
    span.textContent = char === " " ? "\u00A0\u00A0" : char;
    const rotDeg = (rand() - 0.5) * 20;
    const offX = (rand() - 0.5) * 4;
    const offY = (rand() - 0.5) * 8;
    const scale = 0.85 + rand() * 0.35;
    span.style.cssText = `
      display: inline-block;
      transform: translate(${offX}px, ${offY}px) rotate(${rotDeg}deg) scale(${scale});
    `;
    container.appendChild(span);
  }
  return container;
}

overlay.appendChild(
  createOrganicText("ONLY THIS MOMENT", "40px", "35px", 11, 42)
);
overlay.appendChild(
  createOrganicText("THREE", "calc(100% - 120px)", "35px", 11, 77)
);
document.body.appendChild(overlay);

// ============================================================
// RENDER LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const t = performance.now() * 0.001;

  // Animate balls
  ball.position.y = 0.12 + Math.sin(t * 2) * 0.05;
  ballB.position.y = 0.62 + Math.sin(t * 2 + 1) * 0.05;

  // Animate ocean waves
  const oPos = oceanGeo.attributes.position;
  for (let i = 0; i < oPos.count; i++) {
    const x = oPos.getX(i);
    const y = oPos.getY(i);
    oPos.setZ(
      i,
      Math.sin(x * 0.5 + t * 0.5) * Math.cos(y * 0.3 + t * 0.3) * 0.4
    );
  }
  oPos.needsUpdate = true;
  oceanGeo.computeVertexNormals();

  // PASS 1: Render scene B to texture using the SAME camera
  // (same position/rotation = true parallax through the portal)
  renderer.setRenderTarget(portalRT);
  renderer.render(sceneB, camera);

  // PASS 2: Render scene A to screen (portal plane samples scene B texture
  // using screen-space UVs, so it looks like a real window)
  renderer.setRenderTarget(null);
  renderer.render(sceneA, camera);
}

animate();

// ============================================================
// HELPERS
// ============================================================
function createGradientSky(colors, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function createRailroad(scene) {
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0xcc4455,
    roughness: 0.6,
  });
  for (const side of [-0.5, 0.5]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 20),
      trackMat
    );
    rail.position.set(side, 0.04, 2);
    rail.castShadow = true;
    rail.receiveShadow = true;
    scene.add(rail);
  }
  for (let z = -8; z <= 12; z += 0.6) {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.06, 0.15),
      trackMat
    );
    tie.position.set(0, 0.01, z);
    tie.receiveShadow = true;
    scene.add(tie);
  }
}

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio, 2);
  portalRT.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
});
