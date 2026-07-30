import { For, Show, onMount, type Component } from "solid-js";

import "./App.css";
import * as appStore from "../Apis/AppStore";
import * as iSApi from "../Apis/iSApi";

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

const App: Component = () => {
  setWisp("wss://anura.pro/");
  appStore.installAllApps().catch((e) => console.error("app store sync failed:", e));
  let fsacc = new iSApi.FileSystemAccess();
  let listofthingstocreateonstartup = [
    "/documents",
    "/downloads",
    "/iSi",
    "/iSi/theming",
    "/pictures",
    "/videos",
    "/3dobjects",
  ];

  listofthingstocreateonstartup.forEach((v, i) => {
    if (!fsacc.exists(v)) {
      fsacc.createDirectory(v);
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
  if (
    db.getKey("InternalSystem/Settings/ctheme").getValue("curbkg").value ==
    "default0"
  ) {
    ("");
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
