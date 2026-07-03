import "./Window.css";
import "7.css/dist/gui/window.css";
import type { ParentComponent } from "solid-js";
import { createSignal, onMount } from "solid-js";

import { registerWindowElement } from "./windowhelpers";

interface WindowProps {
  hwnd: symbol;
  title: string;
  zIndex: number;
  onclose?: () => void; // react style names are dumb, all my homies adore html
  onminimize?: () => void;
  onfocus?: () => void;
}

const Window: ParentComponent<WindowProps> = (props) => {
  const [offsetX, setoffsetX] = createSignal(0);
  const [offsetY, setoffsetY] = createSignal(0);
  // @ts-ignore
  let windowthingy!: HTMLDivElement; // eslint-disable-line no-unassigned-vars

  let rszisestartX = 0;
  let rszisestarty = 0;
  let startwidth = 0;
  let startheight = 0;

  onMount(() => {
    windowthingy.style.left =
      (window.innerWidth - windowthingy.offsetWidth) / 2 + "px";
    windowthingy.style.top =
      (window.innerHeight - windowthingy.offsetHeight) / 2 + "px";
    registerWindowElement(props.hwnd, windowthingy);
  });

  return (
    <>
      <div
        id="window"
        class="window glass active"
        ref={windowthingy}
        style={{ "z-index": props.zIndex }}
      >
        <div
          class="title-bar"

          onMouseDown={(e) => {
            props.onfocus?.();
            setoffsetX(e.clientX - windowthingy.offsetLeft);
            setoffsetY(e.clientY - windowthingy.offsetTop);
            document.body.style.userSelect = "none";
            document.addEventListener("mouseup", up);
            document.addEventListener("mousemove", move);
            //windowthingy.style.left = (e.clientX-offsetX())+"px";
            //windowthingy.style.top = (e.clientY-offsetY())+"px";
          }}
        >
          <div class="title-bar-text">{props.title}</div>
          <div id="windowcontrols" class="title-bar-controls">
            <button
              aria-label="Minimize"
              onClick={() => props.onminimize?.()}
            ></button>
            <button
              aria-label="Close"
              onClick={() => props.onclose?.()}
            ></button>
          </div>
        </div>
        <div class="window-body has-space">{props.children}</div>
        <div
          id="resizehandle"
          onMouseDown={(e) => {
            rszisestartX = e.clientX;
            rszisestarty = e.clientY;
            startwidth = windowthingy.offsetWidth;
            startheight = windowthingy.offsetHeight;
            document.body.style.userSelect = "none";
            document.addEventListener("mouseup", resizeUp);
            document.addEventListener("mousemove", resize);
          }}
        />
      </div>
    </>
  );
  function move(asdasdasdcfsfgsad: MouseEvent) {
    const max2 = window.innerWidth - windowthingy.offsetWidth;
    const max1 = window.innerHeight - windowthingy.offsetHeight;
    windowthingy.style.top =
      Math.min(max1, Math.max(0, asdasdasdcfsfgsad.clientY - offsetY())) + "px";
    windowthingy.style.left =
      Math.min(max2, Math.max(0, asdasdasdcfsfgsad.clientX - offsetX())) + "px";
  }

  function up() {
    document.removeEventListener("mouseup", up);
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", move);
  }

  function resize(e: MouseEvent) {
    const deltaX = e.clientX - rszisestartX;
    const deltaY = e.clientY - rszisestarty;

    const newWidth = Math.max(100, startwidth + deltaX);
    const newHeight = Math.max(100, startheight + deltaY);

    windowthingy.style.width = newWidth + "px";
    windowthingy.style.height = newHeight + "px";

    // keep window within bounds
    const maxLeft = window.innerWidth - newWidth;
    const maxTop = window.innerHeight - newHeight;

    if (windowthingy.offsetLeft > maxLeft) {
      windowthingy.style.left = Math.max(0, maxLeft) + "px";
    }
    if (windowthingy.offsetTop > maxTop) {
      windowthingy.style.top = Math.max(0, maxTop) + "px";
    }
  }

  function resizeUp() {
    document.removeEventListener("mouseup", resizeUp);
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", resize);
  }
};

export default Window;
