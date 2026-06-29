import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Scene,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { InputController } from "./InputController";
import { RoadModel } from "./RoadModel";
import { TerrainSurface } from "./TerrainSurface";
import { angleDelta, clamp, damp, lerp, smoothstep } from "./math";

export class Vehicle {
  readonly group = new Group();
  readonly position = new Vector3();
  speed = 0;
  grip = 1;
  private heading = 0;
  private steerVisual = 0;
  private wheelSpin = 0;
  private readonly frontWheels: Object3D[] = [];
  private readonly wheelMeshes: Mesh[] = [];
  private frontWheelYaw = 0;

  constructor(scene: Scene, private readonly road: RoadModel) {
    this.position.set(this.road.centerX(0), this.road.elevation(0), 10);
    this.heading = this.road.yawAt(0);
    this.group.rotation.order = "YXZ";
    this.buildModel();
    scene.add(this.group);
  }

  reset(): void {
    const z = Math.max(10, this.position.z - 8);
    this.position.set(this.road.centerX(z), this.road.elevation(z), z);
    this.heading = this.road.yawAt(z);
    this.speed = 0;
    this.grip = 1;
  }

  update(input: InputController, terrain: TerrainSurface, dt: number): void {
    const lateral = this.road.lateralOffset(this.position.x, this.position.z);
    const offroad = smoothstep(
      this.road.roadWidth * 0.5 + this.road.shoulderWidth * 0.35,
      this.road.roadWidth * 0.5 + this.road.shoulderWidth + 22,
      Math.abs(lateral),
    );
    const speedAbs = Math.abs(this.speed);
    const centerAssist = (1 - Math.abs(input.steer)) * (1 - offroad);
    const yawAssist = angleDelta(this.road.yawAt(this.position.z), this.heading);
    const lateralAssist = clamp(lateral / (this.road.roadWidth * 0.5), -1, 1);

    this.heading += (yawAssist * 0.9 - lateralAssist * 0.28) * centerAssist * dt;

    let acceleration = input.throttle * 34;
    if (input.brake > 0) {
      acceleration -= this.speed > 2 ? 54 : 17;
    }

    const drag = this.speed * (0.26 + speedAbs * 0.011);
    this.speed += (acceleration - drag) * dt;

    if (input.handbrake > 0) {
      this.speed = damp(this.speed, 0, 1.9, dt);
    }

    this.speed = clamp(this.speed, -12, 66);
    this.grip = clamp(1 - offroad * 0.45 - input.handbrake * 0.32, 0.38, 1);
    this.steerVisual = damp(this.steerVisual, input.steer, 8, dt);
    this.heading += this.steerVisual * this.speed * (0.013 + speedAbs * 0.00018) * this.grip * dt;

    const forward = this.forward;
    this.position.x += forward.x * this.speed * dt;
    this.position.z += forward.z * this.speed * dt;

    const roadHeight = this.road.elevation(this.position.z);
    const terrainHeight = terrain.heightAt(this.position.x, this.position.z);
    const targetY = lerp(roadHeight, terrainHeight + 0.12, offroad);
    this.position.y = damp(this.position.y, targetY, 14, dt);

    if (offroad > 0.08) {
      this.speed *= 1 - offroad * 0.42 * dt;
    }

    const roadPitch = Math.atan(this.road.slope(this.position.z)) * (1 - offroad);
    const speedLean = clamp(speedAbs / 54, 0, 1);
    const bodyRoll = -this.steerVisual * speedLean * 0.16 + Math.sin(this.position.z * 0.09) * offroad * 0.035;
    this.group.position.copy(this.position);
    this.group.rotation.set(roadPitch, this.heading, bodyRoll);

    this.wheelSpin += this.speed * dt * 1.9;
    for (const wheel of this.wheelMeshes) {
      wheel.rotation.x = this.wheelSpin;
    }
    for (const wheel of this.frontWheels) {
      this.frontWheelYaw = -this.steerVisual * 0.48;
      wheel.rotation.y = this.frontWheelYaw;
    }
  }

  getDebugState(): {
    frontWheelYaw: number;
    heading: number;
    speed: number;
    steerVisual: number;
    x: number;
    z: number;
  } {
    return {
      frontWheelYaw: this.frontWheelYaw,
      heading: this.heading,
      speed: this.speed,
      steerVisual: this.steerVisual,
      x: this.position.x,
      z: this.position.z,
    };
  }

  get forward(): Vector3 {
    return new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
  }

  get right(): Vector3 {
    return new Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading)).normalize();
  }

  private buildModel(): void {
    const paint = new MeshPhysicalMaterial({
      color: 0xf0f0e8,
      roughness: 0.34,
      metalness: 0.04,
      clearcoat: 0.65,
      clearcoatRoughness: 0.16,
    });
    const blackTrim = new MeshStandardMaterial({ color: 0x080b0c, roughness: 0.56 });
    const tireMaterial = new MeshStandardMaterial({ color: 0x0c0f10, roughness: 0.82 });
    const rimMaterial = new MeshStandardMaterial({ color: 0xc5c4ba, roughness: 0.34, metalness: 0.7 });
    const glass = new MeshPhysicalMaterial({
      color: 0x7f969a,
      roughness: 0.05,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
      transmission: 0.18,
    });
    const light = new MeshStandardMaterial({
      color: 0xfff1c0,
      emissive: 0xffd48b,
      emissiveIntensity: 1.6,
    });
    const tail = new MeshStandardMaterial({
      color: 0x8e1d1d,
      emissive: 0xff1b1b,
      emissiveIntensity: 0.9,
    });

    const body = this.addPart(new RoundedBoxGeometry(2.65, 0.78, 4.78, 6, 0.22), paint, [0, 0.78, 0]);
    body.scale.set(1, 0.92, 1);

    const lower = this.addPart(new RoundedBoxGeometry(2.88, 0.38, 4.38, 4, 0.16), blackTrim, [0, 0.42, -0.12]);
    lower.scale.set(1, 0.82, 1);

    const hood = this.addPart(new RoundedBoxGeometry(2.18, 0.24, 1.45, 5, 0.12), paint, [0, 1.08, 1.36]);
    hood.rotation.x = -0.06;

    const trunk = this.addPart(new RoundedBoxGeometry(2.22, 0.3, 1.15, 5, 0.13), paint, [0, 1.0, -1.5]);
    trunk.rotation.x = 0.05;

    const cabin = this.addPart(new RoundedBoxGeometry(1.74, 0.8, 1.78, 6, 0.16), glass, [0, 1.36, -0.36]);
    cabin.scale.set(0.96, 0.9, 1);

    const windshield = this.addPart(new RoundedBoxGeometry(1.62, 0.08, 0.9, 4, 0.07), glass, [0, 1.31, 0.54]);
    windshield.rotation.x = -0.44;

    const rearGlass = this.addPart(new RoundedBoxGeometry(1.58, 0.08, 0.82, 4, 0.07), glass, [0, 1.23, -1.18]);
    rearGlass.rotation.x = 0.4;

    const grille = this.addPart(new RoundedBoxGeometry(1.28, 0.24, 0.08, 4, 0.05), blackTrim, [0, 0.64, 2.43]);
    grille.scale.set(1, 0.7, 1);

    const diffuser = this.addPart(new RoundedBoxGeometry(1.65, 0.28, 0.1, 4, 0.05), blackTrim, [0, 0.58, -2.46]);
    diffuser.scale.set(1, 0.8, 1);

    const emblem = this.addPart(new CircleGeometry(0.13, 28), rimMaterial, [0, 0.96, -2.43]);
    emblem.rotation.y = Math.PI;

    for (const x of [-0.76, 0.76]) {
      const lamp = this.addPart(new RoundedBoxGeometry(0.58, 0.16, 0.08, 4, 0.04), light, [x, 0.84, 2.44]);
      lamp.rotation.y = x > 0 ? -0.08 : 0.08;

      const tailLamp = this.addPart(new RoundedBoxGeometry(0.72, 0.2, 0.08, 4, 0.05), tail, [x, 0.88, -2.47]);
      tailLamp.rotation.y = x > 0 ? 0.14 : -0.14;

      const mirror = this.addPart(new RoundedBoxGeometry(0.42, 0.16, 0.24, 3, 0.05), blackTrim, [x * 1.42, 1.18, 0.25]);
      mirror.rotation.y = x > 0 ? -0.26 : 0.26;
    }

    for (const z of [-1.42, 1.42]) {
      for (const x of [-1.22, 1.22]) {
        const pivot = new Object3D();
        pivot.position.set(x, 0.46, z);

        const wheel = new Mesh(new CylinderGeometry(0.5, 0.5, 0.42, 32), tireMaterial);
        wheel.rotation.z = Math.PI * 0.5;
        wheel.castShadow = true;
        pivot.add(wheel);

        const rim = new Mesh(new CylinderGeometry(0.28, 0.28, 0.46, 24), rimMaterial);
        rim.rotation.z = Math.PI * 0.5;
        rim.castShadow = true;
        pivot.add(rim);

        const rimRing = new Mesh(new TorusGeometry(0.3, 0.025, 8, 24), rimMaterial);
        rimRing.rotation.y = Math.PI * 0.5;
        rimRing.castShadow = true;
        pivot.add(rimRing);

        this.group.add(pivot);
        this.wheelMeshes.push(wheel);

        if (z > 0) {
          this.frontWheels.push(pivot);
        }
      }
    }
  }

  private addPart(
    geometry: BufferGeometry | CircleGeometry | RoundedBoxGeometry,
    material: MeshStandardMaterial | MeshPhysicalMaterial,
    position: [number, number, number],
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
}
