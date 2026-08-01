import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";

import { For, Show, createSignal, onCleanup, onMount, type Component } from "solid-js";

import { getAppIconUrl } from "../Apis/appIcon";
import {
  APP_DRAG_MIME,
  addAppShortcut,
  addFileShortcut,
  arrangeDesktopIcons,
  copyHostFileToDesktop,
  isAppShortcut,
  isFileShortcut,
  moveToDesktop,
  onDesktopChanged,
  removeShortcut,
  syncDesktopFiles,
  updateShortcutPosition,
  VFS_DRAG_MIME,
  type DesktopShortcut,
} from "../Apis/DesktopApi";
import { FileSystemAccess, onVfsChanged } from "../Apis/FileSystemApi";
import { launchAppEntry, shellOpenWith, shellOpenWithPicker, shellModal } from "../Apis/iSApi";
import {
  createAppShortcutFile,
  emptyTrash,
  isShortcutFile,
  movePath,
  moveToTrash,
  resolveShortcut,
  TRASH_DIR,
} from "../Apis/Shortcuts";
import controlPanel from "../SysApps/control-panel";

import { spawn } from "./windowhelpers";


const ICON_W = 72;

const CONTEXT_MENU_STYLE =
  "position:fixed;z-index:100000;min-width:170px;background:#fff;border:1px solid rgba(0,0,0,0.2);border-radius:3px;box-shadow:0 4px 16px rgba(0,0,0,0.25);padding:4px 0;font-family:Segoe UI,sans-serif;font-size:12px;";

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
    onCleanup(onVfsChanged(() => void reload()));
  });

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const appKey = e.dataTransfer?.getData(APP_DRAG_MIME);
    if (appKey) {
      const name = e.dataTransfer?.getData("text/plain") || appKey;
      void addAppShortcut(appKey, name);
      return;
    }
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

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    removeContextMenus();
    showBackgroundMenu(e.clientX, e.clientY);
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest(".desktop-shortcut")) return;
    clearSelection();
  }

  return (
    <div
      id="desktop"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
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

  function commitPosition(e: PointerEvent) {
    const maxX = Math.max(0, el.offsetParent!.clientWidth - ICON_W);
    const maxY = Math.max(0, el.offsetParent!.clientHeight - el.offsetHeight);
    const x = Math.min(Math.max(0, Math.round(ox + (e.clientX - sx))), maxX);
    const y = Math.min(Math.max(0, Math.round(oy + (e.clientY - sy))), maxY);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    props.onMove(x, y);
  }

  function onUp(e: PointerEvent) {
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!dragging) return;

    const drop = findDropTarget(e);
    if (drop) {
      if (drop.kind === "explorer") {
        if (isFileShortcut(props.shortcut)) {
          void movePath(props.shortcut.file, drop.dir);
        } else {
          void createAppShortcutFile(props.shortcut.app, props.shortcut.name, drop.dir);
          commitPosition(e);
        }
        return;
      }
      if (drop.kind === "trash") {
        if (isFileShortcut(props.shortcut)) {
          void moveToTrash(props.shortcut.file);
        } else {
          commitPosition(e);
        }
        return;
      }
      if (drop.kind === "app-shortcut") {
        if (isFileShortcut(props.shortcut)) {
          void openWithDroppedFile(props.shortcut.file);
        } else {
          commitPosition(e);
        }
        return;
      }
      if (drop.kind === "window") {
        if (isFileShortcut(props.shortcut)) {
          void openWithDroppedFile(props.shortcut.file);
        } else {
          commitPosition(e);
        }
        return;
      }
      return;
    }
    commitPosition(e);
  }

  async function openWithDroppedFile(path: string) {
    const resolved = await resolveShortcut(path);
    if (resolved.kind === "app") return;
    void shellOpenWith(resolved.target);
  }

  function findDropTarget(
    e: PointerEvent,
  ):
    | { kind: "explorer"; dir: string }
    | { kind: "app-shortcut"; app: string }
    | { kind: "trash" }
    | { kind: "window" }
    | null {
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const candidate of els) {
      if (candidate === el || el.contains(candidate)) continue;
      if (!(candidate instanceof HTMLElement)) continue;
      const shortcutEl = candidate.closest(".desktop-shortcut");
      if (shortcutEl && shortcutEl !== el) {
        const s = shortcutEl as HTMLElement;
        if (s.dataset.kind === "app") {
          return { kind: "app-shortcut", app: s.dataset.app! };
        }
        if (s.dataset.kind === "file" && s.dataset.file === TRASH_DIR) {
          return { kind: "trash" };
        }
      }
      const explorerEl = candidate.closest("[data-explorer-dir]");
      if (explorerEl) {
        return { kind: "explorer", dir: explorerEl.getAttribute("data-explorer-dir") || "/" };
      }
      const windowEl = candidate.closest(".window");
      if (windowEl) return { kind: "window" };
    }
    return null;
  }

  async function onOpen() {
    if (moved) return;
    if (isAppShortcut(props.shortcut)) {
      void launchAppEntry(props.shortcut.app, "run");
      return;
    }
    const resolved = await resolveShortcut(props.shortcut.file);
    if (resolved.kind === "app") {
      void launchAppEntry(resolved.target, "run");
      return;
    }
    const target = resolved.target;
    const fs = new FileSystemAccess();
    const name = target.split("/").filter(Boolean).pop() || target;
    if (fs.isDirectory(target)) {
      const { openFolder } = await import("../SysApps/file-explorer");
      openFolder(target);
      return;
    }
    const ok = await shellOpenWithPicker(target);
    if (!ok) {
      shellModal(
        "error",
        undefined,
        "Cannot Open File",
        `No app could open "${name}". Try registering a file association first.`,
      );
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    removeContextMenus();
    clearSelection();
    el.classList.add("selected");
    showShortcutMenu(e.clientX, e.clientY, props.shortcut);
  }

  const isFolder =
    isFileShortcut(props.shortcut) &&
    new FileSystemAccess().isDirectory(props.shortcut.file);
  const isTrash =
    isFileShortcut(props.shortcut) && props.shortcut.file === TRASH_DIR;
  const isLink =
    isFileShortcut(props.shortcut) && isShortcutFile(props.shortcut.file);
  const displayName = isTrash
    ? "Recycle Bin"
    : isFileShortcut(props.shortcut)
      ? props.shortcut.file.split("/").filter(Boolean).pop() || props.shortcut.file
      : props.shortcut.name;

  return (
    <div
      class="desktop-shortcut"
      ref={el}
      style={{ left: `${props.shortcut.x}px`, top: `${props.shortcut.y}px` }}
      title={displayName}
      data-kind={isAppShortcut(props.shortcut) ? "app" : "file"}
      data-app={isAppShortcut(props.shortcut) ? props.shortcut.app : undefined}
      data-file={isFileShortcut(props.shortcut) ? props.shortcut.file : undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDblClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <Show
        when={img()}
        fallback={
          <i
            class={
              isTrash
                ? "fa-solid fa-trash-can"
                : isLink
                  ? "fa-solid fa-link"
                  : isFolder
                    ? "fa-solid fa-folder"
                    : "fa-solid fa-file"
            }
            style={{
              "font-size": isTrash ? "38px" : "36px",
              "line-height": "40px",
              color: isTrash
                ? "rgba(220,220,220,0.9)"
                : isFolder
                  ? "rgba(255,211,77,0.95)"
                  : "rgba(255,255,255,0.9)",
              "text-shadow": "0 1px 2px rgba(0,0,0,0.9)",
            }}
          />
        }
      >
        <img src={img()} alt="" draggable={false} />
      </Show>
      <span>{displayName}</span>
    </div>
  );
}

function removeContextMenus() {
  document.querySelectorAll(".desktop-context-menu").forEach((el) => el.remove());
}

function clearSelection() {
  document.querySelectorAll(".desktop-shortcut.selected").forEach((el) => {
    el.classList.remove("selected");
  });
}

function buildContextMenu(
  x: number,
  y: number,
  build: (menu: HTMLDivElement, addItem: (label: string, fn: () => void, disabled?: boolean) => void, addSeparator: () => void) => void,
) {
  removeContextMenus();
  const menu = document.createElement("div");
  menu.className = "desktop-context-menu";
  menu.style.cssText = CONTEXT_MENU_STYLE;

  const addItem = (label: string, fn: () => void, disabled = false) => {
    const item = document.createElement("div");
    item.style.cssText = disabled
      ? "padding:5px 14px;color:rgba(0,0,0,0.35);cursor:default;"
      : "padding:5px 14px;cursor:pointer;";
    item.textContent = label;
    if (!disabled) {
      item.addEventListener("mouseenter", () => {
        item.style.background = "rgba(0,100,200,0.15)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "";
      });
      item.addEventListener("click", () => {
        menu.remove();
        fn();
      });
    }
    menu.appendChild(item);
    return item;
  };

  const addSeparator = () => {
    const sep = document.createElement("div");
    sep.style.cssText = "height:1px;background:rgba(0,0,0,0.1);margin:3px 0;";
    menu.appendChild(sep);
  };

  build(menu, addItem, addSeparator);

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - rect.width - 4) + "px";
  menu.style.top = Math.min(y, window.innerHeight - rect.height - 4) + "px";

  window.setTimeout(() => {
    const close = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) menu.remove();
      window.removeEventListener("mousedown", close);
    };
    window.addEventListener("mousedown", close);
  }, 0);
}

function showShortcutMenu(x: number, y: number, shortcut: DesktopShortcut) {
  const isTrash = isFileShortcut(shortcut) && shortcut.file === TRASH_DIR;
  buildContextMenu(x, y, (menu, addItem, addSeparator) => {
    addItem("Open", () => void openShortcut(shortcut));
    if (isFileShortcut(shortcut)) {
      addItem("Open With", () => void openWithShortcut(shortcut));
    }
    addSeparator();
    addItem("Create Shortcut", () => void duplicateShortcut(shortcut));
    if (isTrash) {
      addItem("Empty Recycle Bin", () => {
        const count = emptyTrash();
        void syncDesktopFiles();
        if (count > 0) {
          shellModal("info", undefined, "Recycle Bin", `Removed ${count} item${count !== 1 ? "s" : ""} from the Recycle Bin.`);
        }
      });
    } else {
      addSeparator();
      addItem("Delete", () => void deleteShortcut(shortcut));
    }
  });
}

function showBackgroundMenu(x: number, y: number) {
  buildContextMenu(x, y, (menu, addItem, addSeparator) => {
    addItem("Control Panel", () => {
      spawn("Control Panel", controlPanel);
    });
    addSeparator();
    addItem("Arrange Icons", () => void arrangeDesktopIcons());
  });
}

async function openShortcut(shortcut: DesktopShortcut) {
  if (isAppShortcut(shortcut)) {
    void launchAppEntry(shortcut.app, "run");
    return;
  }
  const resolved = await resolveShortcut(shortcut.file);
  if (resolved.kind === "app") {
    void launchAppEntry(resolved.target, "run");
    return;
  }
  const target = resolved.target;
  const fs = new FileSystemAccess();
  const name = target.split("/").filter(Boolean).pop() || target;
  if (fs.isDirectory(target)) {
    const { openFolder } = await import("../SysApps/file-explorer");
    openFolder(target);
    return;
  }
  const ok = await shellOpenWithPicker(target);
  if (!ok) {
    shellModal(
      "error",
      undefined,
      "Cannot Open File",
      `No app could open "${name}". Try registering a file association first.`,
    );
  }
}

async function openWithShortcut(shortcut: DesktopShortcut) {
  if (!isFileShortcut(shortcut)) return;
  const resolved = await resolveShortcut(shortcut.file);
  if (resolved.kind === "app") {
    void launchAppEntry(resolved.target, "run");
    return;
  }
  const fs = new FileSystemAccess();
  if (fs.isDirectory(resolved.target)) {
    const { openFolder } = await import("../SysApps/file-explorer");
    openFolder(resolved.target);
    return;
  }
  void shellOpenWith(resolved.target);
}

async function duplicateShortcut(shortcut: DesktopShortcut) {
  if (isAppShortcut(shortcut)) {
    await addAppShortcut(shortcut.app, shortcut.name, undefined, undefined, {
      allowDuplicate: true,
    });
  } else {
    await addFileShortcut(shortcut.file, undefined, undefined, {
      allowDuplicate: true,
    });
  }
}

async function deleteShortcut(shortcut: DesktopShortcut) {
  if (isAppShortcut(shortcut)) {
    await removeShortcut(shortcut);
    return;
  }
  const name = shortcut.file.split("/").filter(Boolean).pop() || shortcut.file;
  const result = await shellModal(
    "yesno",
    undefined,
    "Move to Recycle Bin",
    `Move "${name}" to the Recycle Bin?`,
  );
  if (result !== "yes") return;
  const ok = await moveToTrash(shortcut.file);
  if (!ok) await removeShortcut(shortcut);
}

export default Desktop;
