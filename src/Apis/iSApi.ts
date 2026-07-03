import type { JSX } from "solid-js";

import { drawToWindow } from "../Core/overlay";
import {
  windows,
  closeWindow,
  minimize,
  bringupwards,
  setContent,
  getDimensions,
  setDimensions,
  getPosition,
  setPosition,
  setCenter,
  getCorners,
  getSymbolByHWnd,
  getMousePositionRelativeToWindow,
  getCurrentMousePosition,
  spawn,
} from "../Core/windowhelpers";
export * from "../Core/systems";
export * from "./RegistryApi";
export * from "./FileSystemApi";
export * from "./scramjet";

export class WindowHandle {
  constructor(private hwnd: symbol) {}

  static fromHWnd(hwnd: string): WindowHandle | undefined {
    const sym = getSymbolByHWnd(hwnd);
    return sym ? new WindowHandle(sym) : undefined;
  }

  close() {
    closeWindow(this.hwnd);
  }

  minimize() {
    minimize(this.hwnd);
  }

  bringupwards() {
    bringupwards(this.hwnd);
  }

  getTitle() {
    return windows.find((w) => w.hwnd === this.hwnd)?.title;
  }

  getContent() {
    return windows.find((w) => w.hwnd === this.hwnd)?.content;
  }

  setContent(content: JSX.Element) {
    setContent(this.hwnd, content);
  }

  dimensions() {
    return getDimensions(this.hwnd);
  }

  setDimensions(d: { width: number; height: number }) {
    setDimensions(this.hwnd, d);
  }

  position() {
    return getPosition(this.hwnd);
  }

  getMousePosition() {
    return getCurrentMousePosition();
  }

  getMousePositionRelative() {
    return getMousePositionRelativeToWindow(this.hwnd);
  }

  getMouseInfo() {
    const global = getCurrentMousePosition();
    const relative = getMousePositionRelativeToWindow(this.hwnd);
    return {
      global,
      relative,
    };
  }

  setPosition(pos: { x: number; y: number }) {
    setPosition(this.hwnd, pos);
  }

  setCenter(center: { x: number; y: number }) {
    setCenter(this.hwnd, center);
  }

  corners() {
    return getCorners(this.hwnd);
  }

  draw(fn: (ctx: CanvasRenderingContext2D) => void) {
    drawToWindow(this.hwnd, fn);
  }
}

export { spawn };
