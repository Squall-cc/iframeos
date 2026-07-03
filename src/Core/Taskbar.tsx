import "./Taskbar.css";

import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";

import Launcher from "./Launcher";
import TaskbarClock from "./TaskbarClock";
import TaskbarOrb from "./TaskbarOrb";

const Taskbar: Component = () => {
  const [launcherOpen, setLauncherOpen] = createSignal(false);

  return (
    <>
      <Show when={launcherOpen()}>
        <Launcher />
      </Show>
      <div id="taskbar">
        <TaskbarOrb onClick={() => setLauncherOpen(!launcherOpen())} />
        <div class="windows-list" />
        <div class="tray">
          <TaskbarClock />
        </div>
      </div>
    </>
  );
};

export default Taskbar;
