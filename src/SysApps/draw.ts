import { drawToWindow } from "../Core/overlay";

export default function run(id: symbol) {
  drawToWindow(id, (ctx) => {
    const canvas = ctx.canvas;
    let drawing = false;

    function paint(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      ctx.fillStyle = "black";
      ctx.fillRect(x, y, 4, 4);
    }

    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId); // so like pointer events means i dont have to do crap with mouseleave to stop drawing, w pointer events api
      paint(e);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (drawing) paint(e);
    });
    canvas.addEventListener("pointerup", () => {
      drawing = false;
    });
  });
}
