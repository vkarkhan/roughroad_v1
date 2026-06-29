import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  Vector3,
} from "three";
import { RoadModel } from "./RoadModel";
import { createAsphaltTexture, createShoulderTexture } from "./textures";

export class RoadSurface {
  private readonly roadMaterial = new MeshStandardMaterial({
    color: 0x8c887d,
    roughness: 0.9,
    metalness: 0.02,
    map: createAsphaltTexture() as CanvasTexture,
  });
  private readonly shoulderMaterial = new MeshStandardMaterial({
    color: 0x7f846b,
    roughness: 0.96,
    map: createShoulderTexture() as CanvasTexture,
  });
  private readonly markerMaterial = new MeshStandardMaterial({
    color: 0xf4eee0,
    roughness: 0.64,
    emissive: 0x14100c,
  });
  private readonly railMaterial = new MeshStandardMaterial({
    color: 0xd1d0c4,
    roughness: 0.58,
    metalness: 0.18,
  });
  private readonly postMaterial = new MeshStandardMaterial({
    color: 0x6c756c,
    roughness: 0.72,
    metalness: 0.12,
  });
  private readonly roadMesh = new Mesh(new BufferGeometry(), this.roadMaterial);
  private readonly leftShoulder = new Mesh(new BufferGeometry(), this.shoulderMaterial);
  private readonly rightShoulder = new Mesh(new BufferGeometry(), this.shoulderMaterial);
  private readonly furnishings = new Group();
  private readonly markerGeometry = new BoxGeometry(0.18, 0.035, 7);
  private readonly edgeLineGeometry = new BoxGeometry(0.2, 0.036, 13.5);
  private readonly railGeometry = new BoxGeometry(0.22, 0.22, 13.5);
  private readonly postGeometry = new BoxGeometry(0.24, 1.65, 0.24);
  private originZ = Number.NaN;

  constructor(
    scene: Scene,
    private readonly road: RoadModel,
  ) {
    this.roadMesh.receiveShadow = true;
    this.leftShoulder.receiveShadow = true;
    this.rightShoulder.receiveShadow = true;
    scene.add(this.leftShoulder, this.rightShoulder, this.roadMesh, this.furnishings);
  }

  update(referenceZ: number): void {
    const nextOrigin = Math.floor((referenceZ - 240) / 42) * 42;

    if (nextOrigin === this.originZ) {
      return;
    }

    this.originZ = nextOrigin;
    this.replaceGeometry(this.roadMesh, [-this.road.roadWidth * 0.5, this.road.roadWidth * 0.5], 0.035);
    this.replaceGeometry(
      this.leftShoulder,
      [-this.road.roadWidth * 0.5 - this.road.shoulderWidth, -this.road.roadWidth * 0.5],
      0.015,
    );
    this.replaceGeometry(
      this.rightShoulder,
      [this.road.roadWidth * 0.5, this.road.roadWidth * 0.5 + this.road.shoulderWidth],
      0.015,
    );
    this.rebuildFurnishings();
  }

  private replaceGeometry(mesh: Mesh, offsets: [number, number], lift: number): void {
    mesh.geometry.dispose();
    mesh.geometry = this.buildStripGeometry(offsets, lift);
  }

  private buildStripGeometry(offsets: [number, number], lift: number): BufferGeometry {
    const length = 1050;
    const segments = 210;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const uvs = new Float32Array((segments + 1) * 2 * 2);
    const indices: number[] = [];
    let positionCursor = 0;
    let uvCursor = 0;

    for (let index = 0; index <= segments; index += 1) {
      const z = this.originZ + (index / segments) * length;
      const sample = this.road.sample(z);

      for (let side = 0; side < 2; side += 1) {
        const offset = offsets[side];
        const point = sample.center.clone().addScaledVector(sample.right, offset);
        positions[positionCursor] = point.x;
        positions[positionCursor + 1] = point.y + lift;
        positions[positionCursor + 2] = point.z;
        positionCursor += 3;

        uvs[uvCursor] = side;
        uvs[uvCursor + 1] = index / 5;
        uvCursor += 2;
      }
    }

    for (let index = 0; index < segments; index += 1) {
      const a = index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }

    const geometry = new BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    return geometry;
  }

  private rebuildFurnishings(): void {
    this.furnishings.clear();

    const markerCount = Math.floor(1050 / 20);
    for (let index = 0; index < markerCount; index += 1) {
      const z = this.originZ + index * 20;
      const sample = this.road.sample(z);
      const marker = new Mesh(this.markerGeometry, this.markerMaterial);
      marker.position.copy(sample.center).addScaledVector(sample.tangent, 0.2);
      marker.position.y += 0.08;
      marker.rotation.y = sample.yaw;
      marker.receiveShadow = true;
      this.furnishings.add(marker);
    }

    const edgeCount = Math.floor(1050 / 14);
    for (let index = 0; index < edgeCount; index += 1) {
      const z = this.originZ + index * 14;
      const sample = this.road.sample(z);

      for (const side of [-1, 1]) {
        const line = new Mesh(this.edgeLineGeometry, this.markerMaterial);
        line.position
          .copy(sample.center)
          .addScaledVector(sample.right, side * (this.road.roadWidth * 0.5 - 0.25));
        line.position.y += 0.085;
        line.rotation.y = sample.yaw;
        line.receiveShadow = true;
        this.furnishings.add(line);
      }
    }

    const railSlots = Math.floor(1050 / 14);
    const railMesh = new InstancedMesh(this.railGeometry, this.railMaterial, railSlots * 2);
    const postMesh = new InstancedMesh(this.postGeometry, this.postMaterial, railSlots * 2);
    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    let instance = 0;

    for (let index = 0; index < railSlots; index += 1) {
      const z = this.originZ + index * 14;
      const sample = this.road.sample(z);
      quaternion.setFromAxisAngle(new Vector3(0, 1, 0), sample.yaw);

      for (const side of [-1, 1]) {
        const offset = side * (this.road.roadWidth * 0.5 + this.road.shoulderWidth * 0.92);
        const railPosition = sample.center.clone().addScaledVector(sample.right, offset);
        railPosition.y += 0.92;
        matrix.compose(railPosition, quaternion, scale);
        railMesh.setMatrixAt(instance, matrix);

        const postPosition = sample.center.clone().addScaledVector(sample.right, offset);
        postPosition.y += 0.48;
        matrix.compose(postPosition, quaternion, scale);
        postMesh.setMatrixAt(instance, matrix);
        instance += 1;
      }
    }

    railMesh.castShadow = true;
    postMesh.castShadow = true;
    railMesh.receiveShadow = true;
    postMesh.receiveShadow = true;
    this.furnishings.add(railMesh, postMesh);
  }
}
