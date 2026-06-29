import { PerspectiveCamera, Vector3 } from "three";
import { Vehicle } from "./Vehicle";

export class CameraRig {
  private mode = 0;
  private readonly target = new Vector3();

  constructor(private readonly camera: PerspectiveCamera) {}

  toggleMode(): void {
    this.mode = (this.mode + 1) % 3;
  }

  reset(vehicle: Vehicle): void {
    const forward = vehicle.forward;
    this.camera.position.copy(vehicle.position).addScaledVector(forward, -12).add(new Vector3(0, 5.5, 0));
    this.target.copy(vehicle.position).addScaledVector(forward, 10).add(new Vector3(0, 1.6, 0));
    this.camera.lookAt(this.target);
  }

  update(vehicle: Vehicle, dt: number): void {
    const forward = vehicle.forward;
    const right = vehicle.right;
    const speedFactor = Math.min(Math.abs(vehicle.speed) / 58, 1);
    const desired = new Vector3();
    const lookAt = new Vector3();

    if (this.mode === 1) {
      desired.copy(vehicle.position).addScaledVector(forward, 1.9).add(new Vector3(0, 1.55, 0));
      lookAt.copy(vehicle.position).addScaledVector(forward, 42).add(new Vector3(0, 1.3, 0));
    } else if (this.mode === 2) {
      desired
        .copy(vehicle.position)
        .addScaledVector(forward, -15)
        .addScaledVector(right, 9)
        .add(new Vector3(0, 7.2, 0));
      lookAt.copy(vehicle.position).addScaledVector(forward, 13).add(new Vector3(0, 1.4, 0));
    } else {
      desired
        .copy(vehicle.position)
        .addScaledVector(forward, -11 - speedFactor * 4)
        .add(new Vector3(0, 5.2 + speedFactor * 1.7, 0));
      lookAt.copy(vehicle.position).addScaledVector(forward, 15 + speedFactor * 10).add(new Vector3(0, 1.4, 0));
    }

    const positionAlpha = this.mode === 1 ? 1 : 1 - Math.exp(-5.8 * dt);
    const targetAlpha = 1 - Math.exp(-7.5 * dt);
    this.camera.position.lerp(desired, positionAlpha);
    this.target.lerp(lookAt, targetAlpha);
    this.camera.lookAt(this.target);
  }
}
