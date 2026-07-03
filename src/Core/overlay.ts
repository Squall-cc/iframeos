import { setContent, getSymbolByHWnd } from "./windowhelpers";

let ctx: CanvasRenderingContext2D | null = null;

export function setOverlayContext(c: CanvasRenderingContext2D) {
  ctx = c;
}

export function draw(fn: (ctx: CanvasRenderingContext2D) => void) {
  if (ctx) fn(ctx);
}

let canvasmap = new Map<symbol, HTMLCanvasElement>();

export function drawToWindow(
  id: symbol,
  fn: (ctx: CanvasRenderingContext2D) => void,
) {
  let canvas = canvasmap.get(id);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    canvas.draggable = false;
    canvasmap.set(id, canvas);
    setContent(id, canvas);
  }
  fn(canvas.getContext("2d")!);
}

export function drawToWindowByHWnd(
  hwnd: string,
  fn: (ctx: CanvasRenderingContext2D) => void,
) {
  let id = getSymbolByHWnd(hwnd);
  if (id) drawToWindow(id, fn);
}

export function clearWindowCanvas(id: symbol) {
  canvasmap.delete(id);
}
