// app.js
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';
import { ARButton }    from 'https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/webxr/ARButton.js';

let scene, camera, renderer, raycaster, reticle, penModel, targetMesh;
let manualPlane, manualPlaneHeight = 0.5;

// Offscreen-canvas для цвета и логотипа
const canvas = document.createElement('canvas'),
      ctx    = canvas.getContext('2d');
canvas.width = canvas.height = 2048;
let logoImg = null, baseColor = '#3a8ac7';

function initCanvas() {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (logoImg) drawLogo();
}
function drawLogo() {
  const x0 = canvas.width - 350, y0 = 512, w = 135, h = 738;
  ctx.clearRect(x0, y0, w, h);
  ctx.save();
  ctx.translate(x0, y0 + h);
  ctx.rotate(-Math.PI/2);
  ctx.drawImage(logoImg, 0, 0, h, w);
  ctx.restore();
}
function updateTexture() {
  if (!targetMesh) return;
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY       = false;
  tex.encoding    = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  targetMesh.material.map        = tex;
  targetMesh.material.needsUpdate = true;
}

// UI: загрузка логотипа
document.getElementById('logo-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file && file.type === 'image/png') {
    const reader = new FileReader();
    reader.onload = ev => {
      logoImg = new Image();
      logoImg.src = ev.target.result;
      logoImg.onload = () => { initCanvas(); updateTexture(); };
    };
    reader.readAsDataURL(file);
  } else alert('Выберите PNG-файл.');
});

// UI: смена цвета корпуса
document.getElementById('color-picker').addEventListener('change', e => {
  baseColor = e.target.value;
  initCanvas(); updateTexture();
});

// UI: ручная высота плоскости
const slider = document.getElementById('plane-height'),
      disp   = document.getElementById('plane-height-val');
manualPlaneHeight = parseFloat(slider.value);
disp.textContent = manualPlaneHeight.toFixed(2);
slider.addEventListener('input', () => {
  manualPlaneHeight = parseFloat(slider.value);
  disp.textContent = manualPlaneHeight.toFixed(2);
  manualPlane.constant = -manualPlaneHeight;
});

// Инициализация Three.js и ARButton
scene    = new THREE.Scene();
camera   = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.getElementById('ar-container').appendChild(renderer.domElement);

document.getElementById('controls').appendChild(
  ARButton.createButton(renderer, { requiredFeatures: ['local-floor'] })
);

// Raycaster + reticle
raycaster = new THREE.Raycaster();
reticle   = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
reticle.visible = false;
scene.add(reticle);

// Горизонтальная плоскость y = manualPlaneHeight
manualPlane = new THREE.Plane(new THREE.Vector3(0,1,0), -manualPlaneHeight);

// Загрузка модели ручки
new GLTFLoader().load('models/pen.glb', gltf => {
  penModel = gltf.scene;
  penModel.visible = false;
  penModel.traverse(c => { if (c.isMesh) targetMesh = c; });
  scene.add(penModel);
  initCanvas();
  updateTexture();
});

// pointermove — «привязка» ретикла к ручной плоскости
renderer.domElement.addEventListener('pointermove', ev => {
  const r = renderer.domElement.getBoundingClientRect();
  const x = ((ev.clientX - r.left)/r.width)*2 - 1;
  const y = -((ev.clientY - r.top)/r.height)*2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  const hit = raycaster.ray.intersectPlane(manualPlane, new THREE.Vector3());
  if (hit) {
    reticle.visible = true;
    reticle.position.copy(hit);
    reticle.rotation.set(-Math.PI/2,0,0);
  } else reticle.visible = false;
});

// Кнопка «Построить модель»
document.getElementById('place-btn').addEventListener('click', () => {
  if (reticle.visible && penModel) {
    penModel.position.copy(reticle.position);
    penModel.visible = true;
    updateTexture();
  }
});

// Анимация и ресайз (в том числе внутри AR-сессии)
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Инициализация канваса цвета/лого
initCanvas();
