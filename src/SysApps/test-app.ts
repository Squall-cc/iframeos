import { FileSystemAccess } from "../Apis/FileSystemApi";
import {
  getAllInstalledApps,
  registerClassRoot,
  CLASSES_ROOT_PREFIX,
  APPS_REG_PREFIX,
  shellSelectFile,
} from "../Apis/iSApi";
import { RegistryInstanceAccess } from "../Apis/RegistryApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 520, 450);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const header = document.createElement("div");
  header.style.cssText = "padding:8px;font-weight:600;font-size:13px;border-bottom:1px solid rgba(0,0,0,0.15);";
  header.textContent = "Feature Test App";
  container.appendChild(header);

  const log = document.createElement("div");
  log.style.cssText = "flex:1;overflow-y:auto;padding:8px;font-family:monospace;font-size:11px;white-space:pre-wrap;";
  container.appendChild(log);

  const btnBar = document.createElement("div");
  btnBar.style.cssText = "display:flex;gap:4px;padding:4px;flex-wrap:wrap;border-top:1px solid rgba(0,0,0,0.1);";
  container.appendChild(btnBar);

  setContent(hwnd, container);

  function write(msg: string) {
    const line = document.createElement("div");
    line.style.cssText = "padding:2px 0;border-bottom:1px solid rgba(0,0,0,0.03);";
    const ts = new Date().toLocaleTimeString();
    line.textContent = `[${ts}] ${msg}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function makeBtn(text: string, fn: () => void) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
    btn.addEventListener("click", fn);
    btnBar.appendChild(btn);
  }

  makeBtn("Test Registry", async () => {
    try {
      const reg = new RegistryInstanceAccess();
      const testPath = "InternalSystem/Test/feature-test";
      await reg._write(testPath, "testValue", "hello world");
      write("Wrote test key");
      const record = await reg._load(testPath);
      if (record && record.values["testValue"] === "hello world") {
        write("PASS: Registry read/write works");
      } else {
        write("FAIL: Registry read/write mismatch");
      }
      await reg._deleteKey(testPath);
      write("Cleaned up test key");
    } catch (e) {
      write(`FAIL: Registry error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test FileSystem", async () => {
    try {
      const fs = new FileSystemAccess();
      const testPath = "/test-feature.txt";
      fs.createFile(testPath);
      write("Created test file");
      const handle = fs.openFile(testPath);
      handle.write("test content");
      write("Wrote content");
      const content = await handle.read();
      if (content === "test content") {
        write("PASS: FileSystem read/write works");
      } else {
        write(`FAIL: Content mismatch - got "${content}"`);
      }
      fs.deleteFile(testPath);
      write("Cleaned up test file");
    } catch (e) {
      write(`FAIL: FileSystem error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test Shell Open", async () => {
    try {
      const { shellOpen } = await import("../Apis/iSApi");
      const result = await shellOpen("/test-feature.txt");
      write(result.handled ? `PASS: shellOpen returned` : "INFO: No handler (expected for .txt)");
      write(result.appKey ? `Associated with app: ${result.appKey}` : "No association");
    } catch (e) {
      write(`FAIL: shellOpen error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test ClassesRoot", async () => {
    try {
      const reg = new RegistryInstanceAccess();
      const txtRecord = await reg._load(`${CLASSES_ROOT_PREFIX}/.txt`);
      if (txtRecord && txtRecord.values["app"] === "editor") {
        write("PASS: ClassesRoot/.txt points to editor");
      } else {
        write("FAIL: ClassesRoot/.txt not found or wrong app");
      }
      const testRecord = await reg._load(`${CLASSES_ROOT_PREFIX}/.test`);
      if (testRecord && testRecord.values["app"] === "test-app") {
        write("PASS: ClassesRoot/.test points to test-app");
      } else {
        write("FAIL: ClassesRoot/.test not set up");
      }
    } catch (e) {
      write(`FAIL: ClassesRoot error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test Installed Apps", async () => {
    try {
      const apps = await getAllInstalledApps();
      write(`Registry lists ${apps.length} installed SPA app(s):`);
      for (const app of apps) {
        write(`  - ${app.name} (v${app.version})`);
      }
      write("PASS: getAllInstalledApps works");
    } catch (e) {
      write(`FAIL: getAllInstalledApps error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test Builtin Registry", async () => {
    try {
      const reg = new RegistryInstanceAccess();
      const builtins = ["hi", "hello", "draw", "launch", "browser", "editor", "registry-editor", "app-installer", "file-explorer", "test-app"];
      let allPass = true;
      for (const key of builtins) {
        const record = await reg._load(`${APPS_REG_PREFIX}/${key}`);
        const ok = record && record.values["manifest"];
        if (!ok) {
          write(`FAIL: ${key} not registered`);
          allPass = false;
        }
      }
      if (allPass) write("PASS: All builtin apps registered in registry");
    } catch (e) {
      write(`FAIL: Builtin registry check error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test Shell Select File", async () => {
    try {
      write("Opening file selector...");
      const path = await shellSelectFile({
        title: "Test File Selection",
        filter: { label: "Text Files", extensions: [".txt"] },
      });
      if (path) {
        write(`PASS: Selected file: ${path}`);
      } else {
        write("INFO: No file selected (cancelled)");
      }
    } catch (e) {
      write(`FAIL: shellSelectFile error - ${(e as Error).message}`);
    }
  });

  makeBtn("Test Register ClassRoot", async () => {
    try {
      await registerClassRoot(".test", "test-app", "run");
      write("Registered .test → test-app, run");
      const reg = new RegistryInstanceAccess();
      const record = await reg._load(`${CLASSES_ROOT_PREFIX}/.test`);
      if (record && record.values["app"] === "test-app") {
        write("PASS: registerClassRoot works");
      } else {
        write("FAIL: Registration not persisted");
      }
    } catch (e) {
      write(`FAIL: registerClassRoot error - ${(e as Error).message}`);
    }
  });

  write("Test app ready. Click buttons to test features.");
}
