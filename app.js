// app.js
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader }  from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer;
let raycaster, reticle, penModel, targetMesh;
let manualPlane, manualPlaneHeight = 0.5;

//
// 1) Offscreen-canvas для цвета и логотипа
//
const canvas = document.createElement('canvas');
const ctx    = canvas.getContext('2d');
canvas.width = canvas.height = 2048;
let logoImg = null, baseColor = '#3a8ac7';

function initCanvas() {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  if (logoImg) drawLogo();
}
function drawLogo() {
  // область: справа→215–350px, сверху→512–1250px, но с учётом canvas-width
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

//
// 2) UI: загрузка логотипа и смена цвета
//
document.getElementById('logo-upload').addEventListener('change', e=>{
  const file = e.target.files[0];
  if(file && file.type==='image/png') {
    const reader = new FileReader();
    reader.onload = ev=>{
      logoImg = new Image();
      logoImg.src = ev.target.result;
      logoImg.onload = ()=>{ initCanvas(); updateTexture(); };
    };
    reader.readAsDataURL(file);
  } else alert('Выберите PNG-файл.');
});

document.getElementById('color-picker').addEventListener('change', e=>{
  baseColor = e.target.value;
  initCanvas(); updateTexture();
});

//
// 3) UI: ручное задание высоты плоскости
//
const phSlider = document.getElementById('plane-height');
const phVal    = document.getElementById('plane-height-val');
manualPlaneHeight = parseFloat(phSlider.value);
phVal.textContent = manualPlaneHeight.toFixed(2);
phSlider.addEventListener('input', e=>{
  manualPlaneHeight = parseFloat(e.target.value);
  phVal.textContent = manualPlaneHeight.toFixed(2);
  manualPlane.constant = -manualPlaneHeight;
});

//
// 4) Инициализация Three.js
//
scene    = new THREE.Scene();
camera   = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.01, 20);
renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setSize(innerWidth, innerHeight);
document.getElementById('ar-container').appendChild(renderer.domElement);

// свет
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(1,2,1);
scene.add(dir);

//
// 5) Raycaster + Reticle
//
raycaster = new THREE.Raycaster();
reticle   = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.1, 32).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
reticle.visible = false;
scene.add(reticle);

// задаём горизонтальную плоскость y = manualPlaneHeight
manualPlane = new THREE.Plane(new THREE.Vector3(0,1,0), -manualPlaneHeight);

renderer.domElement.addEventListener('pointermove', ev=>{
  // нормализуем экранные координаты
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((ev.clientX - rect.left)/rect.width)*2 - 1;
  const y = -((ev.clientY - rect.top)/rect.height)*2 + 1;
  raycaster.setFromCamera({ x,y }, camera);

  const hit = raycaster.ray.intersectPlane(manualPlane, new THREE.Vector3());
  if(hit) {
    reticle.visible = true;
    reticle.position.copy(hit);
    reticle.rotation.set(-Math.PI/2, 0, 0);
  } else {
    reticle.visible = false;
  }
});

//
// 6) Загрузка 3D-модели ручки
//
new GLTFLoader().load('models/pen.glb', gltf=>{
  penModel = gltf.scene;
  penModel.visible = false;
  penModel.traverse(c=>{
    if(c.isMesh) targetMesh = c;
  });
  scene.add(penModel);

  // после загрузки сразу нанесём базовую текстуру
  initCanvas();
  updateTexture();
});

//
// 7) Постановка модели по кнопке
//
document.getElementById('place-btn').addEventListener('click', ()=>{
  if(reticle.visible && penModel) {
    penModel.position.copy(reticle.position);
    penModel.visible = true;
    updateTexture();
  }
});

//
// 8) Анимация и ресайз
//
function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
animate();
