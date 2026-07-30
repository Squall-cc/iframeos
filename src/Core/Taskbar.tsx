import "./Taskbar.css";

import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";

import Launcher from "./Launcher";
import TaskbarClock from "./TaskbarClock";
import TaskbarOrb from "./TaskbarOrb";
import { windows, bringupwards, minimize } from "./windowhelpers";

const Taskbar: Component = () => {
  const [launcherOpen, setLauncherOpen] = createSignal(false);

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

  const handleClick = (hwnd: symbol, minimized: boolean, isActive: boolean) => {
    if (minimized) {
      bringupwards(hwnd);
    } else if (isActive) {
      minimize(hwnd);
    } else {
      bringupwards(hwnd);
    }
  };

  return (
    <>
      <Show when={launcherOpen()}>
        <Launcher onClose={() => setLauncherOpen(false)} />
      </Show>
      <div id="taskbar">
        <TaskbarOrb onClick={() => setLauncherOpen(!launcherOpen())} />
        <div class="windows-list">
          <For each={windows}>
            {(w) => {
              const isActive = w.hwnd === activeWindow();
              return (
                <button
                  class="taskbar-window"
                  classList={{ active: isActive, minimized: w.minimized }}
                  onClick={() => handleClick(w.hwnd, w.minimized, isActive)}
                >
                  {w.title}
                </button>
              );
            }}
          </For>
        </div>
        <div class="tray">
          <TaskbarClock />
        </div>
      </div>
    </>
  );
};

export default Taskbar;
