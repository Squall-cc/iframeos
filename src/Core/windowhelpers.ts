import type { JSX } from "solid-js";
import { createStore } from "solid-js/store";
import { ulid } from "ulid";

import { DEFAULT_APP_ICON } from "../Apis/appIcon";
import { clearWindowCanvas } from "./overlay";

// todo: debug window dragging resizing bottom right
interface WindowData {
  hwnd: symbol;
  title: string;
  z: number; // z index
  minimized: boolean;
  maximized: boolean;
  content?: JSX.Element;
  minWidth?: number;
  minHeight?: number;
  icon?: string;
  modal?: boolean; // true when this window is a modal dialog
  parent?: symbol; // the window that summoned a modal
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

const closeHandlers = new Map<symbol, () => void>();

export function closeWindow(hwnd: symbol) {
  const win = windows.find((w) => w.hwnd === hwnd);
  const handler = closeHandlers.get(hwnd);
  closeHandlers.delete(hwnd);
  setWindows(windows.filter((w) => w.hwnd !== hwnd));
  windowsmap.delete(hwnd);
  domMap.delete(hwnd);
  clearWindowCanvas(hwnd);
  handler?.();
  if (win?.modal && win.parent) {
    bringupwards(win.parent);
  }
}

// registers a callback that fires when a window is closed, before the caller
// of closeWindow gets control back. used by modal dialogs so the promise they
// resolve isn't left hanging when the user dismisses the window with the X.
export function onWindowClose(hwnd: symbol, fn: () => void) {
  closeHandlers.set(hwnd, fn);
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

// a modal window, once open, swallows focus for every other window. the
// summoner can't be interacted with until the modal is cleared.
export function anyModalOpen(): boolean {
  return windows.some((w) => w.modal);
}

export function getOpenModal(): symbol | undefined {
  let modal: symbol | undefined;
  for (const w of windows) {
    if (w.modal && (!modal || w.z > (windows.find((x) => x.hwnd === modal)?.z ?? -1))) {
      modal = w.hwnd;
    }
  }
  return modal;
}

export const bringupwards = (hwnd: symbol) => {
  if (anyModalOpen() && getOpenModal() !== hwnd) return;
  setWindows((w) => w.hwnd === hwnd, { z: ++topZ, minimized: false });
};
export const minimize = (hwnd: symbol) => {
  const w = windows.find((win) => win.hwnd === hwnd);
  if (w?.modal) return;
  setWindows((w) => w.hwnd === hwnd, "minimized", true);
};

const preMaximizeState = new Map<symbol, { left: string; top: string; width: string; height: string }>();

export function savePreMaximizeState(hwnd: symbol, state: { left: string; top: string; width: string; height: string }) {
  if (!preMaximizeState.has(hwnd)) {
    preMaximizeState.set(hwnd, state);
  }
}

export function getPreMaximizeState(hwnd: symbol) {
  return preMaximizeState.get(hwnd);
}

export function deletePreMaximizeState(hwnd: symbol) {
  preMaximizeState.delete(hwnd);
}

export const toggleMaximize = (hwnd: symbol) => {
  const w = windows.find((win) => win.hwnd === hwnd);
  if (!w || w.modal) return;
  setWindows((win) => win.hwnd === hwnd, "maximized", !w.maximized);
};
export function spawn(title: string = "window", run?: (hwnd: symbol) => void) {
  var s = Symbol();
  setWindows(windows.length, {
    hwnd: s,
    title: title,
    z: ++topZ,
    minimized: false,
    maximized: false,
    icon: DEFAULT_APP_ICON,
  });
  windowsmap.set(s, ulid());
  run?.(s);
  return s;
}

// opens a modal dialog window parented to `parent` (if given). the rest of the
// shell is blocked from interaction until it is closed.
export function spawnModal(
  title: string,
  parent?: symbol,
  run?: (hwnd: symbol) => void,
) {
  var s = Symbol();
  setWindows(windows.length, {
    hwnd: s,
    title: title,
    z: ++topZ,
    minimized: false,
    maximized: false,
    icon: DEFAULT_APP_ICON,
    modal: true,
    parent,
  });
  windowsmap.set(s, ulid());
  run?.(s);
  return s;
}

export function setMinSize(hwnd: symbol, minWidth?: number, minHeight?: number) {
  const patch: Partial<WindowData> = {};
  if (minWidth !== undefined) patch.minWidth = minWidth;
  if (minHeight !== undefined) patch.minHeight = minHeight;
  setWindows((w) => w.hwnd === hwnd, patch);
}

export function setTitle(hwnd: symbol, title: string) {
  setWindows((w) => w.hwnd === hwnd, "title", title);
}

export function setWindowIcon(hwnd: symbol, icon: string) {
  setWindows((w) => w.hwnd === hwnd, "icon", icon);
}

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
