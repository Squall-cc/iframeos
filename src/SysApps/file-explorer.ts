import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";

import {
  VFS_DRAG_MIME,
  APP_DRAG_MIME,
  copyVfsFileToDesktop,
  moveToDesktop,
} from "../Apis/DesktopApi";
import {
  FileSystemAccess,
  emitVfsChanged,
  onVfsChanged,
} from "../Apis/FileSystemApi";
import { pickHostFiles } from "../Apis/hostFiles";
import {
  launchAppEntry,
  shellAsk,
  shellModal,
  shellOpenWith,
  shellOpenWithPicker,
  shellSelectDir,
} from "../Apis/iSApi";
import {
  TRASH_DIR,
  createAppShortcutFile,
  createShortcutFile,
  emptyTrash,
  isShortcutFile,
  movePath,
  moveToTrash,
  resolveShortcut,
} from "../Apis/Shortcuts";
import { setContent, setMinSize, spawn } from "../Core/windowhelpers";

function normalizePath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const stack: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") { stack.pop(); continue; }
    stack.push(p);
  }
  return "/" + stack.join("/");
}

export default function run(hwnd: symbol) {
  startExplorer(hwnd);
}

// opens the file explorer in its own window, starting at the given path.
export function openFolder(path: string) {
  spawn("File Explorer", (hwnd) => startExplorer(hwnd, path));
}

function startExplorer(hwnd: symbol, initialPath = "/") {
  setMinSize(hwnd, 550, 400);
  let path = initialPath;
  let selected: string | null = null;

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";
  container.setAttribute("data-explorer-dir", path);

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:4px;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,0.15);background:rgba(0,0,0,0.04);align-items:center;flex-wrap:wrap;";

  const upBtn = document.createElement("button");
  upBtn.textContent = "Up";
  upBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  upBtn.addEventListener("click", () => {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    navigateTo("/" + parts.join("/"));
  });
  toolbar.appendChild(upBtn);

  const pathDisplay = document.createElement("span");
  pathDisplay.style.cssText = "flex:1;font-size:11px;padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  toolbar.appendChild(pathDisplay);

  const refreshBtn = document.createElement("button");
  refreshBtn.textContent = "Refresh";
  refreshBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  refreshBtn.addEventListener("click", () => navigateTo(path));
  toolbar.appendChild(refreshBtn);

  const newFileBtn = document.createElement("button");
  newFileBtn.textContent = "New File";
  newFileBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  newFileBtn.addEventListener("click", () => {
    shellAsk(
      [{ type: "text", name: "filename", label: "File name:", required: true }],
      "New File",
      `Create a new file in "${path}"`,
      { buttons: "okcancel" },
    ).then((result) => {
      if (result.button !== "ok" || !result.values.filename?.trim()) return;
      const fs = new FileSystemAccess();
      fs.createFile(normalizePath(`${path}/${result.values.filename.trim()}`));
      navigateTo(path);
    });
  });
  toolbar.appendChild(newFileBtn);

  const newFolderBtn = document.createElement("button");
  newFolderBtn.textContent = "New Folder";
  newFolderBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  newFolderBtn.addEventListener("click", () => {
    shellAsk(
      [{ type: "text", name: "dirname", label: "Folder name:", required: true }],
      "New Folder",
      `Create a new folder in "${path}"`,
      { buttons: "okcancel" },
    ).then((result) => {
      if (result.button !== "ok" || !result.values.dirname?.trim()) return;
      const fs = new FileSystemAccess();
      fs.createDirectory(normalizePath(`${path}/${result.values.dirname.trim()}`));
      navigateTo(path);
    });
  });
  toolbar.appendChild(newFolderBtn);

  const uploadBtn = document.createElement("button");
  uploadBtn.textContent = "Upload";
  uploadBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  uploadBtn.addEventListener("click", async () => {
    const files = await pickHostFiles({ multiple: true });
    if (!files || files.length === 0) return;
    const fs = new FileSystemAccess();
    for (const file of files) {
      const dest = normalizePath(`${path}/${file.name}`);
      if (!fs.isFile(dest)) fs.createFile(dest);
      await fs.data.write(dest, file);
      fs.updateFileMeta(dest, file);
    }
    statusBar.textContent = `Uploaded ${files.length} file${files.length !== 1 ? "s" : ""} to ${path}`;
    navigateTo(path);
  });
  toolbar.appendChild(uploadBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "Delete";
  deleteBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(200,0,0,0.3);border-radius:2px;background:rgba(200,0,0,0.05);";
  deleteBtn.addEventListener("click", () => {
    if (!selected) {
      shellModal("info", hwnd, "Nothing Selected", "Select a file or folder to delete.");
      return;
    }
    const fs = new FileSystemAccess();
    const target = selected;
    const isDir = fs.isDirectory(target);
    const name = target.split("/").filter(Boolean).pop() || target;
    const inTrash =
      normalizePath(target) === TRASH_DIR ||
      normalizePath(target).startsWith(TRASH_DIR + "/");
    shellModal(
      "yesno",
      hwnd,
      inTrash ? "Delete Permanently" : "Move to Recycle Bin",
      inTrash
        ? `Permanently delete "${name}"? This cannot be undone.`
        : isDir
          ? `Move the folder "${name}" and everything inside it to the Recycle Bin?`
          : `Move the file "${name}" to the Recycle Bin?`,
    ).then(async (result) => {
      if (result !== "yes") return;
      if (inTrash) {
        if (isDir) fs.deleteDirectoryRecursive(target);
        else fs.deleteFile(target);
        emitVfsChanged();
      } else {
        await moveToTrash(target);
      }
      selected = null;
      navigateTo(path);
    });
  });
  toolbar.appendChild(deleteBtn);

  container.appendChild(toolbar);

  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex:1;overflow:hidden;";

  const sidebar = document.createElement("div");
  sidebar.style.cssText = "width:180px;min-width:180px;display:flex;flex-direction:column;background:rgba(0,0,0,0.03);border-right:1px solid rgba(0,0,0,0.15);overflow-y:auto;";

  const sidebarHeader = document.createElement("div");
  sidebarHeader.style.cssText = "padding:4px 8px;font-weight:600;font-size:11px;border-bottom:1px solid rgba(0,0,0,0.15);";
  sidebarHeader.textContent = "Quick Access";
  sidebar.appendChild(sidebarHeader);

  const quickItems = ["/", "/documents", "/downloads", "/pictures", "/iSi", "/iSi/apps", TRASH_DIR];

  function renderSidebar() {
    const existing = sidebar.querySelectorAll(".quick-item");
    existing.forEach((el) => el.remove());

    for (const item of quickItems) {
      const el = document.createElement("div");
      el.className = "quick-item";
      el.style.cssText = "padding:4px 8px;cursor:pointer;font-size:11px;";
      el.style.background = item === path ? "rgba(0,100,200,0.15)" : "";
      el.textContent = item === "/" ? "Root" : item === TRASH_DIR ? "Recycle Bin" : item;
      el.addEventListener("click", () => navigateTo(item));
      el.addEventListener("mouseenter", () => {
        if (item !== path) el.style.background = "rgba(0,0,0,0.06)";
      });
      el.addEventListener("mouseleave", () => {
        if (item !== path) el.style.background = "";
      });
      sidebar.appendChild(el);
    }
  }
  renderSidebar();

  body.appendChild(sidebar);

  const fileList = document.createElement("div");
  fileList.style.cssText = "flex:1;overflow-y:auto;padding:4px;";
  body.appendChild(fileList);

  container.appendChild(body);

  const statusBar = document.createElement("div");
  statusBar.style.cssText = "padding:3px 8px;border-top:1px solid rgba(0,0,0,0.1);font-size:11px;color:rgba(0,0,0,0.5);";
  container.appendChild(statusBar);

  setContent(hwnd, container);

  function handleDrop(e: DragEvent, destDir: string) {
    e.preventDefault();
    e.stopPropagation();
    const src = e.dataTransfer?.getData(VFS_DRAG_MIME);
    if (src) {
      void movePath(src, destDir);
      return;
    }
    const appKey = e.dataTransfer?.getData(APP_DRAG_MIME);
    if (appKey) {
      const name = e.dataTransfer?.getData("text/plain") || appKey;
      void createAppShortcutFile(appKey, name, destDir);
      return;
    }
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const fsi = new FileSystemAccess();
      for (const file of Array.from(files)) {
        const dest = normalizePath(`${destDir}/${file.name}`);
        if (!fsi.isFile(dest)) fsi.createFile(dest);
        void fsi.data.write(dest, file).then(() => fsi.updateFileMeta(dest, file));
      }
      statusBar.textContent = `Uploaded ${files.length} file${files.length !== 1 ? "s" : ""} to ${destDir}`;
      navigateTo(path);
    }
  }

  fileList.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
  });
  fileList.addEventListener("drop", (e) => handleDrop(e, path));

  function showContextMenu(x: number, y: number, target: string) {
    document.querySelector(".fe-context-menu")?.remove();

    const fs = new FileSystemAccess();
    const isDir = fs.isDirectory(target);
    const isShortcut = isShortcutFile(target);
    const inTrash =
      normalizePath(path) === TRASH_DIR ||
      normalizePath(target).startsWith(TRASH_DIR + "/");
    const name = target.split("/").filter(Boolean).pop() || target;

    const menu = document.createElement("div");
    menu.className = "fe-context-menu";
    menu.style.cssText = "position:fixed;z-index:100000;min-width:160px;background:#fff;border:1px solid rgba(0,0,0,0.2);border-radius:3px;box-shadow:0 4px 16px rgba(0,0,0,0.25);padding:4px 0;font-family:Segoe UI,sans-serif;font-size:12px;";

    function addItem(label: string, fn: () => void, disabled = false) {
      const item = document.createElement("div");
      item.style.cssText = disabled
        ? "padding:5px 14px;color:rgba(0,0,0,0.35);cursor:default;"
        : "padding:5px 14px;cursor:pointer;";
      item.textContent = label;
      if (!disabled) {
        item.addEventListener("mouseenter", () => { item.style.background = "rgba(0,100,200,0.15)"; });
        item.addEventListener("mouseleave", () => { item.style.background = ""; });
        item.addEventListener("click", () => { menu.remove(); fn(); });
      }
      menu.appendChild(item);
      return item;
    }

    function addSeparator() {
      const sep = document.createElement("div");
      sep.style.cssText = "height:1px;background:rgba(0,0,0,0.1);margin:3px 0;";
      menu.appendChild(sep);
    }

    function openTarget() {
      void (async () => {
        const resolved = await resolveShortcut(target);
        if (resolved.kind === "app") {
          void launchAppEntry(resolved.target, "run");
          return;
        }
        if (fs.isDirectory(resolved.target)) {
          navigateTo(resolved.target);
          return;
        }
        const ok = await shellOpenWithPicker(resolved.target);
        if (!ok) {
          shellModal("error", hwnd, "Cannot Open File", `No app could open "${resolved.target.split("/").filter(Boolean).pop()}". Try registering a file association first.`);
          statusBar.textContent = `No app could open "${resolved.target.split("/").filter(Boolean).pop()}"`;
        }
      })();
    }

    addItem("Open", openTarget);
    if (!isDir) {
      addItem("Open With", () => {
        void (async () => {
          const resolved = await resolveShortcut(target);
          if (resolved.kind === "app") {
            void launchAppEntry(resolved.target, "run");
            return;
          }
          if (fs.isDirectory(resolved.target)) {
            navigateTo(resolved.target);
            return;
          }
          const ok = await shellOpenWith(resolved.target);
          if (!ok) statusBar.textContent = "No app selected";
        })();
      });
    }
    addSeparator();
    addItem("Rename", () => {
      shellAsk(
        [{ type: "text", name: "newname", label: "New name:", required: true }],
        "Rename",
        `Rename "${name}"`,
        { buttons: "okcancel" },
      ).then((result) => {
        if (result.button !== "ok" || !result.values.newname?.trim()) return;
        const newName = result.values.newname.trim();
        if (newName === name) return;
        const parent = target.split("/").slice(0, -1).join("/") || "/";
        const dest = normalizePath(`${parent}/${newName}`);
        const fsi = new FileSystemAccess();
        if (fsi.exists(dest)) {
          shellModal("error", hwnd, "Cannot Rename", `"${newName}" already exists in this folder.`);
          return;
        }
        fsi.rename(target, dest);
        selected = null;
        navigateTo(path);
      });
    });
    addItem("Create Shortcut", async () => {
      const dest = await createShortcutFile(target, path);
      if (!dest) {
        shellModal("error", hwnd, "Cannot Create Shortcut", `"${name}" could not be found.`);
        return;
      }
      statusBar.textContent = `Created shortcut "${dest.split("/").filter(Boolean).pop()}"`;
      navigateTo(path);
    });
    addItem("Move To", () => {
      shellSelectDir({ title: `Move "${name}" to:` }).then(async (destDir) => {
        if (!destDir) return;
        const dest = normalizePath(`${destDir}/${name}`);
        if (dest === target) return;
        if (dest.startsWith(target + "/")) {
          shellModal("error", hwnd, "Cannot Move", `Cannot move "${name}" into itself.`);
          return;
        }
        const ok = await movePath(target, destDir);
        if (!ok) {
          shellModal("error", hwnd, "Cannot Move", `"${dest}" already exists.`);
          return;
        }
        selected = null;
        navigateTo(path);
      });
    });
    addItem("Move to Desktop", async () => {
      const dest = await moveToDesktop(target);
      if (!dest) {
        shellModal("error", hwnd, "Cannot Move", `"${name}" is already on the desktop.`);
        return;
      }
      selected = null;
      navigateTo(path);
    });
    if (!isDir) {
      addItem("Copy to Desktop", async () => {
        const dest = await copyVfsFileToDesktop(target);
        if (!dest) {
          shellModal("error", hwnd, "Cannot Copy", `"${name}" is already on the desktop.`);
          return;
        }
        navigateTo(path);
      });
    }
    addSeparator();
    addItem("Delete", () => {
      shellModal(
        "yesno",
        hwnd,
        inTrash ? "Delete Permanently" : "Move to Recycle Bin",
        inTrash
          ? `Permanently delete "${name}"? This cannot be undone.`
          : isDir
            ? `Move the folder "${name}" and everything inside it to the Recycle Bin?`
            : `Move the file "${name}" to the Recycle Bin?`,
      ).then(async (result) => {
        if (result !== "yes") return;
        if (inTrash) {
          if (isDir) fs.deleteDirectoryRecursive(target);
          else fs.deleteFile(target);
          emitVfsChanged();
        } else {
          await moveToTrash(target);
        }
        selected = null;
        navigateTo(path);
      });
    });
    if (normalizePath(path) === TRASH_DIR || isShortcut) {
      addSeparator();
      addItem("Empty Recycle Bin", () => {
        const count = emptyTrash();
        statusBar.textContent = `Removed ${count} item${count !== 1 ? "s" : ""} from the Recycle Bin`;
        navigateTo(path);
      });
    }

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

  async function navigateTo(next: string) {
    path = normalizePath(next);
    selected = null;
    container.setAttribute("data-explorer-dir", path);
    pathDisplay.textContent = path;
    renderSidebar();

    const fs = new FileSystemAccess();
    fileList.innerHTML = "";

    const entries = fs.listDirectory(path).filter((p) => p !== path);

    const sorted = entries.sort((a, b) => {
      const aIsDir = fs.isDirectory(a);
      const bIsDir = fs.isDirectory(b);
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    if (sorted.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:24px;color:rgba(0,0,0,0.4);text-align:center;font-size:11px;";
      empty.textContent = path === TRASH_DIR ? "The Recycle Bin is empty" : "This folder is empty";
      fileList.appendChild(empty);
      statusBar.textContent = "0 items";
      return;
    }

    statusBar.textContent = `${sorted.length} item${sorted.length !== 1 ? "s" : ""}`;

    for (const entry of sorted) {
      const isDir = fs.isDirectory(entry);
      const isShortcut = isShortcutFile(entry);
      const name = entry.split("/").filter(Boolean).pop() || entry;
      const row = document.createElement("div");
      row.className = "fe-row";
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border-radius:2px;";
      row.style.cursor = isDir ? "pointer" : "default";

      const icon = document.createElement("i");
      icon.className = isDir
        ? "fa-solid fa-folder"
        : isShortcut
          ? "fa-solid fa-link"
          : "fa-solid fa-file";
      icon.style.cssText = "font-size:13px;flex-shrink:0;width:14px;text-align:center;color:rgba(0,0,0,0.55);";
      row.appendChild(icon);

      const label = document.createElement("span");
      label.style.cssText = "font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;";
      label.textContent = name;
      row.appendChild(label);

      if (!isDir) {
        const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "";
        const typeLabel = document.createElement("span");
        typeLabel.style.cssText = "font-size:10px;color:rgba(0,0,0,0.35);min-width:32px;text-align:right;";
        typeLabel.textContent = ext;
        row.appendChild(typeLabel);
      }

      row.addEventListener("mouseenter", () => {
        if (selected !== entry) row.style.background = "rgba(0,0,0,0.06)";
      });
      row.addEventListener("mouseleave", () => {
        if (selected !== entry) row.style.background = "";
      });

      row.addEventListener("click", () => {
        selected = selected === entry ? null : entry;
        fileList.querySelectorAll(".fe-row").forEach((el) => {
          (el as HTMLElement).style.background = "";
        });
        if (selected === entry) row.style.background = "rgba(0,100,200,0.2)";
      });

      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        selected = entry;
        fileList.querySelectorAll(".fe-row").forEach((el) => {
          (el as HTMLElement).style.background = "";
        });
        row.style.background = "rgba(0,100,200,0.2)";
        showContextMenu(e.clientX, e.clientY, entry);
      });

      row.draggable = true;
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData(VFS_DRAG_MIME, entry);
        e.dataTransfer?.setData("text/plain", entry);
        e.dataTransfer!.effectAllowed = "copyMove";
      });

      if (isDir) {
        row.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer!.dropEffect = "move";
        });
        row.addEventListener("drop", (e) => handleDrop(e, entry));
      }

      row.addEventListener("dblclick", async () => {
        if (isDir) {
          navigateTo(entry);
          return;
        }
        const resolved = await resolveShortcut(entry);
        if (resolved.kind === "app") {
          void launchAppEntry(resolved.target, "run");
          return;
        }
        if (fs.isDirectory(resolved.target)) {
          navigateTo(resolved.target);
          return;
        }
        const ok = await shellOpenWithPicker(resolved.target);
        if (!ok) {
          shellModal("error", hwnd, "Cannot Open File", `No app could open "${resolved.target.split("/").filter(Boolean).pop()}". Try registering a file association first.`);
          statusBar.textContent = `No app could open "${resolved.target.split("/").filter(Boolean).pop()}"`;
        }
      });

      fileList.appendChild(row);
    }
  }

  const stopVfsListener = onVfsChanged(() => {
    if (!container.isConnected) {
      stopVfsListener();
      return;
    }
    navigateTo(path);
  });

  navigateTo(path);
}
