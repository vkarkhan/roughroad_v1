import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Texture } from "three";

type NoisePainter = (context: CanvasRenderingContext2D, x: number, y: number, value: number) => void;

function buildNoiseTexture(size: number, painter: NoisePainter): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is required for procedural textures.");
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value =
        Math.random() * 0.58 +
        Math.sin(x * 0.17 + y * 0.09) * 0.18 +
        Math.sin((x + y) * 0.041) * 0.24;
      painter(context, x, y, value);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createAsphaltTexture(): Texture {
  const texture = buildNoiseTexture(256, (context, x, y, value) => {
    const speckle = Math.random() > 0.86 ? Math.random() * 44 : 0;
    const gravel = Math.max(0, Math.min(255, 118 + Math.random() * 44 + value * 18 + speckle));
    context.fillStyle = `rgb(${gravel}, ${gravel - 4}, ${gravel - 8})`;
    context.fillRect(x, y, 1, 1);
  });
  texture.repeat.set(2.2, 1);
  return texture;
}

export function createGrassTexture(): Texture {
  const texture = buildNoiseTexture(256, (context, x, y, value) => {
    const blade = Math.sin(x * 0.45 + y * 0.08) > 0.62 ? 34 : 0;
    const r = Math.max(42, Math.min(156, 72 + value * 50 + blade * 0.35));
    const g = Math.max(86, Math.min(186, 118 + value * 62 + blade));
    const b = Math.max(40, Math.min(110, 52 + value * 32));
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.fillRect(x, y, 1, 1);
  });
  texture.repeat.set(18, 18);
  return texture;
}

export function createShoulderTexture(): Texture {
  const texture = buildNoiseTexture(128, (context, x, y, value) => {
    const r = Math.max(74, Math.min(142, 92 + value * 40));
    const g = Math.max(86, Math.min(150, 102 + value * 38));
    const b = Math.max(66, Math.min(120, 78 + value * 28));
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.fillRect(x, y, 1, 1);
  });
  texture.repeat.set(2.4, 1);
  return texture;
}
