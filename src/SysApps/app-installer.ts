import {
  FileSystemAccess,
} from "../Apis/FileSystemApi";
import {
  RegistryInstanceAccess,
} from "../Apis/RegistryApi";
import {
  getAllInstalledApps,
  getAppInfo,
  launchSpaApp,
  setFileAssociations,
  shellSelectFile,
  shellModal,
  uninstallApp,
} from "../Apis/iSApi";
import { installRawAppFromZip } from "../Apis/RawApp";
import type { InstallProgress } from "../Apis/RawApp";
import { installSpaFromZip, parseSpaArchive } from "../Apis/SpaApp";
import type { ZipEntry } from "../Apis/zip";
import { setContent, setMinSize } from "../Core/windowhelpers";

interface VerifyResult {
  type: "spa" | "raw";
  name: string;
  key: string;
  version: string;
  description: string;
  entryPoint?: string;
  entryModule?: string;
  handlerModule?: string;
  hasFileOpener: boolean;
  fileAssociations: string[];
  fileCount: number;
  checks: string[];
  warnings: string[];
  errors: string[];
  entries: ZipEntry[];
}

function entryExists(entries: ZipEntry[], rel: string | undefined): boolean {
  if (!rel) return false;
  const norm = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  const base = norm.split("/").pop();
  return entries.some((e) => {
    const n = e.name.replace(/^\/+/, "").replace(/\\/g, "/");
    return n === norm || n.split("/").pop() === base;
  });
}

function hasUnsafePaths(entries: ZipEntry[]): boolean {
  return entries.some((e) => {
    const parts = e.name.split("\\").join("/").split("/").filter(Boolean);
    return parts.includes("..");
  });
}

async function verifyPackage(bytes: ArrayBuffer): Promise<VerifyResult> {
  const info = await parseSpaArchive(bytes);
  const raw = info.manifest;
  const entries = info.entries;

  const type = raw["type"] === "raw" ? "raw" : "spa";
  const name = String(raw["name"] ?? "");
  const key = String(raw["key"] ?? "");
  const version = String(raw["version"] ?? "1.0.0");
  const description = String(raw["description"] ?? "");
  const entryPoint = raw["entryPoint"] as string | undefined;
  const entryModule = (raw["entryModule"] as string | undefined) || (type === "raw" ? "index.html" : "main.ts");
  const handlerModule = raw["handlerModule"] as string | undefined;
  const fileOpener = raw["fileOpener"] as string | undefined;
  const hasFileOpener = type === "raw" ? !!handlerModule : !!fileOpener;

  const checks: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  checks.push(`manifest.json found (${info.fileCount} files in package)`);
  checks.push(`manifest type: ${type === "raw" ? "raw HTML app" : "code app"}`);

  if (hasUnsafePaths(entries)) {
    errors.push("archive contains unsafe paths (..)");
  }

  if (!key) {
    errors.push("manifest is missing a 'key'");
  } else if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    errors.push(`invalid app key "${key}" (letters, digits, '.', '_', '-' only)`);
  } else {
    checks.push(`app key: "${key}"`);
  }

  if (!name) {
    errors.push("manifest is missing a 'name'");
  } else {
    checks.push(`app name: "${name}"`);
  }

  if (type === "raw") {
    if (entryExists(entries, entryModule)) {
      checks.push(`entry module "${entryModule}" present`);
    } else {
      errors.push(`entry module "${entryModule}" is missing from the package`);
    }
    if (handlerModule) {
      if (entryExists(entries, handlerModule)) {
        checks.push(`handler module "${handlerModule}" present`);
      } else {
        errors.push(`handler module "${handlerModule}" is missing from the package`);
      }
    }
  } else {
    if (!entryPoint) {
      errors.push(".spa manifest must include an 'entryPoint'");
    } else {
      checks.push(`entry point: "${entryPoint}"`);
    }
    if (raw["entryModule"] && !entryExists(entries, entryModule)) {
      warnings.push(`entry module "${entryModule}" was not found in the package`);
    }
  }

  if (info.fileAssociations.length > 0) {
    checks.push(`declares file types: ${info.fileAssociations.join(", ")}`);
  }

  return {
    type,
    name,
    key,
    version,
    description,
    entryPoint,
    entryModule,
    handlerModule,
    hasFileOpener,
    fileAssociations: info.fileAssociations,
    fileCount: info.fileCount,
    checks,
    warnings,
    errors,
    entries,
  };
}

export default function run(hwnd: symbol) {
  startApp(hwnd);
}

export function openFile(hwnd: symbol, filename: string) {
  startApp(hwnd, filename);
}

function startApp(hwnd: symbol, initialFile?: string) {
  setMinSize(hwnd, 580, 460);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const header = document.createElement("div");
  header.style.cssText = "padding:8px;font-weight:600;font-size:13px;border-bottom:1px solid rgba(0,0,0,0.15);";
  header.textContent = "App Manager";
  container.appendChild(header);

  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.1);";

  const hostTab = document.createElement("button");
  hostTab.textContent = "From Host";
  hostTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:#fff;border-bottom:2px solid #0078d4;";
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

  const btnStyle =
    "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;";
  const ghostBtnStyle =
    "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);align-self:flex-start;";

  function attachProgress(
    progressWrap: HTMLElement,
    progressLabel: HTMLElement,
    progressBar: HTMLElement,
  ) {
    return (p: InstallProgress) => {
      progressWrap.style.display = "flex";
      if (p.phase === "extract") {
        progressLabel.textContent = "Extracting package...";
      } else if (p.phase === "write") {
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 100;
        progressBar.style.width = `${pct}%`;
        progressLabel.textContent = `Writing files ${p.done} of ${p.total}...`;
      } else {
        progressBar.style.width = "100%";
        progressLabel.textContent = "Registering app...";
      }
    };
  }

  function buildProgressBar(): [HTMLElement, HTMLElement, HTMLElement] {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:none;flex-direction:column;gap:3px;";
    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);";
    const track = document.createElement("div");
    track.style.cssText = "height:10px;background:rgba(0,0,0,0.08);border-radius:5px;overflow:hidden;";
    const bar = document.createElement("div");
    bar.style.cssText = "height:100%;width:0%;background:#0078d4;transition:width .15s;";
    track.appendChild(bar);
    wrap.append(label, track);
    return [wrap, label, bar];
  }

  function showConfirmView(
    bytes: ArrayBuffer,
    fileName: string,
    back: () => void,
  ) {
    statusBar.textContent = "Verifying package...";
    verifyPackage(bytes)
      .then((verified) => {
        content.innerHTML = "";
        const verifiedOk = verified.errors.length === 0;

        const title = document.createElement("div");
        title.style.cssText = "font-weight:600;font-size:13px;";
        title.textContent = `Install "${verified.name || fileName}" v${verified.version}`;
        content.appendChild(title);

        const typeRow = document.createElement("div");
        typeRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);";
        typeRow.textContent =
          verified.type === "raw" ? "Type: raw HTML app" : "Type: code app";
        content.appendChild(typeRow);

        const keyRow = document.createElement("div");
        keyRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);";
        keyRow.textContent = `Key: ${verified.key || "?"}`;
        content.appendChild(keyRow);

        if (verified.description) {
          const descRow = document.createElement("div");
          descRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);";
          descRow.textContent = verified.description;
          content.appendChild(descRow);
        }

        const entryRow = document.createElement("div");
        entryRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);";
        entryRow.textContent =
          verified.type === "raw"
            ? `Entry: ${verified.entryModule}${verified.handlerModule ? ` (handler: ${verified.handlerModule})` : ""}`
            : `Entry point: ${verified.entryPoint ?? "?"}`;
        content.appendChild(entryRow);

        // ---- package verification summary ----
        const verifyBox = document.createElement("div");
        verifyBox.style.cssText = "display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;font-size:11px;";

        const verifyTitle = document.createElement("div");
        verifyTitle.style.cssText = "font-weight:600;";
        verifyTitle.textContent = verifiedOk ? "Package verification: passed" : "Package verification: failed";
        verifyTitle.style.color = verifiedOk ? "#107c10" : "#d83b01";
        verifyBox.appendChild(verifyTitle);

        function verifyRow(message: string, iconClass: string, color: string): HTMLDivElement {
          const row = document.createElement("div");
          row.style.cssText = `color:${color};display:flex;align-items:center;gap:6px;`;
          const icon = document.createElement("i");
          icon.className = iconClass;
          icon.style.cssText = `color:${color};width:12px;flex-shrink:0;`;
          row.appendChild(icon);
          const msg = document.createElement("span");
          msg.textContent = message;
          row.appendChild(msg);
          return row;
        }
        for (const check of verified.checks) {
          verifyBox.appendChild(verifyRow(check, "fa-solid fa-check", "#107c10"));
        }
        for (const warn of verified.warnings) {
          verifyBox.appendChild(verifyRow(warn, "fa-solid fa-triangle-exclamation", "#8a6d00"));
        }
        for (const err of verified.errors) {
          verifyBox.appendChild(verifyRow(err, "fa-solid fa-xmark", "#d83b01"));
        }
        content.appendChild(verifyBox);

        // ---- file type association checkboxes ----
        if (verified.hasFileOpener && verified.fileAssociations.length > 0) {
          const assocLabel = document.createElement("div");
          assocLabel.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-top:4px;";
          assocLabel.textContent = `Associate these file types with "${verified.name || fileName}"?`;
          content.appendChild(assocLabel);

          const box = document.createElement("div");
          box.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:6px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

          for (const ext of verified.fileAssociations) {
            const row = document.createElement("label");
            row.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = true;
            cb.value = ext;
            cb.style.cssText = "margin:0;cursor:pointer;";

            row.appendChild(cb);
            row.appendChild(document.createTextNode(ext));
            box.appendChild(row);
          }
          content.appendChild(box);
        }

        // ---- processing progress bar ----
        const [progressWrap, progressLabel, progressBar] = buildProgressBar();
        content.appendChild(progressWrap);

        const rowBtns = document.createElement("div");
        rowBtns.style.cssText = "display:flex;gap:8px;align-items:center;";

        const installBtn = document.createElement("button");
        installBtn.textContent = "Install";
        installBtn.style.cssText = btnStyle;
        installBtn.disabled = !verifiedOk;
        if (!verifiedOk) installBtn.style.opacity = "0.4";
        installBtn.addEventListener("click", async () => {
          const selected = [...content.querySelectorAll('input[type="checkbox"]:checked')]
            .map((cb) => (cb as HTMLInputElement).value)
            .filter(Boolean);
          installBtn.disabled = true;
          installBtn.textContent = "Installing...";
          statusBar.textContent = "Installing...";
          try {
            const onProgress = attachProgress(progressWrap, progressLabel, progressBar);
            const name =
              verified.type === "raw"
                ? await installRawAppFromZip(bytes, { fileAssociations: selected }, onProgress)
                : await installSpaFromZip(bytes, { fileAssociations: selected }, onProgress);
            statusBar.textContent = `Installed "${name}" successfully`;
            showInstalledView();
          } catch (e) {
            statusBar.textContent = `Error: ${(e as Error).message}`;
            progressLabel.textContent = `Error: ${(e as Error).message}`;
            installBtn.disabled = false;
            installBtn.textContent = "Install";
          }
        });
        rowBtns.appendChild(installBtn);

        const backBtn = document.createElement("button");
        backBtn.textContent = "Back";
        backBtn.style.cssText = ghostBtnStyle;
        backBtn.addEventListener("click", back);
        rowBtns.appendChild(backBtn);

        content.appendChild(rowBtns);
      })
      .catch((e) => {
        statusBar.textContent = `Error: ${(e as Error).message}`;
        back();
      });
  }

  function showHostView() {
    content.innerHTML = "";
    activateTab(hostTab, [guestTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:8px;";
    label.textContent = "Load a .spa or .zip package from the host machine:";
    content.appendChild(label);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".spa,.zip";
    fileInput.style.cssText = "display:none;";

    const pickBtn = document.createElement("button");
    pickBtn.textContent = "Choose a package...";
    pickBtn.style.cssText = btnStyle;
    content.appendChild(pickBtn);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.style.cssText = ghostBtnStyle;
    nextBtn.disabled = true;

    let pickedFile: File | null = null;

    function handleFile(file: File) {
      pickedFile = file;
      nextBtn.disabled = false;
      nextBtn.textContent = `Next (${file.name})`;
      statusBar.textContent = `${file.name} selected`;
    }

    async function pickFromHost() {
      const w = window as Window & {
        showOpenFilePicker?: (options?: unknown) => Promise<Array<{ getFile(): Promise<File> }>>;
      };
      if (typeof w.showOpenFilePicker === "function") {
        try {
          const handles = await w.showOpenFilePicker({
            multiple: false,
            types: [
              {
                description: "App Packages",
                accept: { "application/zip": [".spa", ".zip"] },
              },
            ],
          });
          if (handles[0]) {
            handleFile(await handles[0].getFile());
            return;
          }
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // user canceled
        }
      }
      fileInput.click();
    }

    pickBtn.addEventListener("click", pickFromHost);
    fileInput.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (f) handleFile(f);
    });

    nextBtn.addEventListener("click", () => {
      if (!pickedFile) {
        statusBar.textContent = "Select a package first";
        return;
      }
      statusBar.textContent = "Reading archive...";
      pickedFile.arrayBuffer().then((bytes) => showConfirmView(bytes, pickedFile!.name, showHostView));
    });
    content.appendChild(nextBtn);

    const dropZone = document.createElement("div");
    dropZone.style.cssText = "flex:1;border:2px dashed rgba(0,0,0,0.2);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(0,0,0,0.4);min-height:120px;transition:background .15s,border-color .15s;";
    dropZone.textContent = "or drop a .spa / .zip file here";
    content.appendChild(dropZone);

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#0078d4";
      dropZone.style.background = "rgba(0,120,212,0.08)";
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "rgba(0,0,0,0.2)";
      dropZone.style.background = "";
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "rgba(0,0,0,0.2)";
      dropZone.style.background = "";
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
      else statusBar.textContent = "No file found in the drop";
    });
  }

  function showGuestView() {
    content.innerHTML = "";
    activateTab(guestTab, [hostTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:8px;";
    label.textContent = "Select a .spa or .zip package from the guest (VFS):";
    content.appendChild(label);

    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Browse VFS...";
    selectBtn.style.cssText = btnStyle;
    content.appendChild(selectBtn);

    selectBtn.addEventListener("click", async () => {
      const path = await shellSelectFile({
        title: "Select package",
        filter: { label: "App Packages", extensions: [".spa", ".zip"] },
      });
      if (path) {
        const fs = new FileSystemAccess();
        if (!fs.isFile(path)) {
          statusBar.textContent = `Error: "${path}" does not exist`;
          return;
        }
        statusBar.textContent = `Reading ${path}...`;
        const blob = await fs.data.read(path);
        if (!blob) {
          statusBar.textContent = `Error: could not read "${path}"`;
          return;
        }
        showConfirmView(await blob.arrayBuffer(), path.split("/").pop() || path, showGuestView);
      }
    });

    content.appendChild(selectBtn);
  }

  function showConfigureView(appKey: string, appName: string, back: () => void) {
    statusBar.textContent = "Loading app configuration...";
    getAppInfo(appKey)
      .then(async (info) => {
        content.innerHTML = "";
        if (!info || info.type === "builtin") {
          statusBar.textContent = `"${appName}" is not configurable`;
          back();
          return;
        }

        const title = document.createElement("div");
        title.style.cssText = "font-weight:600;font-size:13px;";
        title.textContent = `Configure "${info.name}" file types`;
        content.appendChild(title);

        const reg = new RegistryInstanceAccess();

        const label = document.createElement("div");
        label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:4px;";
        label.textContent =
          info.fileassoc.length > 0
            ? "Check the file types this app should be associated with:"
            : "This app does not declare any file types to configure.";
        content.appendChild(label);

        const box = document.createElement("div");
        box.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:6px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

        const checkedState: Record<string, boolean> = {};
        for (const ext of info.fileassoc) {
          const rec = await reg._load(`InternalSystem/ClassesRoot/${ext}`);
          checkedState[ext] = !!rec && rec.values["app"] === appKey;

          const row = document.createElement("label");
          row.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;";

          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = checkedState[ext];
          cb.value = ext;
          cb.style.cssText = "margin:0;cursor:pointer;";

          row.appendChild(cb);
          row.appendChild(document.createTextNode(ext));
          box.appendChild(row);
        }
        content.appendChild(box);

        const rowBtns = document.createElement("div");
        rowBtns.style.cssText = "display:flex;gap:8px;align-items:center;";

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.style.cssText = btnStyle;
        saveBtn.addEventListener("click", async () => {
          const selected = [...content.querySelectorAll('input[type="checkbox"]:checked')]
            .map((cb) => (cb as HTMLInputElement).value)
            .filter(Boolean);
          saveBtn.disabled = true;
          statusBar.textContent = "Saving file type associations...";
          try {
            await setFileAssociations(appKey, selected);
            statusBar.textContent = `Updated file type associations for "${info.name}"`;
            back();
          } catch (e) {
            statusBar.textContent = `Error: ${(e as Error).message}`;
            saveBtn.disabled = false;
          }
        });
        rowBtns.appendChild(saveBtn);

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "Cancel";
        cancelBtn.style.cssText = ghostBtnStyle;
        cancelBtn.addEventListener("click", back);
        rowBtns.appendChild(cancelBtn);

        content.appendChild(rowBtns);
      })
      .catch((e) => {
        statusBar.textContent = `Error: ${(e as Error).message}`;
        back();
      });
  }

  function showInstalledView() {
    content.innerHTML = "";
    activateTab(installedTab, [hostTab, guestTab]);

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
          const info = await getAppInfo(app.key);
          const isBuiltin = info?.type === "builtin";

          const card = document.createElement("div");
          card.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

          const nameEl = document.createElement("span");
          nameEl.style.cssText = "font-weight:600;flex:1;font-size:11px;";
          nameEl.textContent = app.name;
          card.appendChild(nameEl);

          const verEl = document.createElement("span");
          verEl.style.cssText = "font-size:10px;color:rgba(0,0,0,0.4);";
          verEl.textContent = `v${app.version} · ${info?.type ?? "?"}`;
          card.appendChild(verEl);

          const launchBtn = document.createElement("button");
          launchBtn.textContent = "Launch";
          launchBtn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);";
          launchBtn.addEventListener("click", async () => {
            const ok = await launchSpaApp(app.key);
            if (!ok) statusBar.textContent = `Failed to launch "${app.name}"`;
          });
          card.appendChild(launchBtn);

          if (info && !isBuiltin && info.fileassoc.length > 0) {
            const configBtn = document.createElement("button");
            configBtn.textContent = "Configure";
            configBtn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
            configBtn.addEventListener("click", () => {
              showConfigureView(app.key, app.name, showInstalledView);
            });
            card.appendChild(configBtn);
          }

          if (info && !isBuiltin) {
            const uninstallBtn = document.createElement("button");
            uninstallBtn.textContent = "Uninstall";
            uninstallBtn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(200,0,0,0.4);border-radius:2px;background:rgba(200,0,0,0.06);color:#a00000;";
            uninstallBtn.addEventListener("click", async () => {
              const choice = await shellModal(
                "yesno",
                hwnd,
                `Uninstall "${info.name}"?`,
                `This will remove "${info.name}" (${info.key}) and all of its files from the system.`,
              );
              if (choice !== "yes") return;
              uninstallBtn.disabled = true;
              statusBar.textContent = `Uninstalling "${info.name}"...`;
              try {
                await uninstallApp(app.key);
                statusBar.textContent = `Uninstalled "${info.name}"`;
                loadList();
              } catch (e) {
                statusBar.textContent = `Error: ${(e as Error).message}`;
                uninstallBtn.disabled = false;
              }
            });
            card.appendChild(uninstallBtn);
          }

          listDiv.appendChild(card);
        }
      } catch (e) {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      }
    }

    refreshBtn.addEventListener("click", loadList);
    loadList();
  }

  hostTab.addEventListener("click", showHostView);
  guestTab.addEventListener("click", showGuestView);
  installedTab.addEventListener("click", showInstalledView);

  showHostView();

  if (initialFile) {
    statusBar.textContent = `Reading ${initialFile}...`;
    const fs = new FileSystemAccess();
    fs.data
      .read(initialFile)
      .then(async (blob) => {
        if (!blob) {
          statusBar.textContent = `Error: could not read "${initialFile}"`;
          return;
        }
        showConfirmView(
          await blob.arrayBuffer(),
          initialFile.split("/").pop() || initialFile,
          showGuestView,
        );
      })
      .catch((e) => {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      });
  }

  setContent(hwnd, container);
}
