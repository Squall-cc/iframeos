import "./Launcher.css";

import type { Component } from "solid-js";
import { createResource, For, onCleanup, onMount } from "solid-js";

import * as appStore from "../Apis/AppStore";
import type { LauncherAppEntry } from "../Apis/AppStore";
import browser from "../SysApps/browser";
import draw from "../SysApps/draw";
import hello from "../SysApps/hello";
import hi from "../SysApps/hi";
import launch from "../SysApps/launch";

import { spawn } from "./windowhelpers";

// registry only stores serializable app entries, so builtins are resolved
// back to their real run functions through this local map
const builtinApps = new Map([
  ["hi", hi],
  ["hello", hello],
  ["draw", draw],
  ["launch", launch],
  ["browser", browser],
]);

function open(entry: LauncherAppEntry, onClose?: () => void) {
  if (entry.type === "builtin") {
    const run = builtinApps.get(entry.key);
    if (run) spawn(entry.name, run);
    onClose?.();
    return;
  }
  appStore.launchApp(entry);
  onClose?.();
}

interface LauncherProps {
  onClose?: () => void;
}

const Launcher: Component<LauncherProps> = (props) => {
  const [apps] = createResource(appStore.getLauncherApps);
  let launcherRef!: HTMLDivElement;

  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (launcherRef && !launcherRef.contains(e.target as Node)) {
        props.onClose?.();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose?.();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    onCleanup(() => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    });
  });

  return (
    <div id="launcher" ref={launcherRef}>
      <For each={apps() ?? []}>
        {(entry) => (
          <button onClick={() => open(entry, props.onClose)}>
            {entry.name}
          </button>
        )}
      </For>
    </div>
  );
};

export default Launcher;
