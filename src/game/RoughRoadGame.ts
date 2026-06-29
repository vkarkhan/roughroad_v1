import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { CameraRig } from "./CameraRig";
import { DustTrail } from "./DustTrail";
import { InputController } from "./InputController";
import { RoadModel } from "./RoadModel";
import { RoadSurface } from "./RoadSurface";
import { Scenery } from "./Scenery";
import { TerrainSurface } from "./TerrainSurface";
import { Vehicle } from "./Vehicle";

interface HudElements {
  speed: HTMLElement;
  distance: HTMLElement;
  grip: HTMLElement;
}

export interface RoughRoadDebugState {
  frontWheelYaw: number;
  heading: number;
  inputSteer: number;
  running: boolean;
  speed: number;
  steerVisual: number;
  x: number;
  z: number;
}

export interface RoughRoadSmokeResult {
  checks: {
    frontWheelYawOpposesPerInputDirection: boolean;
    rightInputMovesRightOfLeftInput: boolean;
    steeringInputsAreOpposite: boolean;
    throttleProducesMotion: boolean;
  };
  left: RoughRoadDebugState;
  right: RoughRoadDebugState;
}

export class RoughRoadGame {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(66, 1, 0.1, 1600);
  private readonly clock = new Clock();
  private readonly input = new InputController();
  private readonly road = new RoadModel();
  private readonly terrain: TerrainSurface;
  private readonly roadSurface: RoadSurface;
  private readonly scenery: Scenery;
  private readonly vehicle: Vehicle;
  private readonly cameraRig: CameraRig;
  private readonly dust: DustTrail;
  private readonly sun = new DirectionalLight(0xfff0cf, 3.2);
  private readonly sunTarget = new Vector3();
  private running = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly hud: HudElements,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.background = new Color(0x9fc6d4);
    this.scene.fog = new FogExp2(0xb8c7bd, 0.00165);
    this.setupLights();

    this.terrain = new TerrainSurface(this.scene, this.road);
    this.roadSurface = new RoadSurface(this.scene, this.road);
    this.vehicle = new Vehicle(this.scene, this.road);
    this.scenery = new Scenery(this.scene, this.road, this.terrain);
    this.cameraRig = new CameraRig(this.camera);
    this.dust = new DustTrail(this.scene);
    this.cameraRig.reset(this.vehicle);

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.terrain.update(this.vehicle.position.z);
    this.roadSurface.update(this.vehicle.position.z);
    this.scenery.update(this.vehicle.position.z);
    this.publishDebugState();
  }

  start(): void {
    this.running = true;
    this.input.enable();
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  reset(): void {
    this.vehicle.reset();
    this.cameraRig.reset(this.vehicle);
    this.terrain.update(this.vehicle.position.z);
    this.roadSurface.update(this.vehicle.position.z);
    this.scenery.update(this.vehicle.position.z);
  }

  toggleCamera(): void {
    this.cameraRig.toggleMode();
  }

  getDebugState(): RoughRoadDebugState {
    return {
      ...this.vehicle.getDebugState(),
      inputSteer: this.input.steer,
      running: this.running,
    };
  }

  runSteeringSmokeTest(): RoughRoadSmokeResult {
    const runCase = (steer: number): RoughRoadDebugState => {
      const syntheticInput = {
        get brake(): number {
          return 0;
        },
        get handbrake(): number {
          return 0;
        },
        get steer(): number {
          return steer;
        },
        get throttle(): number {
          return 1;
        },
      } as unknown as InputController;

      this.vehicle.reset();
      this.terrain.update(this.vehicle.position.z);

      for (let frame = 0; frame < 48; frame += 1) {
        this.vehicle.update(syntheticInput, this.terrain, 1 / 60);
      }

      return this.getDebugState();
    };

    const right = runCase(1);
    const left = runCase(-1);
    const result: RoughRoadSmokeResult = {
      right,
      left,
      checks: {
        frontWheelYawOpposesPerInputDirection: right.frontWheelYaw < 0 && left.frontWheelYaw > 0,
        rightInputMovesRightOfLeftInput: right.x > left.x,
        steeringInputsAreOpposite: right.steerVisual > 0 && left.steerVisual < 0,
        throttleProducesMotion: right.speed > 1 && left.speed > 1,
      },
    };

    this.vehicle.reset();
    this.cameraRig.reset(this.vehicle);
    this.publishDebugState();
    document.documentElement.dataset.smokeSteering = JSON.stringify(result);
    document.documentElement.dataset.smokeSteeringPassed = String(Object.values(result.checks).every(Boolean));
    return result;
  }

  private setupLights(): void {
    const hemi = new HemisphereLight(0xcfe9ff, 0x304127, 1.9);
    this.scene.add(hemi);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 380;
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.scene.add(this.sun, this.sun.target);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.033);

    if (this.running) {
      this.vehicle.update(this.input, this.terrain, dt);
    }

    this.terrain.update(this.vehicle.position.z);
    this.roadSurface.update(this.vehicle.position.z);
    this.scenery.update(this.vehicle.position.z);
    this.dust.update(
      dt,
      this.vehicle.position,
      this.vehicle.forward,
      this.vehicle.right,
      this.vehicle.speed,
      0.5 + (1 - this.vehicle.grip) * 2.2,
    );
    this.cameraRig.update(this.vehicle, dt);
    this.updateSun();
    this.updateHud();
    this.publishDebugState();
    this.renderer.render(this.scene, this.camera);
  }

  private updateSun(): void {
    this.sun.position.set(
      this.vehicle.position.x - 70,
      this.vehicle.position.y + 130,
      this.vehicle.position.z + 70,
    );
    this.sunTarget.set(this.vehicle.position.x, this.vehicle.position.y, this.vehicle.position.z + 28);
    this.sun.target.position.copy(this.sunTarget);
  }

  private updateHud(): void {
    this.hud.speed.textContent = `${Math.max(0, Math.round(this.vehicle.speed * 3.6))}`;
    this.hud.distance.textContent = `${Math.max(0, this.vehicle.position.z / 1000).toFixed(1)} km`;
    this.hud.grip.textContent = `${Math.round(this.vehicle.grip * 100)}%`;
  }

  private publishDebugState(): void {
    const state = this.getDebugState();
    const dataset = document.documentElement.dataset;

    (window as Window & { __ROUGHROAD_DEBUG__?: RoughRoadDebugState }).__ROUGHROAD_DEBUG__ = state;
    dataset.frontWheelYaw = state.frontWheelYaw.toFixed(4);
    dataset.heading = state.heading.toFixed(4);
    dataset.inputSteer = state.inputSteer.toFixed(4);
    dataset.speed = state.speed.toFixed(4);
    dataset.steerVisual = state.steerVisual.toFixed(4);
    dataset.vehicleX = state.x.toFixed(4);
    dataset.vehicleZ = state.z.toFixed(4);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
  }
}
