import { FileSystemAccess } from "../Apis/FileSystemApi";
import { shellOpenWithPicker } from "../Apis/iSApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

let currentPath = "/";

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

  async function navigateTo(path: string) {
    currentPath = normalizePath(path);
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
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;border-radius:2px;";
      row.style.cursor = isDir ? "pointer" : "default";

      const icon = document.createElement("span");
      icon.style.cssText = "font-size:14px;flex-shrink:0;";
      icon.textContent = isDir ? "📁" : "📄";
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

      row.addEventListener("mouseenter", () => { row.style.background = "rgba(0,0,0,0.06)"; });
      row.addEventListener("mouseleave", () => { row.style.background = ""; });

      row.addEventListener("dblclick", async () => {
        if (isDir) {
          navigateTo(entry);
        } else {
          const ok = await shellOpenWithPicker(entry);
          if (!ok) {
            statusBar.textContent = `No app could open "${name}"`;
          }
        }
      });

      fileList.appendChild(row);
    }
  }

  navigateTo("/");
}
