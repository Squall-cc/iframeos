import type { JSX } from "solid-js";

import { drawToWindow } from "../Core/overlay";
import {
  windows,
  closeWindow,
  minimize,
  toggleMaximize,
  bringupwards,
  setContent,
  setMinSize,
  getDimensions,
  setDimensions,
  getPosition,
  setPosition,
  setCenter,
  getCorners,
  getSymbolByHWnd,
  getMousePositionRelativeToWindow,
  getCurrentMousePosition,
  spawn as spawnWindow,
} from "../Core/windowhelpers";
import { editFile } from "../SysApps/editor";

import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";

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

  maximize() {
    toggleMaximize(this.hwnd);
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

  setMinSize(minWidth?: number, minHeight?: number) {
    setMinSize(this.hwnd, minWidth, minHeight);
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

export { spawnWindow as spawn };

export const APPS_REG_PREFIX = "InternalSystem/Apps";
export const CLASSES_ROOT_PREFIX = "InternalSystem/ClassesRoot";
const APP_INDEX_PATH = "InternalSystem/AppIndex";

export interface ShellOpenResult {
  handled: boolean;
  saved?: boolean;
  appKey?: string;
  entry?: string;
}

export async function shellOpen(filename: string): Promise<ShellOpenResult> {
  const reg = new RegistryInstanceAccess();

  const extIdx = filename.lastIndexOf(".");
  if (extIdx === -1) return { handled: false };
  const ext = filename.slice(extIdx).toLowerCase();

  const assocRecord = await reg._load(`${CLASSES_ROOT_PREFIX}/${ext}`);
  if (!assocRecord) return { handled: false };

  const assoc = assocRecord.values as Record<string, string>;
  const appKey = assoc["app"];
  const entryFn = assoc["entry"];
  if (!appKey || !entryFn) return { handled: false };

  const ok = await launchAppEntry(appKey, entryFn, filename);
  return { handled: ok, appKey, entry: entryFn };
}

export async function shellOpenWithPicker(filename: string): Promise<boolean> {
  const result = await shellOpen(filename);
  if (result.handled) return true;

  const extIdx = filename.lastIndexOf(".");
  const ext = extIdx !== -1 ? filename.slice(extIdx).toLowerCase() : "";

  const selected = await showAppPicker(
    `Open "${filename.split("/").pop()}" with:`,
    ext,
  );
  if (!selected) return false;

  return launchAppEntry(selected.appKey, selected.entry, filename);
}

function showAppPicker(
  title: string,
  ext: string,
): Promise<{ appKey: string; entry: string } | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:1000000;";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background:#fff;border-radius:4px;padding:16px;min-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Segoe UI,sans-serif;font-size:12px;max-height:80vh;display:flex;flex-direction:column;";

    const titleEl = document.createElement("div");
    titleEl.style.cssText = "font-weight:600;margin-bottom:8px;";
    titleEl.textContent = title;
    dialog.appendChild(titleEl);

    const list = document.createElement("div");
    list.style.cssText = "flex:1;overflow-y:auto;margin-bottom:8px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

    function cancel() { overlay.remove(); resolve(null); }

    (async () => {
      try {
        const reg = new RegistryInstanceAccess();
        const indexRecord = await reg._load(APP_INDEX_PATH);
        const allApps = (indexRecord?.values["list"] as Array<{ key: string; name: string }>) ?? [];

        const builtinApps = [
          { key: "hi", name: "hi" },
          { key: "hello", name: "hello" },
          { key: "draw", name: "draw" },
          { key: "launch", name: "launch" },
          { key: "browser", name: "browser" },
          { key: "editor", name: "Text Editor" },
          { key: "registry-editor", name: "Registry Editor" },
          { key: "app-installer", name: "App Installer" },
          { key: "file-explorer", name: "File Explorer" },
          { key: "test-app", name: "Test App" },
        ];

        const allEntries = [...builtinApps];
        for (const spa of allApps) {
          if (!allEntries.some((a) => a.key === spa.key)) {
            allEntries.push({ key: spa.key, name: spa.name });
          }
        }

        if (allEntries.length === 0) {
          const empty = document.createElement("div");
          empty.style.cssText = "padding:12px;text-align:center;color:rgba(0,0,0,0.4);font-size:11px;";
          empty.textContent = "No apps available";
          list.appendChild(empty);
        } else {
          for (const app of allEntries) {
            const item = document.createElement("div");
            item.style.cssText = "padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.05);font-size:11px;";
            item.textContent = app.name;
            item.addEventListener("mouseenter", () => { item.style.background = "rgba(0,0,0,0.06)"; });
            item.addEventListener("mouseleave", () => { item.style.background = ""; });
            item.addEventListener("click", async () => {
              try {
                const entry = prompt("Enter entry point function name:", "run");
                if (!entry) return;
                const save = confirm("Save this association for future use?");
                if (save && ext) {
                  await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", app.key);
                  await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", entry);
                }
                overlay.remove();
                resolve({ appKey: app.key, entry });
              } catch (err) {
                console.error("showAppPicker click:", err);
              }
            });
            list.appendChild(item);
          }
        }

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.style.cssText = "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;align-self:flex-end;";
        cancelBtn.addEventListener("click", cancel);

        dialog.appendChild(list);
        dialog.appendChild(cancelBtn);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
      } catch (e) {
        console.error("showAppPicker:", e);
        cancel();
      }
    })();
  });
}

export async function shellSelectFile(
  options?: { title?: string; filter?: { label: string; extensions: string[] } },
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:1000000;";

    const dialog = document.createElement("div");
    dialog.style.cssText = "background:#fff;border-radius:4px;padding:16px;min-width:480px;min-height:350px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Segoe UI,sans-serif;font-size:12px;display:flex;flex-direction:column;";

    const titleEl = document.createElement("div");
    titleEl.style.cssText = "font-weight:600;margin-bottom:8px;";
    titleEl.textContent = options?.title ?? "Select a file";
    dialog.appendChild(titleEl);

    const navBar = document.createElement("div");
    navBar.style.cssText = "display:flex;gap:4px;margin-bottom:6px;align-items:center;";

    const pathDisplay = document.createElement("span");
    pathDisplay.style.cssText = "flex:1;font-size:11px;padding:2px 4px;background:rgba(0,0,0,0.04);border-radius:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    navBar.appendChild(pathDisplay);

    dialog.appendChild(navBar);

    const fileList = document.createElement("div");
    fileList.style.cssText = "flex:1;overflow-y:auto;border:1px solid rgba(0,0,0,0.1);border-radius:2px;margin-bottom:8px;";
    dialog.appendChild(fileList);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;gap:8px;align-items:center;margin-bottom:8px;";

    const filterSelect = document.createElement("select");
    filterSelect.style.cssText = "flex:1;padding:3px 4px;font-size:11px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;";

    const allFilter = document.createElement("option");
    allFilter.value = "*";
    allFilter.textContent = "All Files (*.*)";
    filterSelect.appendChild(allFilter);

    if (options?.filter) {
      const opt = document.createElement("option");
      opt.value = options.filter.extensions.join(",");
      opt.textContent = `${options.filter.label} (${options.filter.extensions.join(", ")})`;
      filterSelect.appendChild(opt);
    }
    filterRow.appendChild(filterSelect);

    const okBtn = document.createElement("button");
    okBtn.textContent = "Open";
    okBtn.style.cssText = "padding:4px 16px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;font-size:11px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;";
    cancelBtn.addEventListener("click", () => { overlay.remove(); resolve(null); });

    btnRow.appendChild(filterRow);
    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let currentPath = "/";
    let selectedFile: string | null = null;
    const fs = new FileSystemAccess();

    function normalizePath(p: string): string {
      const parts = p.split("/").filter(Boolean);
      const stack: string[] = [];
      for (const part of parts) {
        if (part === ".") continue;
        if (part === "..") { stack.pop(); continue; }
        stack.push(part);
      }
      return "/" + stack.join("/");
    }

    function matchesFilter(name: string): boolean {
      const val = filterSelect.value;
      if (val === "*") return true;
      const exts = val.split(",");
      return exts.some((e) => name.toLowerCase().endsWith(e.trim().toLowerCase()));
    }

    function renderDir(path: string) {
      currentPath = normalizePath(path);
      pathDisplay.textContent = currentPath;
      fileList.innerHTML = "";
      selectedFile = null;
      okBtn.style.opacity = "0.5";

      const entries = fs.listDirectory(currentPath).filter((p) => p !== currentPath);
      const sorted = entries.sort((a, b) => {
        const aIsDir = fs.isDirectory(a);
        const bIsDir = fs.isDirectory(b);
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });

      if (currentPath !== "/") {
        const upRow = document.createElement("div");
        upRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;font-size:11px;";
        upRow.innerHTML = '<span style="font-size:14px;">📁</span><span>..</span>';
        upRow.addEventListener("click", () => renderDir(currentPath.split("/").slice(0, -1).join("/") || "/"));
        upRow.addEventListener("mouseenter", () => { upRow.style.background = "rgba(0,0,0,0.06)"; });
        upRow.addEventListener("mouseleave", () => { upRow.style.background = ""; });
        fileList.appendChild(upRow);
      }

      for (const entry of sorted) {
        const isDir = fs.isDirectory(entry);
        const name = entry.split("/").filter(Boolean).pop() || entry;
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;font-size:11px;";

        const icon = document.createElement("span");
        icon.style.cssText = "font-size:14px;flex-shrink:0;";
        icon.textContent = isDir ? "📁" : "📄";
        row.appendChild(icon);

        const label = document.createElement("span");
        label.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        label.textContent = name;
        row.appendChild(label);

        row.addEventListener("click", () => {
          document.querySelectorAll("#sel-file-list > div").forEach((el) => (el as HTMLElement).style.background = "");
          if (!isDir && matchesFilter(name)) {
            selectedFile = entry;
            okBtn.style.opacity = "1";
            row.style.background = "rgba(0,100,200,0.2)";
          }
        });
        row.addEventListener("dblclick", () => {
          if (isDir) renderDir(entry);
        });
        row.addEventListener("mouseenter", () => {
          if (selectedFile !== entry) row.style.background = "rgba(0,0,0,0.06)";
        });
        row.addEventListener("mouseleave", () => {
          if (selectedFile !== entry) row.style.background = "";
        });

        fileList.appendChild(row);
      }

      fileList.id = "sel-file-list";
    }

    filterSelect.addEventListener("change", () => renderDir(currentPath));

    okBtn.addEventListener("click", () => {
      if (selectedFile) {
        overlay.remove();
        resolve(selectedFile);
      }
    });

    renderDir("/");
  });
}

async function launchAppEntry(appKey: string, entryFn: string, filename?: string): Promise<boolean> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return false;

  const manifest = record.values["manifest"] as { type?: string; hasFileOpener?: boolean } | undefined;
  const appType = manifest?.type || "spa";

  if (appType === "builtin") {
    const builtinRunners: Record<string, (_f?: string) => void> = {
      editor: (f) => { if (f) editFile(f); },
      hi: () => { import("../SysApps/hi").then((m) => spawnWindow("hi", m.default)); },
      hello: () => { import("../SysApps/hello").then((m) => spawnWindow("hello", m.default)); },
      draw: () => { import("../SysApps/draw").then((m) => spawnWindow("draw", m.default)); },
      launch: () => { import("../SysApps/launch").then((m) => spawnWindow("launch", m.default)); },
      browser: () => { import("../SysApps/browser").then((m) => spawnWindow("browser", m.default)); },
      "registry-editor": () => { import("../SysApps/registry-editor").then((m) => spawnWindow("Registry Editor", m.default)); },
      "app-installer": () => { import("../SysApps/app-installer").then((m) => spawnWindow("App Installer", m.default)); },
      "file-explorer": () => { import("../SysApps/file-explorer").then((m) => spawnWindow("File Explorer", m.default)); },
      "test-app": () => { import("../SysApps/test-app").then((m) => spawnWindow("Test App", m.default)); },
    };

    const runner = builtinRunners[appKey];
    if (runner) {
      if (entryFn === "editFile" && filename) {
        runner(filename);
        return true;
      }
      if (entryFn === "run" || entryFn === "openFile") {
        if (filename && manifest?.hasFileOpener) {
          runner(filename);
        } else {
          runner();
        }
        return true;
      }
    }
    return false;
  }

  const fs = new FileSystemAccess();
  const appDir = `/iSi/apps/${appKey}`;
  const codePath = `${appDir}/entry.js`;

  if (!fs.exists(codePath)) return false;
  const handle = fs.openFile(codePath);
  const code = await handle.read();
  if (!code) return false;

  try {
    const exports: Record<string, unknown> = {};
    const fn = new Function("exports", code);
    fn(exports);
    const entryFnImpl = exports[entryFn] as Function;
    if (typeof entryFnImpl !== "function") return false;

    if (filename) {
      spawnWindow(filename, (h) => {
        entryFnImpl(filename, h);
      });
    } else {
      spawnWindow(appKey, (h) => {
        entryFnImpl(h);
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function launchSpaApp(appKey: string): Promise<boolean> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return false;
  const manifest = record.values["manifest"] as { entryPoint?: string } | undefined;
  const entryFn = manifest?.entryPoint || "run";
  return launchAppEntry(appKey, entryFn);
}

export async function getAllInstalledApps() {
  const reg = new RegistryInstanceAccess();

  const indexRecord = await reg._load(APP_INDEX_PATH);
  if (!indexRecord) return [];

  const list = indexRecord.values["list"] as Array<{ key: string; name: string; version: string; description: string }> | undefined;
  return list ?? [];
}

export async function registerClassRoot(ext: string, appKey: string, entry: string): Promise<void> {
  const reg = new RegistryInstanceAccess();
  await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", appKey);
  await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", entry);
}
