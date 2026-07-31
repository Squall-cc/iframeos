import "./Window.css";
import "7.css/dist/gui/window.css";
import type { ParentComponent } from "solid-js";
import { createEffect, onMount } from "solid-js";

import { Resizable } from "./resize";
import {
  registerWindowElement,
  savePreMaximizeState,
  getPreMaximizeState,
  deletePreMaximizeState,
} from "./windowhelpers";

interface WindowProps {
  hwnd: symbol;
  title: string;
  zIndex: number;
  maximized: boolean;
  minWidth?: number;
  minHeight?: number;
  active: boolean;
  onclose?: () => void; // react style names are dumb, all my homies adore html
  onminimize?: () => void;
  onmaximize?: () => void;
  onfocus?: () => void;
}

const Window: ParentComponent<WindowProps> = (props) => {
  let offsetX = 0;
  let offsetY = 0;
  let isMaxDrag = false;
  // @ts-ignore
  let windowthingy!: HTMLDivElement; // eslint-disable-line no-unassigned-vars

  onMount(() => {
    const ow = windowthingy.offsetWidth;
    const oh = windowthingy.offsetHeight;
    windowthingy.style.left =
      (window.innerWidth - ow) / 2 + "px";
    windowthingy.style.top =
      (window.innerHeight - oh) / 2 + "px";
    if (!windowthingy.style.width || windowthingy.style.width === "auto") windowthingy.style.width = ow + "px";
    if (!windowthingy.style.height || windowthingy.style.height === "auto") windowthingy.style.height = oh + "px";
    registerWindowElement(props.hwnd, windowthingy);
    new Resizable(
      { container: windowthingy },
      {
        top: true,
        left: true,
        right: true,
        bottom: true,
        topLeft: true,
        topRight: true,
        bottomLeft: true,
        bottomRight: true,
      },
    );
  });

  createEffect(() => {
    const el = windowthingy;
    if (props.maximized) {
      savePreMaximizeState(props.hwnd, {
        left: el.style.left,
        top: el.style.top,
        width: el.style.width || el.offsetWidth + "px",
        height: el.style.height || el.offsetHeight + "px",
      });
      el.style.left = "0";
      el.style.top = "0";
      el.style.width = "100%";
      el.style.height = "calc(100vh - var(--panel-size))";
      el.classList.add("maximized");
    } else {
      const saved = getPreMaximizeState(props.hwnd);
      if (saved) {
        el.style.left = saved.left;
        el.style.top = saved.top;
        el.style.width = saved.width;
        el.style.height = saved.height;
        deletePreMaximizeState(props.hwnd);
      }
      el.classList.remove("maximized");
    }
  });

  createEffect(() => {
    const el = windowthingy;
    if (props.active) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });

  function startDrag(e: PointerEvent) {
    if ((e.target as HTMLElement).closest("#windowcontrols")) return;
    props.onfocus?.();
    const rect = windowthingy.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    isMaxDrag = props.maximized;
    document.body.style.userSelect = "none";
    windowthingy.setPointerCapture(e.pointerId);
    windowthingy.addEventListener("pointermove", move);
    windowthingy.addEventListener("pointerup", up);
    windowthingy.addEventListener("pointercancel", up);
  }

  function unmaximizeAndDrag(e: PointerEvent) {
    isMaxDrag = false;
    props.onmaximize?.();
    const saved = getPreMaximizeState(props.hwnd);
    if (saved) {
      const w = parseFloat(saved.width) || 600;
      const h = parseFloat(saved.height) || 400;
      let left = e.clientX - offsetX;
      let top = e.clientY - offsetY;
      left = Math.max(0, Math.min(left, window.innerWidth - Math.min(w, window.innerWidth)));
      top = Math.max(0, Math.min(top, window.innerHeight - Math.min(h, window.innerHeight)));
      windowthingy.style.left = left + "px";
      windowthingy.style.top = top + "px";
      windowthingy.style.width = w + "px";
      windowthingy.style.height = h + "px";
      deletePreMaximizeState(props.hwnd);
    }
    windowthingy.classList.remove("maximized");
    offsetX = e.clientX - windowthingy.offsetLeft;
    offsetY = e.clientY - windowthingy.offsetTop;
  }

  return (
    <>
      <div
        id="window"
        class="window glass active"
        ref={windowthingy}
        style={{
          "z-index": props.zIndex,
          "min-width": props.minWidth ? props.minWidth + "px" : undefined,
          "min-height": props.minHeight ? props.minHeight + "px" : undefined,
        }}
      >
        <div
          class="title-bar"
          onPointerDown={startDrag}
          onDblClick={() => props.onmaximize?.()}
        >
          <div class="title-bar-text">{props.title}</div>
          <div id="windowcontrols" class="title-bar-controls">
            <button
              aria-label="Minimize"
              onClick={() => props.onminimize?.()}
            ></button>
            <button
              aria-label={props.maximized ? "Restore" : "Maximize"}
              onClick={() => props.onmaximize?.()}
            ></button>
            <button
              aria-label="Close"
              onClick={() => props.onclose?.()}
            ></button>
          </div>
        </div>
        <div class="window-body has-space">{props.children}</div>
      </div>
    </>
  );
  function move(e: PointerEvent) {
    if (isMaxDrag) {
      const dx = e.clientX - (windowthingy.offsetLeft + offsetX);
      const dy = e.clientY - (windowthingy.offsetTop + offsetY);
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        unmaximizeAndDrag(e);
      }
      return;
    }
    const maxTop = Math.max(0, window.innerHeight - windowthingy.offsetHeight);
    const maxLeft = Math.max(0, window.innerWidth - windowthingy.offsetWidth);
    windowthingy.style.top =
      Math.min(Math.max(0, e.clientY - offsetY), maxTop) + "px";
    windowthingy.style.left =
      Math.min(Math.max(0, e.clientX - offsetX), maxLeft) + "px";
  }

  function up(e?: PointerEvent) {
    if (e && windowthingy.hasPointerCapture(e.pointerId)) {
      windowthingy.releasePointerCapture(e.pointerId);
    }
    windowthingy.removeEventListener("pointermove", move);
    windowthingy.removeEventListener("pointerup", up);
    windowthingy.removeEventListener("pointercancel", up);
    document.body.style.userSelect = "";
    isMaxDrag = false;
  }
};

export default Window;
