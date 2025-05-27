// src/main.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls, currentModel;
let baseTextureImage = null;
let logoImage = null;
let savedModelBlobUrl = null;

// Параметры размещения логотипа на текстуре
const LOGO_POSITION = {
  left: 212,  // отступ от левого края
  top: 512    // отступ от верхнего края
};

// DOM элементы
const modelSelect = document.getElementById('modelSelect');
const logoInput = document.getElementById('logoInput');
const colorSelect = document.getElementById('colorSelect');
const applyBtn = document.getElementById('applyBtn');
const toMindARBtn = document.getElementById('toMindARBtn');

const loader = new GLTFLoader();
const exporter = new GLTFExporter();

// Скрытый канвас для работы с текстурой
const textureCanvas = document.createElement('canvas');
textureCanvas.width = 2048;
textureCanvas.height = 2048;
const textureCtx = textureCanvas.getContext('2d');

// Инициализация three.js
function initThree() {
  const threeCanvas = document.getElementById('threeCanvas');
  renderer = new THREE.WebGLRenderer({ 
    canvas: threeCanvas, 
    antialias: true, 
    alpha: true 
  });
  renderer.setSize(threeCanvas.width, threeCanvas.height);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  camera = new THREE.PerspectiveCamera(
    50, 
    threeCanvas.width / threeCanvas.height, 
    0.1, 
    1000
  );
  camera.position.set(0, 1, 2);

  window.addEventListener('resize', onWindowResize);

  function onWindowResize() {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h, false);
  }

  onWindowResize();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  
  // Освещение
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
}

// Загрузка модели
function loadModel(filename) {
  if (currentModel) scene.remove(currentModel);
  baseTextureImage = null;

  loader.load(`./src/assets/models/${filename}`, gltf => {
    currentModel = gltf.scene;
    scene.add(currentModel);

    // Находим текстуру модели
    currentModel.traverse(node => {
      if (node.isMesh && node.material.map) {
        baseTextureImage = node.material.map.image;
      }
    });
    updateModelTexture();

    // Центрируем модель
    const box = new THREE.Box3().setFromObject(currentModel);
    const center = box.getCenter(new THREE.Vector3());
    currentModel.position.sub(center);

  }, undefined, error => {
    console.error('Ошибка загрузки модели:', error);
  });
}

// Цикл рендеринга
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Обновление текстуры модели
function updateModelTexture() {
  if (!baseTextureImage) return;
  const w = baseTextureImage.naturalWidth ?? baseTextureImage.width;
  if (w === 0) return;

  // 1) Копируем оригинальную текстуру
  textureCtx.clearRect(0, 0, 2048, 2048);
  textureCtx.drawImage(baseTextureImage, 0, 0, 2048, 2048);

  // 2) Перекрашиваем указанный цвет
  const imgData = textureCtx.getImageData(0, 0, 2048, 2048);
  const data = imgData.data;
  const targetColor = hexToRgb('#3a8ac7');
  const newColor = hexToRgb(colorSelect.value);

  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - targetColor.r) < 10 && 
        Math.abs(data[i+1] - targetColor.g) < 10 && 
        Math.abs(data[i+2] - targetColor.b) < 10) {
      data[i] = newColor.r;
      data[i+1] = newColor.g;
      data[i+2] = newColor.b;
    }
  }
  textureCtx.putImageData(imgData, 0, 0);

  // 3) Добавляем логотип (если есть)
  if (logoImage && logoImage.complete) {
    // Размеры области для логотипа (как в оригинале)
    const logoAreaWidth = 718;
    const logoAreaHeight = 130;
    
    // Создаем временный канвас для логотипа
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = logoAreaWidth;
    logoCanvas.height = logoAreaHeight;
    const logoCtx = logoCanvas.getContext('2d');
    
    // Заполняем фон прозрачным (или можно оставить #f0f0f0)
    logoCtx.fillStyle = 'rgba(0,0,0,0)';
    logoCtx.fillRect(0, 0, logoAreaWidth, logoAreaHeight);
    
    // Масштабируем логотип с сохранением пропорций
    const scale = Math.min(
      logoAreaWidth / logoImage.width,
      logoAreaHeight / logoImage.height
    );
    const scaledWidth = logoImage.width * scale;
    const scaledHeight = logoImage.height * scale;
    const offsetX = (logoAreaWidth - scaledWidth) / 2;
    const offsetY = (logoAreaHeight - scaledHeight) / 2;
    
    logoCtx.drawImage(
      logoImage, 
      offsetX, 
      offsetY, 
      scaledWidth, 
      scaledHeight
    );
    
    // Поворачиваем на 90° против часовой стрелки
    textureCtx.save();
    textureCtx.translate(LOGO_POSITION.left, LOGO_POSITION.top + logoAreaWidth);
    textureCtx.rotate(-Math.PI / 2);
    textureCtx.drawImage(logoCanvas, 0, 0);
    textureCtx.restore();
  }

  applyTextureToModel();
}

// Применяем текстуру к модели
function applyTextureToModel() {
  if (!currentModel) return;
  
  const canvasTex = new THREE.CanvasTexture(textureCanvas);
  canvasTex.flipY = false;
  
  currentModel.traverse(node => {
    if (node.isMesh) {
      node.material.map = canvasTex;
      node.material.needsUpdate = true;
    }
  });
}

// Вспомогательная функция для работы с цветами
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : {r: 0, g: 0, b: 0};
}

// Обработчики событий
logoInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  
  const img = new Image();
  img.onload = () => {
    logoImage = img;
    updateModelTexture();
  };
  img.onerror = () => console.error('Ошибка загрузки логотипа');
  img.src = URL.createObjectURL(file);
});

colorSelect.addEventListener('change', () => updateModelTexture());

modelSelect.addEventListener('change', e => {
  loadModel(e.target.value);
});

applyBtn.addEventListener('click', async () => {
  console.log('Нажали Сохранить модель');

  if (!currentModel) {
    console.log('currentModel ещё не загружен');
    alert('Пожалуйста, загрузите модель сначала');
    return;
  }

  try {
    // 1. Создаем временную сцену для экспорта
    const exportScene = new THREE.Scene();
    const modelClone = currentModel.clone(true);
    exportScene.add(modelClone);

    // 2. Обновляем все материалы
    modelClone.traverse(node => {
      if (node.isMesh) {
        // Создаем новый материал с обновленной текстурой
        const material = new THREE.MeshStandardMaterial({
          map: node.material.map,
          color: node.material.color,
          roughness: node.material.roughness,
          metalness: node.material.metalness
        });
        node.material = material;
        node.material.needsUpdate = true;
      }
    });

    // 3. Экспортируем модель
    const gltf = await new Promise((resolve, reject) => {
      exporter.parse(
        exportScene,
        result => resolve(result),
        error => reject(error),
        {
          binary: true,
          includeCustomExtensions: true,
          animations: currentModel.animations,
          onlyVisible: false,
          truncateDrawRange: true,
          maxTextureSize: 2048
        }
      );
    });

    if (savedModelBlobUrl) {
      URL.revokeObjectURL(savedModelBlobUrl);
    }

    // 4. Создаем и скачиваем файл
    const blob = new Blob(
      [gltf instanceof ArrayBuffer ? gltf : gltf.buffer],
      { type: 'model/gltf-binary' }
    );

    const reader = new FileReader();
    reader.onload = () => {
      console.log('> reader.onload fired; result length =', reader.result.length);
      try {
        sessionStorage.setItem('modelDataUrl', reader.result);
        console.log('> sessionStorage OK');
      } catch (e) {
        console.error('> sessionStorage error:', e);
      }
      console.log('> Removing hidden from toMindARBtn');
      toMindARBtn.classList.remove('hidden');
    };
    reader.onerror = (e) => {
      console.error('FileReader.onerror', e);
    };
    reader.readAsDataURL(blob);

  } catch (error) {
    console.error('Ошибка при экспорте модели:', error);
    alert('Произошла ошибка при экспорте модели. Проверьте консоль для деталей.');
  }
});

toMindARBtn.addEventListener('click', () => {
  window.location.href = `mindar.html?model=${encodeURIComponent(savedModelBlobUrl)}`;
});

// Инициализация приложения
initThree();
animate(); 
loadModel(modelSelect.value);