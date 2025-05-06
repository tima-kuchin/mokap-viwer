import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MindARThree } from 'mindar-image-three';

const generateCustomTexture = async (originalImage, logoFile, newColorHex = '#00ff00') => {
  const canvas = document.createElement('canvas');
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(originalImage, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const targetColor = [0x3a, 0x8a, 0xc7];
  const newColor = [
    parseInt(newColorHex.slice(1, 3), 16),
    parseInt(newColorHex.slice(3, 5), 16),
    parseInt(newColorHex.slice(5, 7), 16)
  ];

  for (let i = 0; i < data.length; i += 4) {
    if (
      data[i] === targetColor[0] &&
      data[i + 1] === targetColor[1] &&
      data[i + 2] === targetColor[2]
    ) {
      data[i] = newColor[0];
      data[i + 1] = newColor[1];
      data[i + 2] = newColor[2];
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const logoImage = new Image();
  logoImage.src = URL.createObjectURL(logoFile);
  await logoImage.decode();

  // Вставка логотипа (позиция и размер под твой макет)
  ctx.save();
  ctx.translate(215 + 135 / 2, 512 + 738 / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(logoImage, -738 / 2, -135 / 2, 738, 135);
  ctx.restore();

  return new THREE.CanvasTexture(canvas);
};

const start = async (logoFile, colorHex) => {
  const mindarThree = new MindARThree({
    container: document.querySelector("#ar-container"),
    imageTargetSrc: "./targets.mind",
  });

  const { renderer, scene, camera } = mindarThree;
  const anchor = mindarThree.addAnchor(0);

  const loader = new GLTFLoader();
  loader.load('models/pen-ed.glb', async (gltf) => {
    const model = gltf.scene;
    model.scale.set(0.5, 0.5, 0.5);
    model.position.set(0, 0.2, 0);
    model.rotation.set(Math.PI / 2, 0, 0);

    model.traverse(async (child) => {
      if (child.isMesh && child.material.map) {
        const originalImage = child.material.map.image;
        const texture = await generateCustomTexture(originalImage, logoFile, colorHex);
        child.material.map = texture;
        child.material.needsUpdate = true;
      }
    });

    anchor.group.add(model);
  });

  await mindarThree.start();
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
};

document.getElementById("startAR").addEventListener("click", () => {
  const logoInput = document.getElementById("logoInput");
  const colorPicker = document.getElementById("colorPicker");
  if (logoInput.files.length === 0) {
    alert("Пожалуйста, загрузите логотип.");
    return;
  }
  start(logoInput.files[0], colorPicker.value);
});
