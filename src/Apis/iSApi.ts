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
  setPosition,
  getPosition,
  setCenter,
  getCorners,
  getSymbolByHWnd,
  getMousePositionRelativeToWindow,
  getCurrentMousePosition,
  spawn as spawnWindow,
  spawnModal,
  onWindowClose,
  setWindowIcon,
} from "../Core/windowhelpers";
import { editFile } from "../SysApps/editor";

import { getAppIconUrl } from "./appIcon";
import { FileSystemAccess } from "./FileSystemApi";
import { getRawEntryMethods, launchRawEntry } from "./RawApp";
import { RegistryInstanceAccess } from "./RegistryApi";
import { fullyResolveShortcut, isShortcutFile } from "./Shortcuts";
import { getSpaEntryMethods, launchSpaEntry } from "./SpaApp";

export { installSpaFromZip } from "./SpaApp";
export { installRawApp, installRawAppFromZip } from "./RawApp";

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
  const resolved = await fullyResolveShortcut(filename);
  if (resolved.kind === "app") {
    const ok = await launchAppEntry(resolved.target, "run");
    return { handled: ok, appKey: resolved.target, entry: "run" };
  }
  const target = resolved.target;

  const reg = new RegistryInstanceAccess();

  const extIdx = target.lastIndexOf(".");
  if (extIdx === -1) return { handled: false };
  const ext = target.slice(extIdx).toLowerCase();

  const assocRecord = await reg._load(`${CLASSES_ROOT_PREFIX}/${ext}`);
  if (!assocRecord) return shellOpenWithPickerInternal(target, ext);

  const assoc = assocRecord.values as Record<string, string>;
  const appKey = assoc["app"];
  const entryFn = assoc["entry"];
  if (!appKey || !entryFn) return shellOpenWithPickerInternal(target, ext);

  const ok = await launchAppEntry(appKey, entryFn, target);
  if (ok) return { handled: ok, appKey, entry: entryFn };
  return shellOpenWithPickerInternal(target, ext);
}

async function shellOpenWithPickerInternal(
  filename: string,
  ext: string,
): Promise<ShellOpenResult> {
  const selected = await showAppPicker(
    `Open "${filename.split("/").pop()}" with:`,
    ext,
  );
  if (!selected) return { handled: false };

  const ok = await launchAppEntry(selected.appKey, selected.entry, filename);
  return { handled: ok, appKey: selected.appKey, entry: selected.entry };
}

export async function shellOpenWithPicker(filename: string): Promise<boolean> {
  const result = await shellOpen(filename);
  return result.handled;
}

export async function shellOpenWith(filename: string): Promise<boolean> {
  const resolved = await fullyResolveShortcut(filename);
  if (resolved.kind === "app") {
    return launchAppEntry(resolved.target, "run");
  }
  const target = resolved.target;
  const extIdx = target.lastIndexOf(".");
  const ext = extIdx === -1 ? "" : target.slice(extIdx).toLowerCase();
  const selected = await showAppPicker(
    `Open "${target.split("/").pop()}" with:`,
    ext,
  );
  if (!selected) return false;
  return launchAppEntry(selected.appKey, selected.entry, target);
}

export type ShellModalType = "error" | "info" | "warn" | "yesno" | "abortretrycancel" | "retrycancel";

export type ShellModalResult = "ok" | "abort" | "retry" | "cancel" | "yes" | "no";

const MODAL_BASE_STYLE =
  "box-sizing:border-box;display:flex;flex-direction:column;padding:14px;gap:8px;font-family:Segoe UI,sans-serif;font-size:12px;overflow:auto;";

const MODAL_BUTTON_STYLE =
  "padding:4px 16px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;";

function openModalWindow<T>(
  title: string,
  parent: symbol | undefined,
  build: (dialog: HTMLDivElement, done: (result: T) => void) => void,
  defaultResult: T,
): Promise<T> {
  return new Promise((resolve) => {
    let dialog!: HTMLDivElement;
    let settled = false;
    const settle = (result: T) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const hwnd = spawnModal(title, parent, (hwnd) => {
      dialog = document.createElement("div");
      dialog.style.cssText = MODAL_BASE_STYLE;
      setContent(hwnd, dialog);
      onWindowClose(hwnd, () => settle(defaultResult));
      build(dialog, (result) => {
        settle(result);
        closeWindow(hwnd);
      });
    });
    sizeModalToContent(hwnd, dialog);
  });
}

function sizeModalToContent(hwnd: symbol, dialog: HTMLDivElement): void {
  const deadline = window.performance.now() + 2000;
  const tick = () => {
    const dims = getDimensions(hwnd);
    const body = dialog.parentElement;
    if (dims && body && dialog.offsetWidth > 0) {
      const width =
        Math.max(dialog.offsetWidth, dialog.scrollWidth) +
        (dims.width - body.offsetWidth);
      const height =
        Math.max(dialog.offsetHeight, dialog.scrollHeight) +
        (dims.height - body.offsetHeight);
      setDimensions(hwnd, { width, height });
      return;
    }
    if (window.performance.now() < deadline) {
      window.requestAnimationFrame(tick);
    }
  };
  window.requestAnimationFrame(tick);
}

export function shellModal(
  type: ShellModalType,
  _hwnd: symbol | undefined,
  title: string,
  content: string,
): Promise<ShellModalResult> {
  const parent = typeof _hwnd === "symbol" ? _hwnd : undefined;
  const defaultResult: ShellModalResult =
    type === "yesno"
      ? "no"
      : type === "abortretrycancel" || type === "retrycancel"
        ? "cancel"
        : "ok";

  return openModalWindow<ShellModalResult>(
    title,
    parent,
    (dialog, done) => {
      dialog.style.minWidth = "320px";
      dialog.style.maxWidth = "480px";

      const contentEl = document.createElement("div");
      contentEl.style.cssText =
        "font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word;margin-bottom:8px;";
      contentEl.textContent = content;
      dialog.appendChild(contentEl);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

      const buttons: { label: string; value: ShellModalResult }[] = [];
      switch (type) {
        case "error":
        case "info":
        case "warn":
          buttons.push({ label: "OK", value: "ok" });
          break;
        case "yesno":
          buttons.push({ label: "Yes", value: "yes" });
          buttons.push({ label: "No", value: "no" });
          break;
        case "abortretrycancel":
          buttons.push({ label: "Abort", value: "abort" });
          buttons.push({ label: "Retry", value: "retry" });
          buttons.push({ label: "Cancel", value: "cancel" });
          break;
        case "retrycancel":
          buttons.push({ label: "Retry", value: "retry" });
          buttons.push({ label: "Cancel", value: "cancel" });
          break;
      }

      for (const btn of buttons) {
        const el = document.createElement("button");
        el.textContent = btn.label;
        el.style.cssText = MODAL_BUTTON_STYLE;
        if (btn.value === "ok" || btn.value === "yes" || btn.value === "retry") {
          el.style.border = "1px solid rgba(0,100,200,0.5)";
          el.style.background = "rgba(0,100,200,0.1)";
          el.style.fontWeight = "600";
        }
        el.addEventListener("click", () => done(btn.value));
        btnRow.appendChild(el);
      }

      dialog.appendChild(btnRow);
      btnRow.querySelector("button")?.focus();
    },
    defaultResult,
  );
}

export type ShellAskFieldType =
  | "text"
  | "number"
  | "email"
  | "password"
  | "search"
  | "tel"
  | "url"
  | "date"
  | "time"
  | "datetime-local"
  | "month"
  | "week"
  | "range"
  | "color";

export interface ShellAskField {
  type: ShellAskFieldType;
  name: string;
  label?: string;
  value?: string;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  required?: boolean;
}

export type ShellAskButtons = "ok" | "okcancel";

export interface ShellAskResult {
  button: "ok" | "cancel";
  values: Record<string, string>;
}

export function shellAsk(
  fields: ShellAskField[],
  title: string,
  content?: string,
  options?: { buttons?: ShellAskButtons },
): Promise<ShellAskResult> {
  return openModalWindow<ShellAskResult>(
    title,
    undefined,
    (dialog, done) => {
      dialog.style.minWidth = "340px";
      dialog.style.maxWidth = "480px";

      if (content) {
        const contentEl = document.createElement("div");
        contentEl.style.cssText =
          "font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word;margin-bottom:8px;";
        contentEl.textContent = content;
        dialog.appendChild(contentEl);
      }

      const fieldInputs: Record<string, HTMLInputElement> = {};

      const fieldsEl = document.createElement("div");
      fieldsEl.style.cssText = "display:flex;flex-direction:column;gap:8px;";

      for (const field of fields) {
        const row = document.createElement("label");
        row.style.cssText = "display:flex;flex-direction:column;gap:3px;font-size:11px;";

        const label = document.createElement("span");
        label.textContent = field.label ?? field.name;
        row.appendChild(label);

        const input = document.createElement("input");
        input.type = field.type;
        input.name = field.name;
        if (field.value !== undefined) input.value = field.value;
        if (field.placeholder !== undefined) input.placeholder = field.placeholder;
        if (field.min !== undefined) input.min = String(field.min);
        if (field.max !== undefined) input.max = String(field.max);
        if (field.step !== undefined) input.step = String(field.step);
        if (field.required) input.required = true;
        input.style.cssText = "padding:4px 6px;font-size:12px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;font-family:Segoe UI,sans-serif;";
        row.appendChild(input);
        fieldsEl.appendChild(row);
        fieldInputs[field.name] = input;
      }

      dialog.appendChild(fieldsEl);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:8px;";

      const okBtn = document.createElement("button");
      okBtn.textContent = "OK";
      okBtn.style.cssText = "padding:4px 16px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;font-size:11px;";
      okBtn.addEventListener("click", () => {
        for (const field of fields) {
          if (field.required && !fieldInputs[field.name].value) {
            fieldInputs[field.name].focus();
            return;
          }
        }
        const values: Record<string, string> = {};
        for (const field of fields) {
          values[field.name] = fieldInputs[field.name].value;
        }
        done({ button: "ok", values });
      });
      btnRow.appendChild(okBtn);

      function cancel() {
        done({ button: "cancel", values: {} });
      }

      if ((options?.buttons ?? "ok") === "okcancel") {
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.style.cssText = "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;";
        cancelBtn.addEventListener("click", cancel);
        btnRow.appendChild(cancelBtn);
      }

      dialog.appendChild(btnRow);
      okBtn.focus();

      for (const input of Object.values(fieldInputs)) {
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") okBtn.click();
          if (e.key === "Escape") cancel();
        });
      }

      const first = fields[0] ? fieldInputs[fields[0].name] : undefined;
      first?.focus();
    },
    { button: "cancel", values: {} },
  );
}

function showAppPicker(
  title: string,
  ext: string,
): Promise<{ appKey: string; entry: string } | null> {
  return openModalWindow<{ appKey: string; entry: string } | null>(
    title,
    undefined,
    (dialog, done) => {
      dialog.style.minWidth = "400px";
      dialog.style.maxHeight = "80vh";

      const list = document.createElement("div");
      list.style.cssText = "flex:1;overflow-y:auto;min-height:220px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;margin-bottom:8px;";

      function cancel() { done(null); }

      async function renderAppListView() {
        list.innerHTML = "";
        list.prepend(
          (() => {
            const titleEl = document.createElement("div");
            titleEl.style.cssText = "font-weight:600;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.1);";
            titleEl.textContent = title;
            return titleEl;
          })(),
        );

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
            { key: "app-installer", name: "App Manager" },
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
              item.addEventListener("click", () => renderMethodView(app.key, app.name));
              list.appendChild(item);
            }
          }
        } catch (e) {
          console.error("showAppPicker:", e);
          cancel();
        }
      }

      async function renderMethodView(appKey: string, appName: string) {
        list.innerHTML = "";
        const titleEl = document.createElement("div");
        titleEl.style.cssText = "font-weight:600;padding:6px 8px;border-bottom:1px solid rgba(0,0,0,0.1);";
        titleEl.textContent = `Select entry point for "${appName}"`;
        list.appendChild(titleEl);

        const reg = new RegistryInstanceAccess();

        const backItem = document.createElement("div");
        backItem.style.cssText = "padding:6px 8px;cursor:pointer;font-size:11px;font-weight:600;color:#0078d4;border-bottom:1px solid rgba(0,0,0,0.05);";
        backItem.textContent = "← Back to apps";
        backItem.addEventListener("mouseenter", () => { backItem.style.background = "rgba(0,0,0,0.06)"; });
        backItem.addEventListener("mouseleave", () => { backItem.style.background = ""; });
        backItem.addEventListener("click", renderAppListView);
        list.appendChild(backItem);

        try {
          const methods = await getAppEntryMethods(appKey);

          for (const method of methods) {
            const item = document.createElement("div");
            item.style.cssText = "padding:8px 8px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.05);font-size:11px;";
            item.textContent = method;
            item.addEventListener("mouseenter", () => { item.style.background = "rgba(0,0,0,0.06)"; });
            item.addEventListener("mouseleave", () => { item.style.background = ""; });
            item.addEventListener("click", async () => {
              try {
                if (saveCheck.checked && ext) {
                  await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", appKey);
                  await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", method);
                }
                done({ appKey, entry: method });
              } catch (err) {
                console.error("renderMethodView click:", err);
              }
            });
            list.appendChild(item);
          }
        } catch (e) {
          console.error("showAppPicker methods:", e);
        }
      }

      const rememberSave = document.createElement("label");
      rememberSave.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:8px;cursor:pointer;";
      const saveCheck = document.createElement("input");
      saveCheck.type = "checkbox";
      saveCheck.checked = true;
      rememberSave.appendChild(saveCheck);
      rememberSave.appendChild(document.createTextNode("Save this association for future use"));

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;align-self:flex-end;";
      cancelBtn.addEventListener("click", cancel);

      dialog.appendChild(list);
      dialog.appendChild(rememberSave);
      dialog.appendChild(cancelBtn);

      renderAppListView();
    },
    null,
  );
}

export interface ShellSelectFileOptions {
  title?: string;
  filter?: { label: string; extensions: string[] };
  save?: boolean;
}

export interface ShellSelectDirOptions {
  title?: string;
}

export async function shellSelectFile(
  options?: ShellSelectFileOptions,
): Promise<string | null> {
  return openShellPicker(options ?? {}, false);
}

export async function shellSelectDir(
  options?: ShellSelectDirOptions,
): Promise<string | null> {
  return openShellPicker(options ?? {}, true);
}

async function openShellPicker(
  options: ShellSelectFileOptions,
  directory: boolean,
): Promise<string | null> {
  return openModalWindow<string | null>(
    options?.title ?? (directory ? "Select a folder" : "Select a file"),
    undefined,
    (dialog, done) => {
      dialog.style.minWidth = "580px";
      dialog.style.minHeight = "420px";

      const pathDisplay = document.createElement("div");
      pathDisplay.style.cssText = "font-size:11px;padding:3px 6px;background:rgba(0,0,0,0.04);border-radius:2px;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      dialog.appendChild(pathDisplay);

    const body = document.createElement("div");
    body.style.cssText = "display:flex;flex:1;overflow:hidden;gap:6px;margin-bottom:8px;";

    const sidebar = document.createElement("div");
    sidebar.style.cssText = "width:180px;min-width:180px;display:flex;flex-direction:column;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.1);border-radius:2px;overflow-y:auto;";

    const sidebarHeader = document.createElement("div");
    sidebarHeader.style.cssText = "padding:3px 6px;font-weight:600;font-size:11px;border-bottom:1px solid rgba(0,0,0,0.1);";
    sidebarHeader.textContent = "Folders";
    sidebar.appendChild(sidebarHeader);

    const treeContainer = document.createElement("div");
    treeContainer.style.cssText = "flex:1;overflow-y:auto;";
    sidebar.appendChild(treeContainer);

    body.appendChild(sidebar);

    const rightPanel = document.createElement("div");
    rightPanel.style.cssText = "flex:1;display:flex;flex-direction:column;overflow:hidden;";

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;gap:4px;align-items:center;margin-bottom:4px;";

    const filterSelect = document.createElement("select");
    filterSelect.style.cssText = "flex:1;padding:2px 4px;font-size:11px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;";
    if (directory) filterSelect.style.display = "none";

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

    const upBtn = document.createElement("button");
    upBtn.textContent = "Up";
    upBtn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
    filterRow.appendChild(upBtn);

    rightPanel.appendChild(filterRow);

    const fileList = document.createElement("div");
    fileList.style.cssText = "flex:1;overflow-y:auto;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";
    fileList.id = "sel-file-list";
    rightPanel.appendChild(fileList);

    body.appendChild(rightPanel);
    dialog.appendChild(body);

    const bottomRow = document.createElement("div");
    bottomRow.style.cssText = "display:flex;gap:8px;align-items:center;";

    const fileNameLabel = document.createElement("span");
    fileNameLabel.style.cssText = "font-size:11px;white-space:nowrap;";
    fileNameLabel.textContent = directory ? "Folder:" : "File name:";
    bottomRow.appendChild(fileNameLabel);

    const fileNameInput = document.createElement("input");
    fileNameInput.type = "text";
    fileNameInput.style.cssText = "flex:1;padding:3px 6px;font-size:12px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;font-family:Segoe UI,sans-serif;";
    bottomRow.appendChild(fileNameInput);

    const okBtn = document.createElement("button");
    okBtn.textContent = directory ? "Select" : options?.save ? "Save" : "Open";
    okBtn.style.cssText = "padding:4px 16px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;font-size:11px;";
    bottomRow.appendChild(okBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;";
    cancelBtn.addEventListener("click", () => done(null));
    bottomRow.appendChild(cancelBtn);

    dialog.appendChild(bottomRow);

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
      if (directory) return true;
      const val = filterSelect.value;
      if (val === "*") return true;
      const exts = val.split(",");
      return exts.some((e) => name.toLowerCase().endsWith(e.trim().toLowerCase()));
    }

    function buildDirectoryTree() {
      treeContainer.innerHTML = "";
      const topDirs = fs.listDirectory("/").filter((p) => p !== "/" && fs.isDirectory(p)).sort();
      const roots = [{ name: "/", path: "/" as string | null }, ...topDirs.map((p) => ({ name: p.split("/").filter(Boolean).pop() || "", path: p }))];
      for (const entry of roots) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:3px;padding:2px 4px;cursor:pointer;font-size:11px;";
        row.style.background = (entry.path === currentPath || (!entry.path && currentPath === "/")) ? "rgba(0,100,200,0.2)" : "";
        row.textContent = entry.name;
        row.addEventListener("click", () => renderDir(entry.path || "/"));
        row.addEventListener("mouseenter", () => { if (row.style.background.includes("rgba(0,100,200")) return; row.style.background = "rgba(0,0,0,0.06)"; });
        row.addEventListener("mouseleave", () => { if (row.style.background.includes("rgba(0,100,200")) return; row.style.background = ""; });
        treeContainer.appendChild(row);
      }
    }

    function renderDir(path: string) {
      currentPath = normalizePath(path);
      pathDisplay.textContent = currentPath;
      fileList.innerHTML = "";
      selectedFile = null;
      fileNameInput.value = "";

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
        upRow.innerHTML = '<i class="fa-solid fa-folder" style="font-size:13px;color:#e8b339;"></i><span>..</span>'; //dave stop getting jetbrains ai to make css for you, we use fontawesome here, not emojis
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

        const icon = document.createElement("i");
        icon.style.cssText = `font-size:13px;flex-shrink:0;color:${isDir ? "#e8b339" : "#7a7a7a"};`;
        icon.className = isDir ? "fa-solid fa-folder" : "fa-solid fa-file";
        row.appendChild(icon);

        const label = document.createElement("span");
        label.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
        label.textContent = name;
        row.appendChild(label);

        row.addEventListener("click", () => {
          document.querySelectorAll("#sel-file-list > div").forEach((el) => (el as HTMLElement).style.background = "");
          if (directory) {
            if (isDir) {
              selectedFile = entry;
              fileNameInput.value = name;
              row.style.background = "rgba(0,100,200,0.2)";
            } else if (isShortcutFile(entry)) {
              void (async () => {
                const resolved = await fullyResolveShortcut(entry);
                if (resolved.kind === "file" && fs.isDirectory(resolved.target)) {
                  selectedFile = entry;
                  fileNameInput.value = displayPickerName(entry);
                  row.style.background = "rgba(0,100,200,0.2)";
                }
              })();
            }
          } else {
            if (!isDir && matchesFilter(name)) {
              selectedFile = entry;
              fileNameInput.value = name;
              row.style.background = "rgba(0,100,200,0.2)";
            }
            if (isDir) {
              row.style.background = "rgba(0,100,200,0.2)";
            }
          }
        });
        row.addEventListener("dblclick", () => {
          if (isDir) renderDir(entry);
        });
        row.addEventListener("mouseenter", () => {
          if (row.style.background.includes("rgba(0,100,200")) return;
          row.style.background = "rgba(0,0,0,0.06)";
        });
        row.addEventListener("mouseleave", () => {
          if (row.style.background.includes("rgba(0,100,200")) return;
          row.style.background = "";
        });

        fileList.appendChild(row);
      }
      buildDirectoryTree();
    }

    function displayPickerName(path: string): string {
      let n = path.split("/").filter(Boolean).pop() || path;
      if (n.toLowerCase().endsWith(".lnk")) n = n.slice(0, -4);
      return n || path;
    }

    async function getSelectedPath(): Promise<string | null> {
      let fullPath: string;
      if (selectedFile) {
        fullPath = selectedFile;
      } else {
        const name = fileNameInput.value.trim();
        if (!name) {
          if (options?.save) {
            shellModal("info", Symbol(), "No Filename", "Please enter a filename.");
          }
          return null;
        }
        fullPath = currentPath === "/" ? "/" + name : currentPath + "/" + name;
      }
      if (isShortcutFile(fullPath)) {
        const resolved = await fullyResolveShortcut(fullPath);
        fullPath = resolved.target;
      }
      if (directory && !fs.isDirectory(fullPath)) {
        shellModal("info", Symbol(), "Not a Folder", `"${fullPath}" is not a folder.`);
        return null;
      }
      return fullPath;
    }

    upBtn.addEventListener("click", () => {
      const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
      renderDir(parent);
    });

    filterSelect.addEventListener("change", () => renderDir(currentPath));

    okBtn.addEventListener("click", () => {
      void (async () => {
        const path = await getSelectedPath();
        if (path) done(path);
      })();
    });

    fileNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        void (async () => {
          const path = await getSelectedPath();
          if (path) done(path);
        })();
      }
    });

    renderDir("/");
  },
    null,
  );
}

function extractFunctionNames(code: string): string[] {
  const names = new Set<string>();
  const re = /function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) names.add(m[1]);
  return [...names];
}

function evalNamedFunction(code: string, name: string): Function | undefined {
  if (!/^[a-zA-Z_$][\w$]*$/.test(name)) return undefined;
  try {
    const factory = new Function(
      `${code}\nreturn typeof ${name} === "function" ? ${name} : undefined;`,
    );
    return factory() as Function | undefined;
  } catch {
    return undefined;
  }
}

async function getAppEntryMethods(appKey: string): Promise<string[]> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return ["run"];

  const manifest = record.values["manifest"] as { type?: string; hasFileOpener?: boolean } | undefined;
  const appType = manifest?.type || "spa";

  if (appType === "builtin") {
    const methods = ["run", "openFile"];
    if (appKey === "editor") methods.push("editFile");
    return methods;
  }

  if (appType === "raw") {
    return getRawEntryMethods(appKey);
  }

  const isNewStyle =
    !!manifest && /^[A-Za-z_$][\w$]*$/.test((manifest as { entryPoint?: string }).entryPoint ?? "");
  if (isNewStyle) {
    return getSpaEntryMethods(appKey);
  }

  const fs = new FileSystemAccess();
  const methods = new Set<string>();

  const codePath = `/iSi/apps/${appKey}/entry.js`;
  if (fs.exists(codePath)) {
    const code = await fs.openFile(codePath).read();
    if (code) for (const name of extractFunctionNames(code)) methods.add(name);
  }

  if (manifest?.hasFileOpener) {
    const openerPath = `/iSi/apps/${appKey}/opener.js`;
    if (fs.exists(openerPath)) {
      const code = await fs.openFile(openerPath).read();
      if (code) for (const name of extractFunctionNames(code)) methods.add(name);
    }
  }

  return methods.size > 0 ? [...methods] : ["run"];
}

export async function launchAppEntry(appKey: string, entryFn: string, filename?: string): Promise<boolean> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return false;

  const manifest = record.values["manifest"] as { type?: string; hasFileOpener?: boolean } | undefined;
  const appType = manifest?.type || "spa";

  if (appType === "builtin") {
    const launchBuiltin = (title: string, loader: () => Promise<{ default: (h: symbol) => void }>) => {
      void getAppIconUrl(appKey, undefined).then((iconUrl) => {
        spawnWindow(title, (hwnd) => {
          setWindowIcon(hwnd, iconUrl);
          loader().then((m) => m.default(hwnd));
        });
      });
    };

    const builtinRunners: Record<string, (_f?: string) => void> = {
      editor: (f) => { if (f) editFile(f); else launchBuiltin("Text Editor", () => import("../SysApps/editor")); },
      hi: () => launchBuiltin("hi", () => import("../SysApps/hi")),
      hello: () => launchBuiltin("hello", () => import("../SysApps/hello")),
      draw: () => launchBuiltin("draw", () => import("../SysApps/draw")),
      launch: () => launchBuiltin("launch", () => import("../SysApps/launch")),
      browser: () => launchBuiltin("browser", () => import("../SysApps/browser")),
      games: () => launchBuiltin("Games", () => import("../SysApps/games")),
      "registry-editor": () => launchBuiltin("Registry Editor", () => import("../SysApps/registry-editor")),
      "app-installer": (f) => {
        if (f) {
          void getAppIconUrl(appKey, undefined).then((iconUrl) => {
            spawnWindow("App Manager", (hwnd) => {
              setWindowIcon(hwnd, iconUrl);
              import("../SysApps/app-installer").then((m) =>
                (m as unknown as { openFile(h: symbol, file: string): void }).openFile(hwnd, f),
              );
            });
          });
        } else {
          launchBuiltin("App Manager", () => import("../SysApps/app-installer"));
        }
      },
      "file-explorer": (f) => {
        if (f) {
          void import("../SysApps/file-explorer").then((m) =>
            (m as unknown as { openFolder(p: string): void }).openFolder(f),
          );
        } else {
          launchBuiltin("File Explorer", () => import("../SysApps/file-explorer"));
        }
      },
      "test-app": () => launchBuiltin("Test App", () => import("../SysApps/test-app")),
      "control-panel": () => launchBuiltin("Control Panel", () => import("../SysApps/control-panel")),
      "shortcut-wizard": () => launchBuiltin("Shortcut Wizard", () => import("../SysApps/shortcut-wizard")),
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

  if (appType === "raw") {
    return launchRawEntry(appKey, entryFn, filename);
  }

  const isNewStyle =
    !!manifest && /^[A-Za-z_$][\w$]*$/.test((manifest as { entryPoint?: string }).entryPoint ?? "");
  if (isNewStyle) {
    return launchSpaEntry(appKey, entryFn, filename);
  }

  const fs = new FileSystemAccess();
  const appDir = `/iSi/apps/${appKey}`;
  const openerPath = `${appDir}/opener.js`;
  const entryPath = `${appDir}/entry.js`;

  let code: string | undefined;
  if (manifest?.hasFileOpener && fs.exists(openerPath)) {
    const openerCode = await fs.openFile(openerPath).read();
    if (openerCode && extractFunctionNames(openerCode).includes(entryFn)) {
      code = openerCode;
    }
  }
  if (!code && fs.exists(entryPath)) {
    code = await fs.openFile(entryPath).read();
  }
  if (!code) return false;

  const entryFnImpl = evalNamedFunction(code, entryFn);
  if (typeof entryFnImpl !== "function") return false;

  try {
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

export async function launchRawApp(appKey: string): Promise<boolean> {
  return launchAppEntry(appKey, "run");
}

export async function getInstalledAppType(appKey: string): Promise<string> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  const manifest = record?.values["manifest"] as { type?: string } | undefined;
  return manifest?.type || "spa";
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

function normalizeExtension(ext: string): string {
  const e = ext.trim().toLowerCase();
  if (!e) return "";
  return e.startsWith(".") ? e : "." + e;
}

export interface InstalledAppInfo {
  key: string;
  name: string;
  version: string;
  description: string;
  type: string;
  entryPoint?: string;
  entryModule?: string;
  handlerModule?: string;
  fileOpener?: string;
  hasFileOpener: boolean;
  fileassoc: string[];
  icon?: string;
  startMenu?: boolean;
}

export async function getAppInfo(appKey: string): Promise<InstalledAppInfo | null> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return null;

  const manifest = record.values["manifest"] as
    | (Record<string, unknown> & {
        type?: string;
        entryPoint?: string;
        entryModule?: string;
        handlerModule?: string;
        fileOpener?: string;
        hasFileOpener?: boolean;
        fileassoc?: unknown;
        icon?: unknown;
        startMenu?: unknown;
      })
    | undefined;
  if (!manifest) return null;

  const rawAssoc = Array.isArray(manifest.fileassoc) ? (manifest.fileassoc as unknown[]) : [];
  return {
    key: (manifest.key as string) ?? appKey,
    name: (manifest.name as string) ?? appKey,
    version: (manifest.version as string) ?? "?",
    description: (manifest.description as string) ?? "",
    type: manifest.type ?? "spa",
    entryPoint: manifest.entryPoint,
    entryModule: manifest.entryModule,
    handlerModule: manifest.handlerModule,
    fileOpener: manifest.fileOpener,
    hasFileOpener: !!manifest.hasFileOpener,
    fileassoc: rawAssoc
      .filter((e): e is string => typeof e === "string")
      .map(normalizeExtension)
      .filter(Boolean),
    icon: typeof manifest.icon === "string" ? manifest.icon : undefined,
    startMenu:
      typeof manifest.startMenu === "boolean" ? manifest.startMenu : undefined,
  };
}

export async function uninstallApp(appKey: string): Promise<void> {
  const info = await getAppInfo(appKey);
  if (!info) throw new Error(`app "${appKey}" is not installed`);
  if (info.type === "builtin") {
    throw new Error(`"${info.name}" is a built-in app and cannot be uninstalled`);
  }

  const reg = new RegistryInstanceAccess();

  for (const ext of info.fileassoc) {
    const rec = await reg._load(`${CLASSES_ROOT_PREFIX}/${ext}`);
    if (rec && rec.values["app"] === appKey) {
      await reg._deleteKey(`${CLASSES_ROOT_PREFIX}/${ext}`);
    }
  }

  const indexRecord = await reg._load(APP_INDEX_PATH);
  const list = (indexRecord?.values["list"] as Array<{ key: string }> | undefined) ?? [];
  await reg._write(
    APP_INDEX_PATH,
    "list",
    list.filter((a) => a.key !== appKey),
  );

  await reg._deleteKey(`${APPS_REG_PREFIX}/${appKey}`);

  const fs = new FileSystemAccess();
  if (fs.exists(`/iSi/apps/${appKey}`)) {
    fs.deleteDirectoryRecursive(`/iSi/apps/${appKey}`);
  }
}

export async function setFileAssociations(appKey: string, extensions: string[]): Promise<void> {
  const info = await getAppInfo(appKey);
  if (!info) throw new Error(`app "${appKey}" is not installed`);

  const entry =
    info.type === "raw"
      ? info.handlerModule
        ? "handler"
        : undefined
      : info.fileOpener ?? (info.hasFileOpener ? "handler" : undefined);

  const reg = new RegistryInstanceAccess();

  const desired = new Set(extensions.map(normalizeExtension).filter(Boolean));
  const allExts = new Set<string>([...desired, ...info.fileassoc]);

  for (const ext of allExts) {
    const rec = await reg._load(`${CLASSES_ROOT_PREFIX}/${ext}`);
    const registeredToThisApp = !!rec && rec.values["app"] === appKey;
    if (desired.has(ext)) {
      if (!registeredToThisApp && entry) {
        await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", appKey);
        await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", entry);
      }
    } else if (registeredToThisApp) {
      await reg._deleteKey(`${CLASSES_ROOT_PREFIX}/${ext}`);
    }
  }
}
