// we are releasing ASAP
// ts vibecoded idgaf
// synapse used for games for same reason

//@ts-nocheck
import { libcurl } from "libcurl.js/bundled";

import { setContent, spawn } from "../Core/windowhelpers";

import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";
import { attachsjFrame } from "./scramjet";
import { fstransport } from "./scramjet/fstransport";

const APPS_LIST_URL = "https://cdn.jsdelivr.net/gh/Squall-cc/apps@main/apps.txt";

const LAUNCHER_REGISTRY_PATH = "InternalSystem/Launcher";
const LAUNCHER_REGISTRY_VALUE = "apps";

export type LauncherAppEntry =
  | { type: "builtin"; key: string; name: string }
  | { type: "appstore"; url: string; name: string };

const DEFAULT_BUILTIN_APPS: LauncherAppEntry[] = [
  { type: "builtin", key: "hi", name: "hi" },
  { type: "builtin", key: "hello", name: "hello" },
  { type: "builtin", key: "draw", name: "draw" },
  { type: "builtin", key: "launch", name: "launch" },
  { type: "builtin", key: "browser", name: "browser" },
];

// bypasses RegistryKey's fire-and-forget getValue().value (populated async
// with no way to await it) since the launcher needs a reliable read
export async function getLauncherApps(): Promise<LauncherAppEntry[]> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(LAUNCHER_REGISTRY_PATH);
  const existing = record?.values[LAUNCHER_REGISTRY_VALUE] as
    | LauncherAppEntry[]
    | undefined;

  if (existing) return existing;

  // first run: seed the registry with the built-in apps
  await reg._write(
    LAUNCHER_REGISTRY_PATH,
    LAUNCHER_REGISTRY_VALUE,
    DEFAULT_BUILTIN_APPS,
  );
  return DEFAULT_BUILTIN_APPS;
}

async function addLauncherApp(entry: LauncherAppEntry): Promise<void> {
  const apps = await getLauncherApps();
  if (apps.some((a) => a.name === entry.name)) return;
  const reg = new RegistryInstanceAccess();
  await reg._write(LAUNCHER_REGISTRY_PATH, LAUNCHER_REGISTRY_VALUE, [
    ...apps,
    entry,
  ]);
}

let ready: Promise<void> | undefined;

function ensureReady() {
  if (!ready)
    //bundled normalize
    ready = Promise.resolve(libcurl.load_wasm()).then(() => {});
  return ready;
}

export interface AppListing {
  url: string;
  name: string;
}

// each line: "<url> -<app name>"
// "https://cdn.jsdelivr.net/gh/Squall-cc/apps@main/synapse/index.html -games"
function parseAppsList(text: string): AppListing[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(" -");
      if (idx === -1) return null;
      return {
        url: line.slice(0, idx).trim(),
        name: line.slice(idx + 2).trim(),
      };
    })
    .filter((entry): entry is AppListing => entry !== null);
}

// pulled over wisp with libcurl
export async function listApps(): Promise<AppListing[]> {
  await ensureReady();
  const res = await libcurl.fetch(APPS_LIST_URL);
  return parseAppsList(await res.text());
}

export async function downloadApp(url: string): Promise<string> {
  await ensureReady();
  const res = await libcurl.fetch(url);
  return res.text();
}

const APPS_DIR = "/apps";

function appPath(name: string): string {
  const safe = name.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
  return `${APPS_DIR}/${safe}/index.html`;
}

// apps are selfcontained htmls
export function launchApp(entry: AppListing): void {
  const path = appPath(entry.name);

  spawn(entry.name, (hwnd) => {
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    setContent(hwnd, iframe);

    const save = downloadApp(entry.url).then(async (html) => {
      const fs = new FileSystemAccess();
      if (!fs.exists(path)) fs.createFile(path);
      await fs.data.write(path, html);
      fs.updateFileMeta(path, html);
    });
    const attach = attachsjFrame(iframe, new fstransport());

    Promise.all([save, attach]).then(([, frame]) => {
      frame.go(`https://aspen/filesystem${path}`);
    });
  });
}

export async function launchAppByName(name: string): Promise<void> {
  const apps = await listApps();
  const entry = apps.find((a) => a.name === name);
  if (!entry) throw new Error(`no app named "${name}"`);
  launchApp(entry);
}

// adds one app store listing onto the launcher's registry-backed app list
export async function installApp(entry: AppListing): Promise<void> {
  await addLauncherApp({ type: "appstore", url: entry.url, name: entry.name });
}

// fetches apps.txt and installs everything onto the launcher in one go
export async function installAllApps(): Promise<AppListing[]> {
  const apps = await listApps();
  for (const app of apps) await installApp(app);
  return apps;
}
