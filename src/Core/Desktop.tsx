import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";

import { For, Show, createSignal, onCleanup, onMount, type Component } from "solid-js";

import { getAppIconUrl } from "../Apis/appIcon";
import {
  copyHostFileToDesktop,
  isAppShortcut,
  isFileShortcut,
  moveToDesktop,
  onDesktopChanged,
  syncDesktopFiles,
  updateShortcutPosition,
  VFS_DRAG_MIME,
  type DesktopShortcut,
} from "../Apis/DesktopApi";
import { FileSystemAccess } from "../Apis/FileSystemApi";
import { launchAppEntry, shellOpenWithPicker, shellModal } from "../Apis/iSApi";

const ICON_W = 72;

const Desktop: Component = () => {
  const [icons, setIcons] = createSignal<DesktopShortcut[]>([]);
  const [ready, setReady] = createSignal(false);

  const reload = async () => {
    setIcons(await syncDesktopFiles());
    setReady(true);
  };

  onMount(() => {
    void reload();
    onCleanup(onDesktopChanged(() => void reload()));
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const internalPath = e.dataTransfer?.getData(VFS_DRAG_MIME);
    if (internalPath) {
      void moveToDesktop(internalPath);
      return;
    }
    const files = e.dataTransfer?.files;
    if (files) {
      for (const f of Array.from(files)) void copyHostFileToDesktop(f);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
  }

  return (
    <div id="desktop" onDragOver={onDragOver} onDrop={onDrop}>
      <Show when={ready()}>
        <For each={icons()}>
          {(shortcut) => (
            <DesktopShortcut
              shortcut={shortcut}
              onMove={(x, y) => void updateShortcutPosition(shortcut, x, y)}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

function DesktopShortcut(props: {
  shortcut: DesktopShortcut;
  onMove: (x: number, y: number) => void;
}) {
  const [img, setImg] = createSignal<string | undefined>(undefined);
  let el!: HTMLDivElement;

  onMount(async () => {
    if (isAppShortcut(props.shortcut)) {
      setImg(await getAppIconUrl(props.shortcut.app, undefined));
    }
  });

  let dragging = false;
  let moved = false;
  let sx = 0;
  let sy = 0;
  let ox = 0;
  let oy = 0;

  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = false;
    moved = false;
    sx = e.clientX;
    sy = e.clientY;
    ox = props.shortcut.x;
    oy = props.shortcut.y;
    el.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!el.hasPointerCapture(e.pointerId)) return;
    if (!dragging && (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3)) {
      dragging = true;
    }
    if (dragging) {
      moved = true;
      const maxX = Math.max(0, el.offsetParent!.clientWidth - ICON_W);
      const maxY = Math.max(0, el.offsetParent!.clientHeight - el.offsetHeight);
      el.style.left = `${Math.min(Math.max(0, ox + (e.clientX - sx)), maxX)}px`;
      el.style.top = `${Math.min(Math.max(0, oy + (e.clientY - sy)), maxY)}px`;
    }
  }

  function onUp(e: PointerEvent) {
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (dragging) {
      const maxX = Math.max(0, el.offsetParent!.clientWidth - ICON_W);
      const maxY = Math.max(0, el.offsetParent!.clientHeight - el.offsetHeight);
      const x = Math.min(Math.max(0, Math.round(ox + (e.clientX - sx))), maxX);
      const y = Math.min(Math.max(0, Math.round(oy + (e.clientY - sy))), maxY);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      props.onMove(x, y);
    }
  }

  async function onOpen() {
    if (moved) return;
    if (isAppShortcut(props.shortcut)) {
      void launchAppEntry(props.shortcut.app, "run");
      return;
    }
    const fs = new FileSystemAccess();
    const name = props.shortcut.file.split("/").filter(Boolean).pop() || props.shortcut.file;
    if (fs.isDirectory(props.shortcut.file)) {
      const { openFolder } = await import("../SysApps/file-explorer");
      openFolder(props.shortcut.file);
      return;
    }
    const ok = await shellOpenWithPicker(props.shortcut.file);
    if (!ok) {
      shellModal(
        "error",
        undefined,
        "Cannot Open File",
        `No app could open "${name}". Try registering a file association first.`,
      );
    }
  }

  const isFolder = isFileShortcut(props.shortcut) && new FileSystemAccess().isDirectory(props.shortcut.file);
  const displayName = isFileShortcut(props.shortcut)
    ? props.shortcut.file.split("/").filter(Boolean).pop() || props.shortcut.file
    : props.shortcut.name;

  return (
    <div
      class="desktop-shortcut"
      ref={el}
      style={{ left: `${props.shortcut.x}px`, top: `${props.shortcut.y}px` }}
      title={displayName}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDblClick={onOpen}
    >
      <Show
        when={img()}
        fallback={
          <i
            class={isFolder ? "fa-solid fa-folder" : "fa-solid fa-file"}
            style={{ "font-size": "36px", "line-height": "40px", color: "rgba(255,255,255,0.9)", "text-shadow": "0 1px 2px rgba(0,0,0,0.9)" }}
          />
        }
      >
        <img src={img()} alt="" draggable={false} />
      </Show>
      <span>{displayName}</span>
    </div>
  );
}

export default Desktop;
