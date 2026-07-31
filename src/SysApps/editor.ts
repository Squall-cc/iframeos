import { FileSystemAccess } from "../Apis/FileSystemApi";
import { shellModal, shellSelectFile } from "../Apis/iSApi";
import { setContent, setMinSize, spawn } from "../Core/windowhelpers";

function buildEditor(hwnd: symbol, initialPath?: string) {
  setMinSize(hwnd, 400, 250);
  const fs = new FileSystemAccess();
  let currentPath = initialPath ?? null;
  let saved = !!initialPath;
  let dirty = false;

  function updateTitle() {
    const name = currentPath ? currentPath.split("/").pop() : "Untitled";
    const w = document.querySelector(`[data-hwnd="${hwnd.description ?? ""}"]`)?.querySelector(".title-bar-text");
    if (w) w.textContent = (dirty ? "* " : "") + name + " - Text Editor";
  }

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const menuBar = document.createElement("div");
  menuBar.style.cssText = "display:flex;gap:2px;padding:2px 4px;border-bottom:1px solid rgba(0,0,0,0.15);background:rgba(0,0,0,0.04);align-items:center;";

  function makeMenuItem(label: string, action: () => void) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:none;background:transparent;border-radius:2px;";
    btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(0,0,0,0.08)"; });
    btn.addEventListener("mouseleave", () => { btn.style.background = ""; });
    btn.addEventListener("click", action);
    return btn;
  }

  const fileMenu = document.createElement("div");
  fileMenu.style.cssText = "position:relative;";

  const fileBtn = makeMenuItem("File", () => {
    const open = fileDropdown.style.display === "block";
    document.querySelectorAll(".editor-dropdown").forEach((d) => (d as HTMLElement).style.display = "none");
    fileDropdown.style.display = open ? "none" : "block";
  });

  fileMenu.appendChild(fileBtn);

  const fileDropdown = document.createElement("div");
  fileDropdown.className = "editor-dropdown";
  fileDropdown.style.cssText = "display:none;position:absolute;top:100%;left:0;min-width:160px;background:#fff;border:1px solid rgba(0,0,0,0.15);border-radius:2px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:100;";

  function addDropdownItem(text: string, action: () => void) {
    const item = document.createElement("div");
    item.style.cssText = "padding:5px 12px;cursor:pointer;font-size:11px;";
    item.addEventListener("mouseenter", () => { item.style.background = "rgba(0,100,200,0.1)"; });
    item.addEventListener("mouseleave", () => { item.style.background = ""; });
    item.textContent = text;
    item.addEventListener("click", () => { fileDropdown.style.display = "none"; action(); });
    fileDropdown.appendChild(item);
  }

  addDropdownItem("New File", () => {
    if (dirty) {
      shellModal("yesno", hwnd, "Unsaved Changes", "Save changes before creating a new file?").then((r) => {
        if (r === "yes") doSave();
      });
    }
    currentPath = null;
    saved = false;
    dirty = false;
    textarea.value = "";
    textarea.disabled = false;
    updateTitle();
  });

  addDropdownItem("Save File", doSave);
  addDropdownItem("Load File", doLoad);

  fileMenu.appendChild(fileDropdown);

  menuBar.appendChild(fileMenu);

  const sep = document.createElement("span");
  sep.style.cssText = "flex:1;";
  menuBar.appendChild(sep);

  container.appendChild(menuBar);

  const textarea = document.createElement("textarea");
  textarea.style.cssText = "flex:1;width:100%;box-sizing:border-box;border:none;resize:none;font-family:monospace;font-size:14px;padding:8px;";
  textarea.spellcheck = false;

  if (initialPath) {
    const file = fs.openFile(initialPath);
    file.read().then((text) => {
      textarea.value = text ?? "";
      textarea.disabled = false;
    });
  } else {
    textarea.disabled = false;
  }

  textarea.addEventListener("input", () => {
    dirty = true;
    updateTitle();
    if (saved && currentPath) {
      const file = fs.openFile(currentPath);
      file.write(textarea.value);
      dirty = false;
      updateTitle();
    }
  });

  container.appendChild(textarea);
  setContent(hwnd, container);

  function doLoad() {
    shellSelectFile({ title: "Open File" }).then((path) => {
      if (!path) return;
      if (dirty) {
        shellModal("yesno", hwnd, "Unsaved Changes", "Save current file first?").then((r) => {
          if (r === "yes") doSave();
        });
      }
      currentPath = path;
      saved = true;
      const file = fs.openFile(path);
      file.read().then((text) => {
        textarea.value = text ?? "";
        textarea.disabled = false;
        dirty = false;
        updateTitle();
      });
    });
  }

  function doSave() {
    if (currentPath && saved) {
      const file = fs.openFile(currentPath);
      file.write(textarea.value);
      dirty = false;
      updateTitle();
      return;
    }
    shellSelectFile({ title: "Save File As", save: true }).then((fullPath) => {
      if (!fullPath) return;
      if (!fs.exists(fullPath)) fs.createFile(fullPath);
      const file = fs.openFile(fullPath);
      file.write(textarea.value);
      currentPath = fullPath;
      saved = true;
      dirty = false;
      updateTitle();
    });
  }

  document.addEventListener("click", (e) => {
    if (!fileMenu.contains(e.target as Node)) {
      fileDropdown.style.display = "none";
    }
  }, { once: false });

  updateTitle();
}

export function editFile(path: string): void {
  spawn(path, (hwnd) => buildEditor(hwnd, path));
}

export default function run(hwnd: symbol) {
  buildEditor(hwnd);
}