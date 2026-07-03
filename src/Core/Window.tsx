import "./Window.css";
import "7.css/dist/gui/window.css";
import type { ParentComponent } from "solid-js";
import { createSignal, onMount } from "solid-js";

import { Resizable } from "./resize";
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

  onMount(() => {
    windowthingy.style.left =
      (window.innerWidth - windowthingy.offsetWidth) / 2 + "px";
    windowthingy.style.top =
      (window.innerHeight - windowthingy.offsetHeight) / 2 + "px";
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
};

export default Window;
