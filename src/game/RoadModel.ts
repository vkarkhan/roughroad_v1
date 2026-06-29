import { Vector3 } from "three";

export interface RoadSample {
  center: Vector3;
  right: Vector3;
  tangent: Vector3;
  yaw: number;
}

export class RoadModel {
  readonly roadWidth = 10.5;
  readonly shoulderWidth = 9;

  centerX(z: number): number {
    return Math.sin(z * 0.0034) * 38 + Math.sin(z * 0.0115 + 1.8) * 8;
  }

  elevation(z: number): number {
    return (
      Math.sin(z * 0.0042 + 0.6) * 5.2 +
      Math.sin(z * 0.014 + 1.4) * 1.2 +
      Math.sin(z * 0.028) * 0.36
    );
  }

  slope(z: number): number {
    return (this.elevation(z + 1) - this.elevation(z - 1)) * 0.5;
  }

  centerSlope(z: number): number {
    return (this.centerX(z + 1) - this.centerX(z - 1)) * 0.5;
  }

  yawAt(z: number): number {
    return Math.atan2(this.centerSlope(z), 1);
  }

  lateralOffset(x: number, z: number): number {
    return x - this.centerX(z);
  }

  sample(z: number): RoadSample {
    const dx = this.centerSlope(z);
    const dy = this.slope(z);
    const center = new Vector3(this.centerX(z), this.elevation(z), z);
    const tangent = new Vector3(dx, dy, 1).normalize();
    const right = new Vector3(tangent.z, 0, -tangent.x).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);

    return { center, right, tangent, yaw };
  }
}
