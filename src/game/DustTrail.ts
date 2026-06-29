import {
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
  Scene,
  Vector3,
} from "three";

interface Particle {
  age: number;
  ttl: number;
  position: Vector3;
  velocity: Vector3;
}

export class DustTrail {
  private readonly maxParticles = 180;
  private readonly particles: Particle[] = [];
  private readonly positions = new Float32Array(this.maxParticles * 3);
  private readonly colors = new Float32Array(this.maxParticles * 3);
  private readonly geometry = new BufferGeometry();
  private readonly points: Points;

  constructor(scene: Scene) {
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new BufferAttribute(this.colors, 3));
    this.points = new Points(
      this.geometry,
      new PointsMaterial({
        size: 0.62,
        transparent: true,
        opacity: 0.38,
        vertexColors: true,
        depthWrite: false,
      }),
    );
    scene.add(this.points);
  }

  update(
    dt: number,
    position: Vector3,
    forward: Vector3,
    right: Vector3,
    speed: number,
    intensity: number,
  ): void {
    const speedAbs = Math.abs(speed);
    const emitCount = speedAbs > 7 ? Math.ceil(intensity * 3) : 0;

    for (let index = 0; index < emitCount; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      this.emit(
        position
          .clone()
          .addScaledVector(forward, -1.75)
          .addScaledVector(right, side * 0.88)
          .add(new Vector3((Math.random() - 0.5) * 0.35, 0.18, (Math.random() - 0.5) * 0.35)),
        forward,
        speedAbs,
      );
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += dt;
      particle.velocity.y += 0.42 * dt;
      particle.position.addScaledVector(particle.velocity, dt);

      if (particle.age >= particle.ttl) {
        this.particles.splice(index, 1);
      }
    }

    this.writeGeometry();
  }

  private emit(position: Vector3, forward: Vector3, speed: number): void {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }

    this.particles.push({
      age: 0,
      ttl: 0.8 + Math.random() * 0.8,
      position,
      velocity: new Vector3(
        -forward.x * (0.8 + speed * 0.015) + (Math.random() - 0.5) * 1.6,
        0.8 + Math.random() * 0.8,
        -forward.z * (0.8 + speed * 0.015) + (Math.random() - 0.5) * 1.6,
      ),
    });
  }

  private writeGeometry(): void {
    for (let index = 0; index < this.maxParticles; index += 1) {
      const particle = this.particles[index];
      const offset = index * 3;

      if (particle) {
        const fade = 1 - particle.age / particle.ttl;
        this.positions[offset] = particle.position.x;
        this.positions[offset + 1] = particle.position.y;
        this.positions[offset + 2] = particle.position.z;
        this.colors[offset] = 0.88 * fade;
        this.colors[offset + 1] = 0.72 * fade;
        this.colors[offset + 2] = 0.48 * fade;
      } else {
        this.positions[offset] = 0;
        this.positions[offset + 1] = -1000;
        this.positions[offset + 2] = 0;
        this.colors[offset] = 0;
        this.colors[offset + 1] = 0;
        this.colors[offset + 2] = 0;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
