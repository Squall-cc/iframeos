import { drawToWindow } from "../Core/overlay";

export default function run(id: symbol) {
  drawToWindow(id, (ctx) => {
    // uses draw to window cuz its lowk been useless
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "black";
    ctx.fillText("hello", 10, 30);
  });
}
