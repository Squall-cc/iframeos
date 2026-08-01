import { setContent, setMinSize } from "../Core/windowhelpers";

const PALETTE = [
  "#000000",
  "#ffffff",
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#e91e63",
  "#795548",
  "#95a5a6",
];

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 460, 380);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;overflow:hidden;";

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:6px;align-items:center;padding:5px 8px;border-bottom:1px solid rgba(0,0,0,0.15);background:rgba(0,0,0,0.04);flex-wrap:wrap;";
  container.appendChild(toolbar);

  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = "flex:1;position:relative;overflow:hidden;";
  container.appendChild(canvasWrap);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;touch-action:none;cursor:crosshair;background:#fff;";
  canvasWrap.appendChild(canvas);

  setContent(hwnd, container);

  let tool: "pen" | "eraser" = "pen";
  let color = "#000000";
  let size = 4;

  const cctx = canvas.getContext("2d")!;

  // backing store so drawings survive window resizes
  let storeWidth = 0;
  let storeHeight = 0;
  const store = document.createElement("canvas");

  function resize() {
    const rect = canvasWrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (w === storeWidth && h === storeHeight) return;
    if (w <= 1 || h <= 1) return;
    const next = document.createElement("canvas");
    next.width = w;
    next.height = h;
    next.getContext("2d")!.drawImage(store, 0, 0);
    store.width = w;
    store.height = h;
    store.getContext("2d")!.drawImage(next, 0, 0);
    storeWidth = w;
    storeHeight = h;
    canvas.width = w;
    canvas.height = h;
    cctx.drawImage(store, 0, 0);
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvasWrap);

  function getPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function strokeTo(x: number, y: number) {
    if (tool === "eraser") {
      cctx.globalCompositeOperation = "destination-out";
      cctx.strokeStyle = "rgba(0,0,0,1)";
      cctx.lineWidth = size * 2.5;
    } else {
      cctx.globalCompositeOperation = "source-over";
      cctx.strokeStyle = color;
      cctx.lineWidth = size;
    }
    cctx.lineCap = "round";
    cctx.lineJoin = "round";
    cctx.beginPath();
    cctx.moveTo(lastX, lastY);
    cctx.lineTo(x, y);
    cctx.stroke();
    cctx.globalCompositeOperation = "source-over";
    lastX = x;
    lastY = y;
  }

  function dotAt(x: number, y: number) {
    if (tool === "eraser") {
      cctx.globalCompositeOperation = "destination-out";
      cctx.fillStyle = "rgba(0,0,0,1)";
      cctx.beginPath();
      cctx.arc(x, y, size * 1.25, 0, Math.PI * 2);
      cctx.fill();
      cctx.globalCompositeOperation = "source-over";
    } else {
      cctx.globalCompositeOperation = "source-over";
      cctx.fillStyle = color;
      cctx.beginPath();
      cctx.arc(x, y, size / 2, 0, Math.PI * 2);
      cctx.fill();
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    const p = getPos(e);
    lastX = p.x;
    lastY = p.y;
    dotAt(p.x, p.y);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = getPos(e);
    strokeTo(p.x, p.y);
  });

  const endStroke = () => {
    drawing = false;
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  // ---- toolbar ----
  const btnBase =
    "padding:3px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.7);";

  const penBtn = document.createElement("button");
  penBtn.textContent = "Pen";
  penBtn.style.cssText = btnBase;
  penBtn.style.background = "rgba(0,100,200,0.15)";
  penBtn.style.border = "1px solid rgba(0,100,200,0.5)";
  penBtn.addEventListener("click", () => {
    tool = "pen";
    penBtn.style.background = "rgba(0,100,200,0.15)";
    penBtn.style.border = "1px solid rgba(0,100,200,0.5)";
    eraserBtn.style.background = "rgba(255,255,255,0.7)";
    eraserBtn.style.border = "1px solid rgba(0,0,0,0.2)";
  });
  toolbar.appendChild(penBtn);

  const eraserBtn = document.createElement("button");
  eraserBtn.textContent = "Eraser";
  eraserBtn.style.cssText = btnBase;
  eraserBtn.addEventListener("click", () => {
    tool = "eraser";
    eraserBtn.style.background = "rgba(0,100,200,0.15)";
    eraserBtn.style.border = "1px solid rgba(0,100,200,0.5)";
    penBtn.style.background = "rgba(255,255,255,0.7)";
    penBtn.style.border = "1px solid rgba(0,0,0,0.2)";
  });
  toolbar.appendChild(eraserBtn);

  const sizeLabel = document.createElement("span");
  sizeLabel.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);";
  sizeLabel.textContent = "Size:";
  toolbar.appendChild(sizeLabel);

  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = "1";
  sizeInput.max = "50";
  sizeInput.value = String(size);
  sizeInput.style.cssText = "width:90px;cursor:pointer;";
  sizeInput.addEventListener("input", () => {
    size = Number(sizeInput.value);
  });
  toolbar.appendChild(sizeInput);

  const sizeValue = document.createElement("span");
  sizeValue.style.cssText = "font-size:11px;min-width:18px;color:rgba(0,0,0,0.6);";
  sizeValue.textContent = String(size);
  toolbar.appendChild(sizeValue);
  sizeInput.addEventListener("input", () => {
    sizeValue.textContent = sizeInput.value;
  });

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  clearBtn.style.cssText = btnBase;
  clearBtn.style.marginLeft = "auto";
  clearBtn.addEventListener("click", () => {
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    store.getContext("2d")!.clearRect(0, 0, store.width, store.height);
  });
  toolbar.appendChild(clearBtn);

  const swatches = document.createElement("div");
  swatches.style.cssText = "display:flex;gap:3px;align-items:center;";
  toolbar.appendChild(swatches);

  for (const c of PALETTE) {
    const sw = document.createElement("button");
    sw.style.cssText = `width:18px;height:18px;border-radius:50%;cursor:pointer;border:1px solid rgba(0,0,0,0.25);background:${c};padding:0;`;
    if (c === color) sw.style.border = "2px solid rgba(0,100,200,0.9)";
    sw.addEventListener("click", () => {
      color = c;
      swatches.querySelectorAll("button").forEach((el) => {
        el.style.border = "1px solid rgba(0,0,0,0.25)";
      });
      sw.style.border = "2px solid rgba(0,100,200,0.9)";
    });
    swatches.appendChild(sw);
  }
}
