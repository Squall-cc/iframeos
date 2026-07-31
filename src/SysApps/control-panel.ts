import { CLASSES_ROOT_PREFIX, APPS_REG_PREFIX, shellModal } from "../Apis/iSApi";
import { RegistryInstanceAccess } from "../Apis/RegistryApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 450, 300);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;gap:8px;padding:12px;box-sizing:border-box;";

  const header = document.createElement("div");
  header.style.cssText = "font-weight:600;font-size:14px;margin-bottom:4px;";
  header.textContent = "Control Panel";
  container.appendChild(header);

  const desc = document.createElement("div");
  desc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:12px;";
  desc.textContent = "Manage system settings and reset configuration.";
  container.appendChild(desc);

  const resetSection = document.createElement("div");
  resetSection.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid rgba(200,0,0,0.2);border-radius:4px;background:rgba(200,0,0,0.03);";

  const resetHeader = document.createElement("div");
  resetHeader.style.cssText = "font-weight:600;font-size:12px;color:#c00;";
  resetHeader.textContent = "Reset System";
  resetSection.appendChild(resetHeader);

  const resetDesc = document.createElement("div");
  resetDesc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:8px;";
  resetDesc.textContent = "Removes all installed SPA apps and resets file associations to defaults. Built-in apps (editor, file explorer, etc.) will remain.";
  resetSection.appendChild(resetDesc);

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset to Defaults";
  resetBtn.style.cssText = "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(200,0,0,0.5);border-radius:2px;background:rgba(200,0,0,0.1);font-weight:600;align-self:flex-start;";
  resetBtn.addEventListener("click", async () => {
    const confirm = await shellModal("yesno", hwnd, "Confirm Reset", "This will remove all installed SPA apps and reset file associations to system defaults. Built-in apps will not be affected. Continue?");
    if (confirm !== "yes") return;

    const confirm2 = await shellModal("yesno", hwnd, "Are You Sure?", "All installed SPA apps will be permanently deleted. This cannot be undone.");
    if (confirm2 !== "yes") return;

    resetBtn.disabled = true;
    resetBtn.textContent = "Resetting...";

    try {
      const reg = new RegistryInstanceAccess();
      await reg._load("");

      const tx = reg._db.transaction("registry", "readonly");
      const store = tx.objectStore("registry");
      const allRecs = await new Promise<{ path: string }[]>((resolve) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as { path: string }[]);
        req.onerror = () => resolve([]);
      });

      const builtinKeys = [
        "hi", "hello", "draw", "launch", "browser",
        "editor", "registry-editor", "app-installer",
        "file-explorer", "test-app", "control-panel",
      ];

      for (const rec of allRecs) {
        if (rec.path.startsWith(`${APPS_REG_PREFIX}/`)) {
          const key = rec.path.slice(APPS_REG_PREFIX.length + 1);
          if (key && !builtinKeys.includes(key)) {
            await reg._deleteKey(rec.path);
          }
        }
      }

      await reg._write("InternalSystem/AppIndex", "list", []);

      for (const rec of allRecs) {
        if (rec.path.startsWith(CLASSES_ROOT_PREFIX)) {
          await reg._deleteKey(rec.path);
        }
      }

      await reg._write(`${CLASSES_ROOT_PREFIX}/.txt`, "app", "editor");
      await reg._write(`${CLASSES_ROOT_PREFIX}/.txt`, "entry", "editFile");
      await reg._write(`${CLASSES_ROOT_PREFIX}/.test`, "app", "test-app");
      await reg._write(`${CLASSES_ROOT_PREFIX}/.test`, "entry", "run");

      const { FileSystemAccess } = await import("../Apis/FileSystemApi");
      const fs = new FileSystemAccess();
      const appDir = "/iSi/apps";
      const entries = fs.listDirectory(appDir).filter((p) => p !== appDir);
      for (const entry of entries) {
        if (fs.isDirectory(entry)) {
          fs.deleteDirectoryRecursive(entry);
        } else {
          fs.deleteFile(entry);
        }
      }

      await shellModal("info", hwnd, "Reset Complete", "System has been reset to defaults. Only built-in apps and the default .txt / .test file associations remain.");
    } catch (e) {
      await shellModal("error", hwnd, "Reset Failed", `An error occurred: ${(e as Error).message}`);
    }

    resetBtn.disabled = false;
    resetBtn.textContent = "Reset to Defaults";
  });

  resetSection.appendChild(resetBtn);
  container.appendChild(resetSection);

  setContent(hwnd, container);
}