import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { seededRandom } from "./math";
import { RoadModel } from "./RoadModel";
import { TerrainSurface } from "./TerrainSurface";

export class Scenery {
  private readonly maxTrees = 520;
  private readonly maxRocks = 110;
  private readonly maxGrass = 900;
  private readonly maxSigns = 24;
  private readonly trunkMesh = new InstancedMesh(
    new CylinderGeometry(0.28, 0.48, 5.8, 7),
    new MeshStandardMaterial({ color: 0x4b3221, roughness: 0.92 }),
    this.maxTrees,
  );
  private readonly coniferLowerMesh = new InstancedMesh(
    new ConeGeometry(2.5, 7.4, 9),
    new MeshStandardMaterial({ color: 0x143b26, roughness: 0.98 }),
    this.maxTrees,
  );
  private readonly coniferUpperMesh = new InstancedMesh(
    new ConeGeometry(1.8, 5.8, 9),
    new MeshStandardMaterial({ color: 0x1d5632, roughness: 0.98 }),
    this.maxTrees,
  );
  private readonly broadleafCanopyMesh = new InstancedMesh(
    new DodecahedronGeometry(2.35, 2),
    new MeshStandardMaterial({ color: 0x3f6f2b, roughness: 0.96 }),
    this.maxTrees,
  );
  private readonly grassMesh = new InstancedMesh(
    new PlaneGeometry(0.46, 1.55),
    new MeshStandardMaterial({ color: 0x587936, roughness: 0.94, side: DoubleSide }),
    this.maxGrass,
  );
  private readonly darkGrassMesh = new InstancedMesh(
    new PlaneGeometry(0.52, 1.85),
    new MeshStandardMaterial({ color: 0x314f2f, roughness: 0.96, side: DoubleSide }),
    this.maxGrass,
  );
  private readonly rockMesh = new InstancedMesh(
    new DodecahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0x77786f, roughness: 0.92 }),
    this.maxRocks,
  );
  private readonly signPoleMesh = new InstancedMesh(
    new CylinderGeometry(0.08, 0.1, 3.1, 8),
    new MeshStandardMaterial({ color: 0x6e776f, roughness: 0.72, metalness: 0.2 }),
    this.maxSigns,
  );
  private readonly signBoardMesh = new InstancedMesh(
    new BoxGeometry(4.2, 1.65, 0.14),
    new MeshStandardMaterial({ color: 0xf1b83f, roughness: 0.58, emissive: 0x211100 }),
    this.maxSigns,
  );
  private originZ = Number.NaN;

  constructor(
    scene: Scene,
    private readonly road: RoadModel,
    private readonly terrain: TerrainSurface,
  ) {
    for (const mesh of [
      this.trunkMesh,
      this.coniferLowerMesh,
      this.coniferUpperMesh,
      this.broadleafCanopyMesh,
      this.grassMesh,
      this.darkGrassMesh,
      this.rockMesh,
      this.signPoleMesh,
      this.signBoardMesh,
    ]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  update(referenceZ: number): void {
    const nextOrigin = Math.floor((referenceZ - 240) / 70) * 70;

    if (nextOrigin === this.originZ) {
      return;
    }

    this.originZ = nextOrigin;
    this.rebuildInstances();
  }

  private rebuildInstances(): void {
    const identity = new Quaternion();
    const matrix = new Matrix4();
    let treeCount = 0;
    let rockCount = 0;
    let grassCount = 0;
    let darkGrassCount = 0;
    let signCount = 0;

    for (let slot = 0; slot < 164; slot += 1) {
      const z = this.originZ + slot * 7.2;

      for (const side of [-1, 1]) {
        const seed = z * 0.037 + side * 91.3;
        const treeChance = seededRandom(seed);
        const rockChance = seededRandom(seed + 3.4);

        if (treeChance > 0.05 && treeCount < this.maxTrees) {
          const forestBias = treeChance > 0.74 ? 140 : 44;
          const offset = this.road.roadWidth * 0.5 + this.road.shoulderWidth + forestBias + seededRandom(seed + 1) * 170;
          const x = this.road.centerX(z) + side * offset;
          const y = this.terrain.heightAt(x, z);
          const scaleValue = 0.86 + seededRandom(seed + 2) * 2.2;
          const trunkScale = new Vector3(scaleValue * 0.75, scaleValue, scaleValue * 0.75);
          const canopyScale = new Vector3(scaleValue, scaleValue, scaleValue);
          const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), seededRandom(seed + 6) * Math.PI);

          matrix.compose(new Vector3(x, y + 2.9 * scaleValue, z), rotation, trunkScale);
          this.trunkMesh.setMatrixAt(treeCount, matrix);

          if (seededRandom(seed + 8) > 0.46) {
            matrix.compose(new Vector3(x, y + 7.2 * scaleValue, z), rotation, canopyScale);
            this.coniferLowerMesh.setMatrixAt(treeCount, matrix);
            matrix.compose(new Vector3(x, y + 10.3 * scaleValue, z), rotation, canopyScale);
            this.coniferUpperMesh.setMatrixAt(treeCount, matrix);
            matrix.compose(new Vector3(x, -2000, z), identity, canopyScale);
            this.broadleafCanopyMesh.setMatrixAt(treeCount, matrix);
          } else {
            matrix.compose(new Vector3(x, -2000, z), identity, canopyScale);
            this.coniferLowerMesh.setMatrixAt(treeCount, matrix);
            this.coniferUpperMesh.setMatrixAt(treeCount, matrix);
            matrix.compose(new Vector3(x, y + 7.6 * scaleValue, z), rotation, canopyScale);
            this.broadleafCanopyMesh.setMatrixAt(treeCount, matrix);
          }

          treeCount += 1;
        }

        if (rockChance > 0.72 && rockCount < this.maxRocks) {
          const offset = this.road.roadWidth * 0.5 + this.road.shoulderWidth + 8 + seededRandom(seed + 4) * 80;
          const x = this.road.centerX(z) + side * offset;
          const y = this.terrain.heightAt(x, z);
          const scaleValue = 0.45 + seededRandom(seed + 5) * 1.7;
          const scale = new Vector3(scaleValue * 1.4, scaleValue * 0.65, scaleValue);
          matrix.compose(new Vector3(x, y + scaleValue * 0.38, z), identity, scale);
          this.rockMesh.setMatrixAt(rockCount, matrix);
          rockCount += 1;
        }

        for (let patch = 0; patch < 3; patch += 1) {
          if (grassCount >= this.maxGrass || darkGrassCount >= this.maxGrass) {
            break;
          }

          const patchSeed = seed + patch * 19.8;
          const offset = this.road.roadWidth * 0.5 + this.road.shoulderWidth * 0.35 + seededRandom(patchSeed) * 34;
          const x = this.road.centerX(z + patch) + side * offset;
          const y = this.terrain.heightAt(x, z);
          const scaleValue = 0.55 + seededRandom(patchSeed + 2) * 1.45;
          const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), seededRandom(patchSeed + 3) * Math.PI);
          const scale = new Vector3(scaleValue, scaleValue, scaleValue);

          matrix.compose(new Vector3(x, y + 0.78 * scaleValue, z + seededRandom(patchSeed + 4) * 3), rotation, scale);
          if (seededRandom(patchSeed + 5) > 0.48) {
            this.grassMesh.setMatrixAt(grassCount, matrix);
            grassCount += 1;
          } else {
            this.darkGrassMesh.setMatrixAt(darkGrassCount, matrix);
            darkGrassCount += 1;
          }
        }
      }
    }

    for (let slot = 0; slot < this.maxSigns; slot += 1) {
      const z = this.originZ + 80 + slot * 92;
      const sample = this.road.sample(z);
      const side = seededRandom(z * 0.04) > 0.5 ? 1 : -1;
      const offset = side * (this.road.roadWidth * 0.5 + this.road.shoulderWidth + 2.8);
      const position = sample.center.clone().addScaledVector(sample.right, offset);
      const yaw = sample.yaw + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
      const boardScale = new Vector3(1, 1, 1);
      const poleScale = new Vector3(1, 1, 1);

      matrix.compose(new Vector3(position.x, position.y + 1.55, position.z), rotation, poleScale);
      this.signPoleMesh.setMatrixAt(signCount, matrix);
      matrix.compose(new Vector3(position.x, position.y + 3.2, position.z), rotation, boardScale);
      this.signBoardMesh.setMatrixAt(signCount, matrix);
      signCount += 1;
    }

    this.trunkMesh.count = treeCount;
    this.coniferLowerMesh.count = treeCount;
    this.coniferUpperMesh.count = treeCount;
    this.broadleafCanopyMesh.count = treeCount;
    this.grassMesh.count = grassCount;
    this.darkGrassMesh.count = darkGrassCount;
    this.rockMesh.count = rockCount;
    this.signPoleMesh.count = signCount;
    this.signBoardMesh.count = signCount;

    for (const mesh of [
      this.trunkMesh,
      this.coniferLowerMesh,
      this.coniferUpperMesh,
      this.broadleafCanopyMesh,
      this.grassMesh,
      this.darkGrassMesh,
      this.rockMesh,
      this.signPoleMesh,
      this.signBoardMesh,
    ]) {
      if (mesh.instanceMatrix) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
