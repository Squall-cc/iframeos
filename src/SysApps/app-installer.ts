import { FileSystemAccess } from "../Apis/FileSystemApi";
import { getAllInstalledApps, launchSpaApp, shellSelectFile } from "../Apis/iSApi";
import { RegistryInstanceAccess } from "../Apis/RegistryApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

const APP_INDEX_PATH = "InternalSystem/AppIndex";
const APPS_REG_PREFIX = "InternalSystem/Apps";

async function installSpa(jsonText: string): Promise<string> {
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON in .spa file");
  }

  const name = manifest["name"] as string | undefined;
  const key = manifest["key"] as string | undefined;
  const version = manifest["version"] as string | undefined;
  const description = manifest["description"] as string | undefined;
  const entryPoint = manifest["entryPoint"] as string | undefined;
  const fileOpener = manifest["fileOpener"] as string | undefined;

  if (!key || !name || !entryPoint) {
    throw new Error(".spa manifest must include 'key', 'name', and 'entryPoint'");
  }

  const fs = new FileSystemAccess();
  const appDir = `/iSi/apps/${key}`;

  if (!fs.exists(appDir)) {
    fs.createDirectory(appDir);
  }

  const entryHandle = fs.openFile(`${appDir}/entry.js`);
  entryHandle.write(entryPoint);

  if (fileOpener) {
    const openerHandle = fs.openFile(`${appDir}/opener.js`);
    openerHandle.write(fileOpener);
  }

  const reg = new RegistryInstanceAccess();
  await reg._write(`${APPS_REG_PREFIX}/${key}`, "manifest", {
    name,
    key,
    version: version || "1.0.0",
    description: description || "",
    type: "spa",
    hasFileOpener: !!fileOpener,
  });

  const indexRecord = await reg._load(APP_INDEX_PATH);
  const existing = indexRecord?.values["list"] as Array<{ key: string; name: string; version: string; description: string }> | undefined;
  const list = existing ?? [];
  if (!list.some((a) => a.key === key)) {
    list.push({
      key,
      name,
      version: version || "1.0.0",
      description: description || "",
    });
  }
  await reg._write(APP_INDEX_PATH, "list", list);

  return name;
}

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 550, 420);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const header = document.createElement("div");
  header.style.cssText = "padding:8px;font-weight:600;font-size:13px;border-bottom:1px solid rgba(0,0,0,0.15);";
  header.textContent = "App Installer";
  container.appendChild(header);

  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.1);";

  const pasteTab = document.createElement("button");
  pasteTab.textContent = "Paste JSON";
  pasteTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:#fff;border-bottom:2px solid #0078d4;";
  tabs.appendChild(pasteTab);

  const hostTab = document.createElement("button");
  hostTab.textContent = "From Host";
  hostTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:rgba(0,0,0,0.04);border-bottom:2px solid transparent;";
  tabs.appendChild(hostTab);

  const guestTab = document.createElement("button");
  guestTab.textContent = "From Guest";
  guestTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:rgba(0,0,0,0.04);border-bottom:2px solid transparent;";
  tabs.appendChild(guestTab);

  const installedTab = document.createElement("button");
  installedTab.textContent = "Installed";
  installedTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:rgba(0,0,0,0.04);border-bottom:2px solid transparent;";
  tabs.appendChild(installedTab);

  container.appendChild(tabs);

  const content = document.createElement("div");
  content.style.cssText = "flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;";
  container.appendChild(content);

  const statusBar = document.createElement("div");
  statusBar.style.cssText = "padding:4px 8px;border-top:1px solid rgba(0,0,0,0.1);font-size:11px;color:rgba(0,0,0,0.5);";
  statusBar.textContent = "Ready";
  container.appendChild(statusBar);

  function activateTab(active: HTMLElement, others: HTMLElement[]) {
    active.style.background = "#fff";
    active.style.borderBottom = "2px solid #0078d4";
    for (const other of others) {
      other.style.background = "rgba(0,0,0,0.04)";
      other.style.borderBottom = "2px solid transparent";
    }
  }

  function showPasteView() {
    content.innerHTML = "";
    activateTab(pasteTab, [hostTab, guestTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:4px;";
    label.textContent = "Paste .spa JSON content below:";
    content.appendChild(label);

    const textarea = document.createElement("textarea");
    textarea.style.cssText = "width:100%;flex:1;box-sizing:border-box;font-family:monospace;font-size:12px;padding:6px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;resize:none;";
    textarea.placeholder = '{\n  "name": "My App",\n  "key": "my-app",\n  "version": "1.0.0",\n  "description": "...",\n  "entryPoint": "function run(hwnd) { ... }",\n  "fileOpener": "function openFile(path, hwnd) { ... }"\n}';
    content.appendChild(textarea);

    const installBtn = document.createElement("button");
    installBtn.textContent = "Install App";
    installBtn.style.cssText = "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;";
    installBtn.addEventListener("click", async () => {
      const json = textarea.value.trim();
      if (!json) {
        statusBar.textContent = "Please paste .spa JSON content";
        return;
      }
      installBtn.disabled = true;
      installBtn.textContent = "Installing...";
      statusBar.textContent = "Installing...";
      try {
        const name = await installSpa(json);
        statusBar.textContent = `Installed "${name}" successfully`;
        textarea.value = "";
      } catch (e) {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      }
      installBtn.disabled = false;
      installBtn.textContent = "Install App";
    });
    content.appendChild(installBtn);
  }

  function showHostView() {
    content.innerHTML = "";
    activateTab(hostTab, [pasteTab, guestTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:8px;";
    label.textContent = "Load a .spa file from the host machine:";
    content.appendChild(label);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".spa,.json";
    fileInput.style.cssText = "margin-bottom:8px;font-size:11px;";
    content.appendChild(fileInput);

    const installBtn = document.createElement("button");
    installBtn.textContent = "Install Selected";
    installBtn.style.cssText = "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;";
    installBtn.disabled = true;

    fileInput.addEventListener("change", () => {
      installBtn.disabled = !fileInput.files || fileInput.files.length === 0;
    });

    installBtn.addEventListener("click", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        statusBar.textContent = "Select a .spa file first";
        return;
      }
      installBtn.disabled = true;
      installBtn.textContent = "Installing...";
      statusBar.textContent = "Reading file...";
      try {
        const text = await file.text();
        const name = await installSpa(text);
        statusBar.textContent = `Installed "${name}" successfully`;
        fileInput.value = "";
      } catch (e) {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      }
      installBtn.disabled = false;
      installBtn.textContent = "Install Selected";
    });
    content.appendChild(installBtn);
  }

  function showGuestView() {
    content.innerHTML = "";
    activateTab(guestTab, [pasteTab, hostTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:8px;";
    label.textContent = "Select a .spa file from the guest (VFS):";
    content.appendChild(label);

    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Browse VFS...";
    selectBtn.style.cssText = "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;margin-bottom:8px;";
    content.appendChild(selectBtn);

    const installBtn = document.createElement("button");
    installBtn.textContent = "Install Selected";
    installBtn.style.cssText = "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;";
    installBtn.style.display = "none";

    let selectedPath: string | null = null;

    selectBtn.addEventListener("click", async () => {
      const path = await shellSelectFile({
        title: "Select .spa file",
        filter: { label: "SPA Files", extensions: [".spa", ".json"] },
      });
      if (path) {
        selectedPath = path;
        installBtn.style.display = "";
        statusBar.textContent = `Selected: ${path}`;
      }
    });

    installBtn.addEventListener("click", async () => {
      if (!selectedPath) return;
      installBtn.disabled = true;
      installBtn.textContent = "Installing...";
      statusBar.textContent = "Reading file...";
      try {
        const fs = new FileSystemAccess();
        const handle = fs.openFile(selectedPath);
        const text = await handle.read();
        if (!text) throw new Error("Could not read file");
        const name = await installSpa(text);
        statusBar.textContent = `Installed "${name}" successfully`;
        selectedPath = null;
        installBtn.style.display = "none";
      } catch (e) {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      }
      installBtn.disabled = false;
      installBtn.textContent = "Install Selected";
    });

    content.appendChild(installBtn);
  }

  function showInstalledView() {
    content.innerHTML = "";
    activateTab(installedTab, [pasteTab, hostTab, guestTab]);

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Refresh";
    refreshBtn.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);margin-bottom:8px;align-self:flex-start;";
    content.appendChild(refreshBtn);

    const listDiv = document.createElement("div");
    listDiv.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    content.appendChild(listDiv);

    async function loadList() {
      listDiv.innerHTML = "";
      try {
        const apps = await getAllInstalledApps();
        if (apps.length === 0) {
          const empty = document.createElement("div");
          empty.style.cssText = "padding:12px;color:rgba(0,0,0,0.4);text-align:center;font-size:11px;";
          empty.textContent = "No apps installed yet";
          listDiv.appendChild(empty);
          return;
        }
        for (const app of apps) {
          const card = document.createElement("div");
          card.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

          const nameEl = document.createElement("span");
          nameEl.style.cssText = "font-weight:600;flex:1;font-size:11px;";
          nameEl.textContent = app.name;
          card.appendChild(nameEl);

          const verEl = document.createElement("span");
          verEl.style.cssText = "font-size:10px;color:rgba(0,0,0,0.4);";
          verEl.textContent = `v${app.version}`;
          card.appendChild(verEl);

          const launchBtn = document.createElement("button");
          launchBtn.textContent = "Launch";
          launchBtn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);";
          launchBtn.addEventListener("click", async () => {
            const ok = await launchSpaApp(app.key);
            if (!ok) statusBar.textContent = `Failed to launch "${app.name}"`;
          });
          card.appendChild(launchBtn);

          listDiv.appendChild(card);
        }
      } catch (e) {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      }
    }

    refreshBtn.addEventListener("click", loadList);
    loadList();
  }

  pasteTab.addEventListener("click", showPasteView);
  hostTab.addEventListener("click", showHostView);
  guestTab.addEventListener("click", showGuestView);
  installedTab.addEventListener("click", showInstalledView);

  showPasteView();

  setContent(hwnd, container);
}
