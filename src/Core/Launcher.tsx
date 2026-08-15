import "./Launcher.css";

import type { Component } from "solid-js";
import { createMemo, createResource, createSignal, For, Show, onCleanup, onMount } from "solid-js";

import { getAppIconUrl } from "../Apis/appIcon";
import { APP_DRAG_MIME } from "../Apis/DesktopApi";
import { getAppInfo, getAllInstalledApps, getInstalledAppType, launchRawApp, launchSpaApp } from "../Apis/iSApi";
import * as launcherApi from "../Apis/Launcher";
import type { LauncherAppEntry } from "../Apis/Launcher";
import appInstaller from "../SysApps/app-installer";
import browser from "../SysApps/browser";
import cloud from "../SysApps/cloud";
import controlPanel from "../SysApps/control-panel";
import draw from "../SysApps/draw";
import editor from "../SysApps/editor";
import fileExplorer from "../SysApps/file-explorer";
import games from "../SysApps/games";
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
  ["games", games],
  ["cloud", cloud],
]);

interface LauncherItem {
  type: string;
  key: string;
  name: string;
  startMenu: boolean;
}

async function getAllApps(): Promise<LauncherItem[]> {
  const registryApps: LauncherAppEntry[] = await launcherApi.getLauncherApps();
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

  const items: LauncherItem[] = [];
  for (const entry of registryApps) {
    const info = await getAppInfo(entry.key);
    items.push({
      type: entry.type,
      key: entry.key,
      name: entry.name,
      startMenu: info?.startMenu ?? true,
    });
  }
  return items.filter((i) => i.startMenu);
}

function open(entry: LauncherItem, onClose?: () => void) {
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
  const [query, setQuery] = createSignal("");
  let launcherRef!: HTMLDivElement;
  let searchRef!: HTMLInputElement;

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const list = apps() ?? [];
    if (!q) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q) || a.key.toLowerCase().includes(q));
  });

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
    searchRef?.focus();

    onCleanup(() => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    });
  });

  return (
    <div id="launcher" ref={launcherRef}>
      <div class="launcher-search">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search apps..."
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <div class="launcher-grid">
        <Show when={filtered().length === 0} fallback={<For each={filtered()}>{(entry) => <LauncherButton entry={entry} onOpen={() => open(entry, props.onClose)} />}</For>}>
          <div class="launcher-empty">No apps found</div>
        </Show>
      </div>
    </div>
  );
};

function LauncherButton(props: { entry: LauncherItem; onOpen: () => void }) {
  const [iconUrl, setIconUrl] = createSignal<string | undefined>(undefined);
  onMount(async () => {
    setIconUrl(await getAppIconUrl(props.entry.key, undefined));
  });

  return (
    <button
      class="launcher-app"
      onClick={props.onOpen}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer!.setData(APP_DRAG_MIME, props.entry.key);
        e.dataTransfer!.setData("text/plain", props.entry.name);
        e.dataTransfer!.effectAllowed = "copy";
      }}
    >
      <Show when={iconUrl()}>
        <img src={iconUrl()} alt="" draggable={false} />
      </Show>
      <span>{props.entry.name}</span>
    </button>
  );
}

export default Launcher;
