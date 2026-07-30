import { drawToWindow } from "../Core/overlay";
import { setMinSize } from "../Core/windowhelpers";

export default function run(id: symbol) {
  setMinSize(id, 400, 300);
  drawToWindow(id, (ctx) => {
    // uses draw to window cuz its lowk been useless
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "black";
    ctx.fillText("hello", 10, 30);
  });
}
