import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import { fbm, lerp, smoothstep } from "./math";
import { RoadModel } from "./RoadModel";
import { createGrassTexture } from "./textures";

export class TerrainSurface {
  private readonly width = 680;
  private readonly length = 1180;
  private readonly columns = 72;
  private readonly rows = 132;
  private readonly geometry = new BufferGeometry();
  private readonly material = new MeshStandardMaterial({
    roughness: 0.94,
    metalness: 0,
    vertexColors: true,
    map: createGrassTexture(),
  });
  private readonly mesh = new Mesh(this.geometry, this.material);
  private originZ = Number.NaN;
  private originX = Number.NaN;

  constructor(
    scene: Scene,
    private readonly road: RoadModel,
  ) {
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(referenceZ: number): void {
    const nextOriginZ = Math.floor((referenceZ - 360) / 55) * 55;
    const nextOriginX = Math.round(this.road.centerX(referenceZ) / 25) * 25;

    if (nextOriginZ === this.originZ && nextOriginX === this.originX) {
      return;
    }

    this.originZ = nextOriginZ;
    this.originX = nextOriginX;
    this.rebuildGeometry();
  }

  heightAt(x: number, z: number): number {
    const roadX = this.road.centerX(z);
    const lateral = Math.abs(x - roadX);
    const roadHeight = this.road.elevation(z);
    const broadHills = fbm(x * 0.0065, z * 0.0065) * 34;
    const detail = fbm(x * 0.035, z * 0.035) * 5.5;
    const ridge = Math.max(0, fbm(x * 0.012 + 50, z * 0.012 - 11)) * 18;
    const wildHeight = broadHills + detail + ridge;
    const roadBlend = smoothstep(
      this.road.roadWidth * 0.5 + this.road.shoulderWidth,
      92,
      lateral,
    );
    const drainage = Math.min(lateral * 0.025, 7);

    return lerp(roadHeight - 0.55 + drainage, wildHeight, roadBlend);
  }

  private rebuildGeometry(): void {
    const vertexCount = (this.columns + 1) * (this.rows + 1);
    const positions = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices: number[] = [];
    const color = new Color();
    let cursor = 0;
    let colorCursor = 0;

    for (let row = 0; row <= this.rows; row += 1) {
      const z = this.originZ + (row / this.rows) * this.length;

      for (let col = 0; col <= this.columns; col += 1) {
        const x = this.originX - this.width * 0.5 + (col / this.columns) * this.width;
        const y = this.heightAt(x, z);
        const roadDistance = Math.abs(this.road.lateralOffset(x, z));
        const high = smoothstep(8, 52, y);
        const fieldNoise = fbm(x * 0.032 + 4, z * 0.032 - 7);
        const roadSide = 1 - smoothstep(
          this.road.roadWidth * 0.5 + this.road.shoulderWidth,
          70,
          roadDistance,
        );

        color.setRGB(
          lerp(0.15, 0.28, high) + roadSide * 0.04 + fieldNoise * 0.018,
          lerp(0.26, 0.43, 1 - high) + roadSide * 0.05 + fieldNoise * 0.028,
          lerp(0.12, 0.18, high) + fieldNoise * 0.012,
        );

        positions[cursor] = x;
        positions[cursor + 1] = y;
        positions[cursor + 2] = z;
        cursor += 3;

        colors[colorCursor] = color.r;
        colors[colorCursor + 1] = color.g;
        colors[colorCursor + 2] = color.b;
        colorCursor += 3;
      }
    }

    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.columns; col += 1) {
        const a = row * (this.columns + 1) + col;
        const b = a + 1;
        const c = a + this.columns + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    this.geometry.setIndex(indices);
    this.geometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.geometry.setAttribute("color", new BufferAttribute(colors, 3));
    this.geometry.computeVertexNormals();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
