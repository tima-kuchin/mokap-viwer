import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';
import { ARButton }    from 'https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/webxr/ARButton.js';

let scene, camera, renderer, controller, reticle, penModel, targetMesh;

// Offscreen-canvas для логотипа и цвета
const canvas = document.createElement('canvas');
const ctx    = canvas.getContext('2d');
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
  ctx.rotate(-Math.PI / 2);
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

initCanvas();

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

// UI: смена цвета
document.getElementById('color-picker').addEventListener('change', e => {
  baseColor = e.target.value;
  initCanvas();
  updateTexture();
});

// Инициализация Three.js + AR
scene    = new THREE.Scene();
camera   = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.getElementById('ar-container').appendChild(renderer.domElement);

// ARButton
document.getElementById('controls').appendChild(
  ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
);

// Контроллер для select
controller = renderer.xr.getController(0);
controller.addEventListener('select', onSelect);
scene.add(controller);

// Ретикл для hit-test
const ringGeo = new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI/2);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
reticle = new THREE.Mesh(ringGeo, ringMat);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

// Загрузка модели
new GLTFLoader().load('models/pen.glb', gltf => {
  penModel = gltf.scene;
  penModel.visible = false;
  penModel.traverse(c => { if (c.isMesh) targetMesh = c; });
  scene.add(penModel);
});

// Определяем onSelect для постановки модели
function onSelect() {
  if (reticle.visible && penModel) {
    penModel.position.setFromMatrixPosition(reticle.matrix);
    penModel.visible = true;
    updateTexture();
  }
}

// Hit-test setup
renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  session.requestReferenceSpace('viewer')
    .then(ref => session.requestHitTestSource({ space: ref }))
    .then(source => {
      renderer.setAnimationLoop((t, frame) => {
        if (frame) {
          const refSpace = renderer.xr.getReferenceSpace();
          const hits = frame.getHitTestResults(source);
          if (hits.length) {
            const pose = hits[0].getPose(refSpace);
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
          } else {
            reticle.visible = false;
          }
        }
        renderer.render(scene, camera);
      });
    })
    .catch(err => console.error('hitTestSource error', err));
});

// Кнопка «Построить модель»
document.getElementById('place-btn').addEventListener('click', onSelect);

// Обработка ресайза
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
