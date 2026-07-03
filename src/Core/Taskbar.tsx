import "./Taskbar.css";

import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";

import Launcher from "./Launcher";
import { windows, bringupwards } from "./windowhelpers";

const Taskbar: Component = () => {
  const [launcherOpen, setLauncherOpen] = createSignal(false);

  return (
    <>
      <Show when={launcherOpen()}>
        <Launcher />
      </Show>
      <div id="taskbar">
        <button onClick={() => setLauncherOpen(!launcherOpen())}>apps</button>
        <For each={windows}>
          {(w) => (
            <button onClick={() => bringupwards(w.hwnd)}>{w.title}</button>
          )}
        </For>
      </div>
    </>
  );
};

export default Taskbar;
