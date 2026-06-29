import "./style.css";
import { RoughRoadGame } from "./game/RoughRoadGame";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
const speed = document.querySelector<HTMLElement>("#speed");
const distance = document.querySelector<HTMLElement>("#distance");
const grip = document.querySelector<HTMLElement>("#grip");
const startGate = document.querySelector<HTMLElement>("#start-gate");
const cameraButton = document.querySelector<HTMLButtonElement>("#camera-button");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button");

if (!canvas || !speed || !distance || !grip || !startGate || !cameraButton || !resetButton) {
  throw new Error("Rough Road could not find its required DOM nodes.");
}

const gate = startGate;
const game = new RoughRoadGame(canvas, { speed, distance, grip });
(window as Window & { roughRoadGame?: RoughRoadGame }).roughRoadGame = game;

if (new URLSearchParams(window.location.search).get("smoke") === "steering") {
  game.runSteeringSmokeTest();
}
let started = false;

function startGame(): void {
  if (started) {
    return;
  }

  started = true;
  gate.classList.add("hidden");
  game.start();
}

gate.addEventListener("click", startGame);
gate.addEventListener(
  "keydown",
  (event) => {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      startGame();
    }
  },
);

cameraButton.addEventListener("click", () => game.toggleCamera());
resetButton.addEventListener("click", () => game.reset());
