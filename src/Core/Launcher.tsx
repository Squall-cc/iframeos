import "./Launcher.css";

import type { Component } from "solid-js";
import { createResource, For } from "solid-js";

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

function open(entry: LauncherAppEntry) {
  if (entry.type === "builtin") {
    const run = builtinApps.get(entry.key);
    if (run) spawn(entry.name, run);
    return;
  }
  appStore.launchApp(entry);
}

const Launcher: Component = () => {
  const [apps] = createResource(appStore.getLauncherApps);

  return (
    <div id="launcher">
      <For each={apps() ?? []}>
        {(entry) => <button onClick={() => open(entry)}>{entry.name}</button>}
      </For>
    </div>
  );
};

export default Launcher;
