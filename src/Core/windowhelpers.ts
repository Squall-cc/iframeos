import type { JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { ulid } from "ulid";

import { clearWindowCanvas } from "./overlay";

// todo: debug window dragging resizing bottom right
interface WindowData {
  hwnd: symbol;
  title: string;
  z: number; // z index
  minimized: boolean;
  content?: JSX.Element;
}
let mx = 0;
let my = 0;

if (typeof window !== "undefined") {
  window.addEventListener("mousemove", (asdasdasdcfsfgsad) => {
    mx = asdasdasdcfsfgsad.clientX;
    my = asdasdasdcfsfgsad.clientY;
  });
}
let topZ = 9;
export let windowsmap = new Map<symbol, string>([]);
let domMap = new Map<symbol, HTMLDivElement>();

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol essentially just uncollidable uuid-like
const [windows, setWindows] = createStore<WindowData[]>([]);

export { windows };
export type { WindowData };
export function closeWindow(hwnd: symbol) {
  setWindows(windows.filter((w) => w.hwnd !== hwnd));
  windowsmap.delete(hwnd);
  domMap.delete(hwnd);
  clearWindowCanvas(hwnd);
}

export function registerWindowElement(hwnd: symbol, el: HTMLDivElement) {
  domMap.set(hwnd, el);
}

export function getCurrentMousePosition() {
  return { x: mx, y: my };
}

export function getMousePositionRelativeToWindow(hwnd: symbol) {
  const mouse = getCurrentMousePosition();
  const dims = getDimensions(hwnd);
  const windowp = getPosition(hwnd);

  if (!dims || !windowp) return undefined; // safety

  return {
    x: mouse.x - windowp.x,
    y: mouse.y - windowp.y,
    globalX: mouse.x,
    globalY: mouse.y,
  };
}
export function getDimensions(hwnd: symbol) {
  let el = domMap.get(hwnd);
  if (!el) return undefined;
  return { width: el.offsetWidth, height: el.offsetHeight };
}

export function getDimensionsByHWnd(hwnd: string) {
  let sym = getSymbolByHWnd(hwnd);
  if (!sym) return undefined;
  return getDimensions(sym);
}

export function setDimensions(
  hwnd: symbol,
  dimensions: { width: number; height: number },
) {
  let el = domMap.get(hwnd);
  if (!el) return;
  el.style.width = dimensions.width + "px";
  el.style.height = dimensions.height + "px";
}

export function setDimensionsByHWnd(
  hwnd: string,
  dimensions: { width: number; height: number },
) {
  let sym = getSymbolByHWnd(hwnd);
  if (sym) setDimensions(sym, dimensions);
}

export function getPosition(hwnd: symbol) {
  let win = domMap.get(hwnd);
  if (!win) return undefined;
  return { x: win.offsetLeft, y: win.offsetTop };
}

export function setPosition(hwnd: symbol, pos: { x: number; y: number }) {
  let win = domMap.get(hwnd);
  if (!win) return;
  win.style.left = pos.x + "px";
  win.style.top = pos.y + "px";
}

export function setCenter(hwnd: symbol, center: { x: number; y: number }) {
  let dim = getDimensions(hwnd);
  if (!dim) return;
  setPosition(hwnd, {
    x: center.x - dim.width / 2,
    y: center.y - dim.height / 2,
  });
}

export function getCorners(hwnd: symbol) {
  let pos = getPosition(hwnd);
  let dim = getDimensions(hwnd);
  if (!pos || !dim) return undefined;
  return {
    topLeft: { x: pos.x, y: pos.y },
    topRight: { x: pos.x + dim.width, y: pos.y },
    bottomLeft: { x: pos.x, y: pos.y + dim.height },
    bottomRight: { x: pos.x + dim.width, y: pos.y + dim.height },
  };
}
export const bringupwards = (hwnd: symbol) =>
  setWindows((w) => w.hwnd === hwnd, { z: ++topZ, minimized: false });
export const minimize = (hwnd: symbol) =>
  setWindows((w) => w.hwnd === hwnd, "minimized", true);
export function spawn(title: string = "window", run?: (hwnd: symbol) => void) {
  var s = Symbol();
  setWindows(windows.length, {
    hwnd: s,
    title: title,
    z: ++topZ,
    minimized: false,
  });
  windowsmap.set(s, ulid());
  run?.(s);
}

export const debug123 = () =>
  setInterval(
    () => console.log("windows :" + windows + "; body:" + document.body),
    1000,
  );

export function getSymbolByHWnd(hwnd: string) {
  let s = [...windowsmap];
  let y = s.find(([, u]) => u === hwnd);
  return y?.[0];
}

export function getTitleByHWnd(hwnd: string) {
  let sym = getSymbolByHWnd(hwnd);
  if (!sym) return undefined;
  return windows.find((w) => w.hwnd === sym)?.title;
}

export function setContent(hwnd: symbol, content: JSX.Element) {
  setWindows((w) => w.hwnd === hwnd, "content", content);
}

export function setContentByHWnd(hwnd: string, content: JSX.Element) {
  let sym = getSymbolByHWnd(hwnd);
  if (sym) setContent(sym, content);
}

export function getContentByHWnd(hwnd: string) {
  let sym = getSymbolByHWnd(hwnd);
  if (!sym) return undefined;
  return windows.find((w) => w.hwnd === sym)?.content;
}
