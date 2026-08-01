import { For, Show, onMount, type Component } from "solid-js";

import "./App.css";
import { seedDefaults } from "../Apis/system-defaults";

import { setOverlayContext } from "./overlay";
import { setWisp } from "./systems";
import { applyWallpaperFromRegistry } from "./wallpaper";
import Desktop from "./Desktop";
import Taskbar from "./Taskbar";
import Window from "./Window";
import {
  windows,
  closeWindow,
  minimize,
  bringupwards,
  toggleMaximize,
} from "./windowhelpers";

const App: Component = () => {
  setWisp("wss://anura.pro/");

  seedDefaults();
  applyWallpaperFromRegistry();

  let overlay!: HTMLCanvasElement;

  onMount(() => {
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    setOverlayContext(overlay.getContext("2d")!);
  });

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
      <Desktop />
      <For each={windows}>
        {(w) => (
          <Show when={w.modal}>
            <div class="modal-blocker" style={{ "z-index": w.z - 1 }} />
          </Show>
        )}
      </For>
      <For each={windows}>
        {(w) => (
          <Window
            hwnd={w.hwnd}
            title={w.title}
            zIndex={w.z}
            maximized={w.maximized}
            minimized={w.minimized}
            modal={w.modal}
            parent={w.parent}
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
        )}
      </For>
      <Taskbar />
    </>
  );
};
export default App;
