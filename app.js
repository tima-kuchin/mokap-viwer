import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.126.1/examples/jsm/webxr/ARButton.js';

let scene, camera, renderer, raycaster, reticle, penModel, targetMesh;
let manualPlane, manualPlaneHeight = 0.5;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = canvas.height = 2048;

let logoImg = null;
let baseColor = '#3a8ac7';

function initCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const r0 = 0x3a, g0 = 0x8a, b0 = 0xc7;

  const rNew = parseInt(baseColor.slice(1, 3), 16);
  const gNew = parseInt(baseColor.slice(3, 5), 16);
  const bNew = parseInt(baseColor.slice(5, 7), 16);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === r0 && data[i + 1] === g0 && data[i + 2] === b0) {
      data[i] = rNew;
      data[i + 1] = gNew;
      data[i + 2] = bNew;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  if (logoImg) {
    const x0 = 215, y0 = 512, w = 135, h = 738;
    ctx.save();
    ctx.translate(x0 + w / 2, y0 + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(logoImg, -h / 2, -w / 2, h, w);
    ctx.restore();
  }
}

function updateTexture() {
  if (!targetMesh) return;
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;

  if (!(targetMesh.material instanceof THREE.MeshStandardMaterial)) {
    targetMesh.material = new THREE.MeshStandardMaterial();
  }
  targetMesh.material.map = tex;
  targetMesh.material.needsUpdate = true;
}

document.getElementById('logo-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file && file.type === 'image/png') {
    const reader = new FileReader();
    reader.onload = ev => {
      logoImg = new Image();
      logoImg.src = ev.target.result;
      logoImg.onload = () => {
        initCanvas();
        updateTexture();
      };
    };
    reader.readAsDataURL(file);
  } else {
    alert('Выберите PNG-файл.');
  }
});

document.getElementById('color-picker').addEventListener('change', e => {
  baseColor = e.target.value;
  initCanvas();
  updateTexture();
});

const slider = document.getElementById('plane-height');
const disp = document.getElementById('plane-height-val');
manualPlaneHeight = parseFloat(slider.value);
disp.textContent = manualPlaneHeight.toFixed(2);
slider.addEventListener('input', () => {
  manualPlaneHeight = parseFloat(slider.value);
  disp.textContent = manualPlaneHeight.toFixed(2);
  manualPlane.constant = -manualPlaneHeight;
});

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (!supported) alert('Ваше устройство не поддерживает WebXR AR');
  });
} else {
  alert('Ваш браузер не поддерживает WebXR');
}

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.getElementById('ar-container').appendChild(renderer.domElement);

const arButton = ARButton.createButton(renderer, { requiredFeatures: ['local-floor'] });
document.getElementById('ar-button-container').appendChild(arButton);

renderer.xr.addEventListener('sessionstart', () => {
  document.getElementById('controls').style.display = 'none';
});

renderer.xr.addEventListener('sessionend', () => {
  document.getElementById('controls').style.display = 'flex';
});

raycaster = new THREE.Raycaster();
reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
reticle.visible = false;
scene.add(reticle);

manualPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -manualPlaneHeight);

new GLTFLoader().load(
  'models/pen.glb',
  gltf => {
    penModel = gltf.scene;
    penModel.visible = false;
    penModel.traverse(obj => {
      if (obj.isMesh && obj.material.map) targetMesh = obj;
    });
    scene.add(penModel);
    initCanvas();
    updateTexture();
  },
  undefined,
  err => alert('Ошибка загрузки модели: ' + err.message)
);

renderer.domElement.addEventListener('pointermove', ev => {
  const r = renderer.domElement.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  const y = -((ev.clientY - r.top) / r.height) * 2 + 1;

  camera.updateMatrixWorld();
  raycaster.setFromCamera({ x, y }, camera);

  const hit = raycaster.ray.intersectPlane(manualPlane, new THREE.Vector3());
  if (hit) {
    reticle.visible = true;
    reticle.position.copy(hit);
    reticle.rotation.set(-Math.PI / 2, 0, 0);

    if (penModel) {
      penModel.visible = true;
      penModel.position.copy(hit);
      updateTexture();
    }
  } else {
    reticle.visible = false;
  }
});

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

initCanvas();
