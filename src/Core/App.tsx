import { For, Show, onMount, type Component } from "solid-js";

import "./App.css";
import * as iSApi from "../Apis/iSApi";
import { CLASSES_ROOT_PREFIX, APPS_REG_PREFIX } from "../Apis/iSApi";

import { setOverlayContext } from "./overlay";
import { setWisp } from "./systems";
import Taskbar from "./Taskbar";
import Window from "./Window";
import {
  windows,
  closeWindow,
  minimize,
  bringupwards,
  toggleMaximize,
  debug123,
} from "./windowhelpers";

const BUILTIN_APPS = [
  { key: "hi", name: "hi", description: "Example iframe app" },
  { key: "hello", name: "hello", description: "Canvas hello world" },
  { key: "draw", name: "draw", description: "Pointer painting app" },
  { key: "launch", name: "launch", description: "Code runner" },
  { key: "browser", name: "browser", description: "Web browser" },
  { key: "editor", name: "Text Editor", description: "Built-in text editor", hasFileOpener: true },
  { key: "registry-editor", name: "Registry Editor", description: "Registry editor" },
  { key: "app-installer", name: "App Manager", description: "Install, configure, and uninstall apps" },
  { key: "file-explorer", name: "File Explorer", description: "Browse files" },
  { key: "test-app", name: "Test App", description: "Tests all features" },
  { key: "control-panel", name: "Control Panel", description: "System settings and reset" },
];

const App: Component = () => {
  setWisp("wss://anura.pro/");
  let fsacc = new iSApi.FileSystemAccess();
  let listofthingstocreateonstartup = [
    "/documents",
    "/downloads",
    "/iSi",
    "/iSi/theming",
    "/iSi/apps",
    "/iSi/js",
    "/pictures",
    "/videos",
    "/3dobjects",
  ];

  listofthingstocreateonstartup.forEach((dir) => {
    if (!fsacc.exists(dir)) {
      fsacc.createDirectory(dir);
    }
  });

  const reg = new iSApi.RegistryInstanceAccess();

  reg._load(`${CLASSES_ROOT_PREFIX}/.txt`).then((existing) => {
    if (!existing) {
      reg._write(`${CLASSES_ROOT_PREFIX}/.txt`, "app", "editor");
      reg._write(`${CLASSES_ROOT_PREFIX}/.txt`, "entry", "editFile");
    }
  });
  reg._load(`${CLASSES_ROOT_PREFIX}/.test`).then((existing) => {
    if (!existing) {
      reg._write(`${CLASSES_ROOT_PREFIX}/.test`, "app", "test-app");
      reg._write(`${CLASSES_ROOT_PREFIX}/.test`, "entry", "run");
    }
  });

  for (const app of BUILTIN_APPS) {
    const path = `${APPS_REG_PREFIX}/${app.key}`;
    reg._load(path).then((existing) => {
      const manifest = existing?.values["manifest"] as
        | { type?: string; hasFileOpener?: boolean }
        | undefined;
      if (!existing || manifest?.type !== "builtin") {
        reg._write(path, "manifest", {
          name: app.name,
          key: app.key,
          version: "1.0.0",
          description: app.description,
          type: "builtin",
          hasFileOpener: !!app.hasFileOpener,
        });
      }
    });
  }

  reg._load("InternalSystem/AppIndex").then((existing) => {
    if (!existing) {
      reg._write("InternalSystem/AppIndex", "list", []);
    }
  });

  let overlay!: HTMLCanvasElement;

  onMount(() => {
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    setOverlayContext(overlay.getContext("2d")!);
  });
  let db = new iSApi.RegistryInstanceAccess();
  if (!db.getKey("InternalSystem/Settings/ctheme").getValue("curbkg").value) {
    db.getKey("InternalSystem/Settings/ctheme").setValue("curbkg", "default0");
  }
  const activeWindow = () => {
    let maxZ = -1;
    let active: symbol | null = null;
    for (const w of windows) {
      if (w.z > maxZ && !w.minimized) {
        maxZ = w.z;
        active = w.hwnd;
      }
    }
    return active;
  };

  return (
    <>
      <div id="wallpaper" />
      <canvas id="overlay" ref={overlay} />
      <For each={windows}>
        {(w) => (
          <Show when={!w.minimized}>
            <Window
              hwnd={w.hwnd}
              title={w.title}
              zIndex={w.z}
              maximized={w.maximized}
              minWidth={w.minWidth}
              minHeight={w.minHeight}
              active={w.hwnd === activeWindow()}
              onclose={() => closeWindow(w.hwnd)}
              onminimize={() => minimize(w.hwnd)}
              onmaximize={() => toggleMaximize(w.hwnd)}
              onfocus={() => bringupwards(w.hwnd)}
            >
              {w.content}
            </Window>
          </Show>
        )}
      </For>
      <Taskbar />
    </>
  );
};
debug123();
export default App;
