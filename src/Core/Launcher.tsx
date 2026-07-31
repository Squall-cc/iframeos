import "./Launcher.css";

import type { Component } from "solid-js";
import { createResource, For, onCleanup, onMount } from "solid-js";

import * as launcherApi from "../Apis/Launcher";
import type { LauncherAppEntry } from "../Apis/Launcher";
import { getAllInstalledApps, getInstalledAppType, launchRawApp, launchSpaApp } from "../Apis/iSApi";
import appInstaller from "../SysApps/app-installer";
import browser from "../SysApps/browser";
import controlPanel from "../SysApps/control-panel";
import draw from "../SysApps/draw";
import editor from "../SysApps/editor";
import fileExplorer from "../SysApps/file-explorer";
import hello from "../SysApps/hello";
import hi from "../SysApps/hi";
import launch from "../SysApps/launch";
import registryEditor from "../SysApps/registry-editor";
import testApp from "../SysApps/test-app";

import { spawn } from "./windowhelpers";

const builtinApps = new Map([
  ["hi", hi],
  ["hello", hello],
  ["draw", draw],
  ["launch", launch],
  ["browser", browser],
  ["editor", editor],
  ["registry-editor", registryEditor],
  ["app-installer", appInstaller],
  ["file-explorer", fileExplorer],
  ["test-app", testApp],
  ["control-panel", controlPanel],
]);

async function getAllApps(): Promise<LauncherAppEntry[]> {
  const registryApps = await launcherApi.getLauncherApps();
  const indexApps = await getAllInstalledApps();
  for (const app of indexApps) {
    if (registryApps.some((a) => a.key === app.key)) continue;
    const type = await getInstalledAppType(app.key);
    registryApps.push({
      type: type === "raw" ? "raw" : "spa",
      key: app.key,
      name: app.name,
    });
  }
  return registryApps;
}

function open(entry: LauncherAppEntry, onClose?: () => void) {
  if (entry.type === "builtin") {
    const run = builtinApps.get(entry.key);
    if (run) spawn(entry.name, run);
    onClose?.();
    return;
  }
  if (entry.type === "spa") {
    launchSpaApp(entry.key);
    onClose?.();
    return;
  }
  if (entry.type === "raw") {
    launchRawApp(entry.key);
    onClose?.();
    return;
  }
}

interface LauncherProps {
  onClose?: () => void;
}

const Launcher: Component<LauncherProps> = (props) => {
  const [apps] = createResource(getAllApps);
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
