export class InputController {
  private readonly keys = new Set<string>();
  private active = false;

  constructor() {
    window.addEventListener("keydown", (event) => {
      if (this.isDrivingKey(event.code)) {
        event.preventDefault();
      }
      this.keys.add(event.code);
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
    });
  }

  enable(): void {
    this.active = true;
  }

  get throttle(): number {
    if (!this.active) {
      return 0;
    }
    return this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0;
  }

  get brake(): number {
    if (!this.active) {
      return 0;
    }
    return this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0;
  }

  get steer(): number {
    if (!this.active) {
      return 0;
    }
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0;
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0;
    return right - left;
  }

  get handbrake(): number {
    if (!this.active) {
      return 0;
    }
    return this.keys.has("Space") ? 1 : 0;
  }

  private isDrivingKey(code: string): boolean {
    return (
      code === "KeyW" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD" ||
      code === "ArrowUp" ||
      code === "ArrowLeft" ||
      code === "ArrowDown" ||
      code === "ArrowRight" ||
      code === "Space"
    );
  }
}
