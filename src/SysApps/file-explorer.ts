import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";

import { FileSystemAccess } from "../Apis/FileSystemApi";
import { shellAsk, shellModal, shellOpenWith, shellOpenWithPicker, shellSelectDir } from "../Apis/iSApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

let currentPath = "/";
let selected: string | null = null;

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
  setMinSize(hwnd, 550, 400);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:4px;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,0.15);background:rgba(0,0,0,0.04);align-items:center;flex-wrap:wrap;";

  const upBtn = document.createElement("button");
  upBtn.textContent = "Up";
  upBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  upBtn.addEventListener("click", () => {
    const parts = currentPath.split("/").filter(Boolean);
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
  refreshBtn.addEventListener("click", () => navigateTo(currentPath));
  toolbar.appendChild(refreshBtn);

  const newFileBtn = document.createElement("button");
  newFileBtn.textContent = "New File";
  newFileBtn.style.cssText = "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  newFileBtn.addEventListener("click", () => {
    shellAsk(
      [{ type: "text", name: "filename", label: "File name:", required: true }],
      "New File",
      `Create a new file in "${currentPath}"`,
      { buttons: "okcancel" },
    ).then((result) => {
      if (result.button !== "ok" || !result.values.filename?.trim()) return;
      const fs = new FileSystemAccess();
      fs.createFile(normalizePath(`${currentPath}/${result.values.filename.trim()}`));
      navigateTo(currentPath);
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
      `Create a new folder in "${currentPath}"`,
      { buttons: "okcancel" },
    ).then((result) => {
      if (result.button !== "ok" || !result.values.dirname?.trim()) return;
      const fs = new FileSystemAccess();
      fs.createDirectory(normalizePath(`${currentPath}/${result.values.dirname.trim()}`));
      navigateTo(currentPath);
    });
  });
  toolbar.appendChild(newFolderBtn);

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
    shellModal(
      "yesno",
      hwnd,
      "Confirm Delete",
      isDir
        ? `Delete the folder "${name}" and everything inside it?`
        : `Delete the file "${name}"?`,
    ).then((result) => {
      if (result !== "yes") return;
      if (isDir) fs.deleteDirectoryRecursive(target);
      else fs.deleteFile(target);
      selected = null;
      navigateTo(currentPath);
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

  const quickItems = ["/", "/documents", "/downloads", "/pictures", "/iSi", "/iSi/apps"];

  function renderSidebar() {
    const existing = sidebar.querySelectorAll(".quick-item");
    existing.forEach((el) => el.remove());

    for (const item of quickItems) {
      const el = document.createElement("div");
      el.className = "quick-item";
      el.style.cssText = "padding:4px 8px;cursor:pointer;font-size:11px;";
      el.style.background = item === currentPath ? "rgba(0,100,200,0.15)" : "";
      el.textContent = item === "/" ? "Root" : item;
      el.addEventListener("click", () => navigateTo(item));
      el.addEventListener("mouseenter", () => {
        if (item !== currentPath) el.style.background = "rgba(0,0,0,0.06)";
      });
      el.addEventListener("mouseleave", () => {
        if (item !== currentPath) el.style.background = "";
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

  async function moveDirectory(src: string, destDir: string, fsi: FileSystemAccess) {
    const name = src.split("/").filter(Boolean).pop() || src;
    const dest = normalizePath(`${destDir}/${name}`);
    fsi.createDirectory(dest);
    for (const child of fsi.listDirectory(src).filter((p) => p !== src)) {
      if (fsi.isDirectory(child)) {
        await moveDirectory(child, dest, fsi);
      } else {
        const childName = child.split("/").filter(Boolean).pop() || child;
        const target = normalizePath(`${dest}/${childName}`);
        const blob = await fsi.data.read(child);
        fsi.createFile(target);
        if (blob) {
          await fsi.data.write(target, blob);
          fsi.updateFileMeta(target, blob);
        }
        fsi.deleteFile(child);
      }
    }
    fsi.deleteDirectory(src);
  }

  function showContextMenu(x: number, y: number, target: string) {
    document.querySelector(".fe-context-menu")?.remove();

    const fs = new FileSystemAccess();
    const isDir = fs.isDirectory(target);
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

    if (isDir) {
      addItem("Open", () => navigateTo(target));
    } else {
      addItem("Open", () => {
        shellOpenWithPicker(target).then((ok) => {
          if (!ok) {
            shellModal("error", hwnd, "Cannot Open File", `No app could open "${name}". Try registering a file association first.`);
            statusBar.textContent = `No app could open "${name}"`;
          }
        });
      });
      addItem("Open With", () => {
        shellOpenWith(target).then((ok) => {
          if (!ok) statusBar.textContent = "No app selected";
        });
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
        navigateTo(currentPath);
      });
    });
    addItem("Move To", () => {
      shellSelectDir({ title: `Move "${name}" to:` }).then(async (destDir) => {
        if (!destDir) return;
        const fsi = new FileSystemAccess();
        const dest = normalizePath(`${destDir}/${name}`);
        if (dest === target) return;
        if (dest.startsWith(target + "/")) {
          shellModal("error", hwnd, "Cannot Move", `Cannot move "${name}" into itself.`);
          return;
        }
        if (fsi.exists(dest)) {
          shellModal("error", hwnd, "Cannot Move", `"${dest}" already exists.`);
          return;
        }
        if (fsi.isDirectory(target)) {
          await moveDirectory(target, destDir, fsi);
        } else {
          fsi.rename(target, dest);
        }
        selected = null;
        navigateTo(currentPath);
      });
    });
    addSeparator();
    addItem("Delete", () => {
      shellModal(
        "yesno",
        hwnd,
        "Confirm Delete",
        isDir
          ? `Delete the folder "${name}" and everything inside it?`
          : `Delete the file "${name}"?`,
      ).then((result) => {
        if (result !== "yes") return;
        const fsi = new FileSystemAccess();
        if (isDir) fsi.deleteDirectoryRecursive(target);
        else fsi.deleteFile(target);
        selected = null;
        navigateTo(currentPath);
      });
    });

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

  async function navigateTo(path: string) {
    currentPath = normalizePath(path);
    selected = null;
    pathDisplay.textContent = currentPath;
    renderSidebar();

    const fs = new FileSystemAccess();
    fileList.innerHTML = "";

    const entries = fs.listDirectory(currentPath).filter((p) => p !== currentPath);

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
      empty.textContent = "This folder is empty";
      fileList.appendChild(empty);
      statusBar.textContent = "0 items";
      return;
    }

    statusBar.textContent = `${sorted.length} item${sorted.length !== 1 ? "s" : ""}`;

    for (const entry of sorted) {
      const isDir = fs.isDirectory(entry);
      const name = entry.split("/").filter(Boolean).pop() || entry;
      const row = document.createElement("div");
      row.className = "fe-row";
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border-radius:2px;";
      row.style.cursor = isDir ? "pointer" : "default";

      const icon = document.createElement("i");
      icon.className = isDir ? "fa-solid fa-folder" : "fa-solid fa-file";
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

      row.addEventListener("dblclick", async () => {
        if (isDir) {
          navigateTo(entry);
        } else {
          const ok = await shellOpenWithPicker(entry);
          if (!ok) {
            shellModal("error", hwnd, "Cannot Open File", `No app could open "${name}". Try registering a file association first.`);
            statusBar.textContent = `No app could open "${name}"`;
          }
        }
      });

      fileList.appendChild(row);
    }
  }

  navigateTo("/");
}
