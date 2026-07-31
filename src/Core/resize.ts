// port of https://github.com/KasimAhmic/web-aero/blob/main/src/attributes/resizable.ts

interface Component {
  container: HTMLElement;
}

type ResizeHandleLocation =
  | "top"
  | "left"
  | "right"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

type ResizeHandleOptions = Record<ResizeHandleLocation, boolean>;

export class Resizable {
  private readonly component: Component;

  private readonly resizeTargetSize = 5;

  constructor(component: Component, locations: ResizeHandleOptions) {
    this.component = component;

    this.createResizeHandles(locations);
  }

  private createResizeHandles(locations: ResizeHandleOptions) {
    for (const location in locations) {
      if (locations[location as ResizeHandleLocation]) {
        const handle = this.createResizeHandle(
          location as ResizeHandleLocation,
        );

        handle.addEventListener("pointerdown", (event) =>
          this.handleResize(event, location as ResizeHandleLocation),
        );

        this.component.container.appendChild(handle);
      }
    }
  }

  private createResizeHandle(direction: ResizeHandleLocation): HTMLDivElement {
    const resizeHandle = document.createElement("div");
    resizeHandle.classList.add("resize-handle", `resize-handle-${direction}`);
    resizeHandle.draggable = false;

    resizeHandle.style.position = "absolute";
    resizeHandle.style.cursor = `${direction}-resize`;

    resizeHandle.style.width = this.position(
      direction,
      `calc(100% - ${this.resizeTargetSize * 2}px)`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      `calc(100% - ${this.resizeTargetSize * 2}px)`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
    );
    resizeHandle.style.height = this.position(
      direction,
      `${this.resizeTargetSize}px`,
      `calc(100% - ${this.resizeTargetSize * 2}px)`,
      `calc(100% - ${this.resizeTargetSize * 2}px)`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
    );
    resizeHandle.style.top = this.position(
      direction,
      "0",
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      "unset",
      "0",
      "0",
      "unset",
      "unset",
    );
    resizeHandle.style.left = this.position(
      direction,
      `${this.resizeTargetSize}px`,
      "0",
      `calc(100% - ${this.resizeTargetSize}px)`,
      `${this.resizeTargetSize}px`,
      "0",
      "unset",
      "0",
      "unset",
    );
    resizeHandle.style.right = this.position(
      direction,
      `calc(100% - ${this.resizeTargetSize}px)`,
      "0",
      "0",
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      "0",
      `${this.resizeTargetSize}px`,
      "0",
    );
    resizeHandle.style.bottom = this.position(
      direction,
      `calc(100% - ${this.resizeTargetSize}px)`,
      `${this.resizeTargetSize}px`,
      `${this.resizeTargetSize}px`,
      "0",
      "0",
      "0",
      "0",
      "0",
    );
    resizeHandle.style.cursor = this.position(
      direction,
      "ns-resize",
      "ew-resize",
      "ew-resize",
      "ns-resize",
      "nwse-resize",
      "nesw-resize",
      "nesw-resize",
      "nwse-resize",
    );

    return resizeHandle;
  }

  private position(
    direction: ResizeHandleLocation,
    top: string,
    left: string,
    right: string,
    bottom: string,
    topLeft: string,
    topRight: string,
    bottomLeft: string,
    bottomRight: string,
  ) {
    switch (direction) {
      case "top":
        return top;
      case "left":
        return left;
      case "right":
        return right;
      case "bottom":
        return bottom;
      case "topLeft":
        return topLeft;
      case "topRight":
        return topRight;
      case "bottomLeft":
        return bottomLeft;
      case "bottomRight":
        return bottomRight;
    }
  }

  private handleResize(event: PointerEvent, location: ResizeHandleLocation) {
    event.preventDefault();
    const el = this.component.container;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const initialX = event.clientX;
    const initialY = event.clientY;
    const initialLeft = el.offsetLeft;
    const initialTop = el.offsetTop;
    const initialWidth = el.offsetWidth;
    const initialHeight = el.offsetHeight;
    const minW = parseFloat(getComputedStyle(el).minWidth) || 0;
    const minH = parseFloat(getComputedStyle(el).minHeight) || 0;

    const pointerMoveCallback = (event: PointerEvent) => {
      const deltaX = event.clientX - initialX;
      const deltaY = event.clientY - initialY;
      let clampedW: number, clampedH: number;

      switch (location) {
        case "top":
          clampedH = Math.max(minH, initialHeight - deltaY);
          el.style.top = (initialTop + initialHeight - clampedH) + "px";
          el.style.height = clampedH + "px";
          break;
        case "left":
          clampedW = Math.max(minW, initialWidth - deltaX);
          el.style.left = (initialLeft + initialWidth - clampedW) + "px";
          el.style.width = clampedW + "px";
          break;
        case "right":
          clampedW = Math.max(minW, initialWidth + deltaX);
          el.style.width = clampedW + "px";
          break;
        case "bottom":
          clampedH = Math.max(minH, initialHeight + deltaY);
          el.style.height = clampedH + "px";
          break;
        case "topLeft":
          clampedW = Math.max(minW, initialWidth - deltaX);
          clampedH = Math.max(minH, initialHeight - deltaY);
          el.style.left = (initialLeft + initialWidth - clampedW) + "px";
          el.style.top = (initialTop + initialHeight - clampedH) + "px";
          el.style.width = clampedW + "px";
          el.style.height = clampedH + "px";
          break;
        case "topRight":
          clampedW = Math.max(minW, initialWidth + deltaX);
          clampedH = Math.max(minH, initialHeight - deltaY);
          el.style.top = (initialTop + initialHeight - clampedH) + "px";
          el.style.width = clampedW + "px";
          el.style.height = clampedH + "px";
          break;
        case "bottomLeft":
          clampedW = Math.max(minW, initialWidth - deltaX);
          clampedH = Math.max(minH, initialHeight + deltaY);
          el.style.left = (initialLeft + initialWidth - clampedW) + "px";
          el.style.width = clampedW + "px";
          el.style.height = clampedH + "px";
          break;
        case "bottomRight":
          clampedW = Math.max(minW, initialWidth + deltaX);
          clampedH = Math.max(minH, initialHeight + deltaY);
          el.style.width = clampedW + "px";
          el.style.height = clampedH + "px";
          break;
      }
    };

    const pointerUpCallback = (e: PointerEvent) => {
      if (handle.hasPointerCapture(e.pointerId)) {
        handle.releasePointerCapture(e.pointerId);
      }
      handle.removeEventListener("pointermove", pointerMoveCallback);
      handle.removeEventListener("pointerup", pointerUpCallback);
      handle.removeEventListener("pointercancel", pointerUpCallback);
    };

    handle.addEventListener("pointermove", pointerMoveCallback);
    handle.addEventListener("pointerup", pointerUpCallback);
    handle.addEventListener("pointercancel", pointerUpCallback);
  }

  private setWidth(width: number) {
    this.component.container.style.width = `${Math.max(0, width)}px`;
  }

  private setHeight(height: number) {
    this.component.container.style.height = `${Math.max(0, height)}px`;
  }

  private setTop(top: number) {
    this.component.container.style.top = `${top}px`;
  }

  private setLeft(left: number) {
    this.component.container.style.left = `${left}px`;
  }
}
