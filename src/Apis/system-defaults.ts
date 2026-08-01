// the single source of truth for what a freshly reset system looks like.
// seedDefaults() is called on every boot so a brand new (or wiped) profile
// gets the default directories, builtin app manifests, file associations,
// launcher contents, desktop layout, and theme. resetSystem() wipes the
// registry + filesystem and then re-seeds everything.

import type { LauncherAppEntry } from "./Launcher";
import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";

export const APPS_REG_PREFIX = "InternalSystem/Apps";
export const CLASSES_ROOT_PREFIX = "InternalSystem/ClassesRoot";
export const APP_INDEX_PATH = "InternalSystem/AppIndex";
export const LAUNCHER_REGISTRY_PATH = "InternalSystem/Launcher";
export const LAUNCHER_REGISTRY_VALUE = "apps";
export const THEME_PATH = "InternalSystem/Settings/ctheme";
export const THEME_BKG_VALUE = "curbkg";
export const WALLPAPERS_DIR = "/iSi/theming/wallpapers";
export const DESKTOP_PATH = "/desktop";
export const DESKTOP_JSON = "/desktop/desktop.json";

export const DEFAULT_DIRECTORIES = [
  "/documents",
  "/downloads",
  "/iSi",
  "/iSi/theming",
  "/iSi/theming/wallpapers",
  "/iSi/apps",
  "/iSi/js",
  "/pictures",
  "/videos",
  "/3dobjects",
  "/desktop",
  "/trash",
];

export interface BuiltinAppDef {
  key: string;
  name: string;
  description: string;
  hasFileOpener?: boolean;
  startMenu?: boolean;
  icon?: string;
}

export const BUILTIN_APPS: BuiltinAppDef[] = [
  { key: "hi", name: "hi", description: "Example iframe app", startMenu: false },
  { key: "hello", name: "hello", description: "Canvas hello world", startMenu: false },
  { key: "draw", name: "draw", description: "Pointer painting app", icon: "draw.png" },
  { key: "launch", name: "launch", description: "Code runner", startMenu: false },
  { key: "browser", name: "browser", description: "Web browser" },
  { key: "editor", name: "Text Editor", description: "Built-in text editor", hasFileOpener: true },
  { key: "registry-editor", name: "Registry Editor", description: "Registry editor" },
  { key: "app-installer", name: "App Manager", description: "Install, configure, and uninstall apps", hasFileOpener: true },
  { key: "file-explorer", name: "File Explorer", description: "Browse files", hasFileOpener: true },
  { key: "test-app", name: "Test App", description: "Tests all features", startMenu: false },
  { key: "control-panel", name: "Control Panel", description: "System settings and reset" },
];

export const DEFAULT_LAUNCHER_APPS: LauncherAppEntry[] = [
  { type: "builtin", key: "hi", name: "hi" },
  { type: "builtin", key: "hello", name: "hello" },
  { type: "builtin", key: "draw", name: "draw" },
  { type: "builtin", key: "launch", name: "launch" },
  { type: "builtin", key: "browser", name: "browser" },
  { type: "builtin", key: "editor", name: "Text Editor" },
  { type: "builtin", key: "registry-editor", name: "Registry Editor" },
  { type: "builtin", key: "app-installer", name: "App Manager" },
  { type: "builtin", key: "file-explorer", name: "File Explorer" },
  { type: "builtin", key: "test-app", name: "Test App" },
  { type: "builtin", key: "control-panel", name: "Control Panel" },
];

export const DEFAULT_CLASS_ROOTS: { ext: string; app: string; entry: string }[] = [
  { ext: ".txt", app: "editor", entry: "editFile" },
  { ext: ".test", app: "test-app", entry: "run" },
  { ext: ".spa", app: "app-installer", entry: "openFile" },
];

export interface DesktopIcon {
  app: string;
  name: string;
  x: number;
  y: number;
}

export const DEFAULT_DESKTOP_ICONS: DesktopIcon[] = [
  { app: "editor", name: "Text Editor", x: 16, y: 16 },
  { app: "file-explorer", name: "File Explorer", x: 16, y: 112 },
  { app: "browser", name: "Browser", x: 16, y: 208 },
  { app: "registry-editor", name: "Registry Editor", x: 16, y: 304 },
  { app: "app-installer", name: "App Manager", x: 16, y: 400 },
  { app: "draw", name: "Draw", x: 16, y: 496 },
  { app: "control-panel", name: "Control Panel", x: 16, y: 592 },
];

async function writeBuiltinManifests(reg: RegistryInstanceAccess): Promise<void> {
  for (const app of BUILTIN_APPS) {
    await reg._write(`${APPS_REG_PREFIX}/${app.key}`, "manifest", {
      name: app.name,
      key: app.key,
      version: "1.0.0",
      description: app.description,
      type: "builtin",
      hasFileOpener: !!app.hasFileOpener,
      startMenu: app.startMenu ?? true,
      icon: app.icon ?? null,
    });
  }
}

async function writeClassRoots(reg: RegistryInstanceAccess): Promise<void> {
  for (const { ext, app, entry } of DEFAULT_CLASS_ROOTS) {
    await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", app);
    await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", entry);
  }
}

async function writeLauncherDefaults(reg: RegistryInstanceAccess): Promise<void> {
  const record = await reg._load(LAUNCHER_REGISTRY_PATH);
  if (!record || !record.values[LAUNCHER_REGISTRY_VALUE]) {
    await reg._write(LAUNCHER_REGISTRY_PATH, LAUNCHER_REGISTRY_VALUE, DEFAULT_LAUNCHER_APPS);
  }
}

async function writeThemeDefault(reg: RegistryInstanceAccess): Promise<void> {
  const record = await reg._load(THEME_PATH);
  if (!record || !record.values[THEME_BKG_VALUE]) {
    await reg._write(THEME_PATH, THEME_BKG_VALUE, "default0");
  }
}

async function writeAppIndexDefault(reg: RegistryInstanceAccess): Promise<void> {
  const record = await reg._load(APP_INDEX_PATH);
  if (!record || !record.values["list"]) {
    await reg._write(APP_INDEX_PATH, "list", []);
  }
}

function seedDirectories(fs: FileSystemAccess): void {
  for (const dir of DEFAULT_DIRECTORIES) {
    if (!fs.exists(dir)) fs.createDirectory(dir);
  }
}

function seedDesktopFile(fs: FileSystemAccess): void {
  if (!fs.isFile(DESKTOP_JSON)) {
    fs.createFile(DESKTOP_JSON);
    fs.openFile(DESKTOP_JSON).write(
      JSON.stringify({ icons: DEFAULT_DESKTOP_ICONS }, null, 2),
    );
  }
}

// idempotent boot-time seeding: creates default dirs, writes the builtin app
// manifests, class roots, and first-run registry values.
export async function seedDefaults(): Promise<void> {
  const reg = new RegistryInstanceAccess();
  const fs = new FileSystemAccess();

  seedDirectories(fs);
  seedDesktopFile(fs);
  await writeBuiltinManifests(reg);
  await writeClassRoots(reg);
  await writeLauncherDefaults(reg);
  await writeThemeDefault(reg);
  await writeAppIndexDefault(reg);
}

// wipes every registry record and every filesystem entry (except the default
// directories), re-seeds defaults, and reloads the page so the shell boots
// into a clean state.
export async function resetSystem(): Promise<void> {
  const reg = new RegistryInstanceAccess();
  await reg._load("");

  const tx = reg._db.transaction("registry", "readonly");
  const store = tx.objectStore("registry");
  const allRecs = await new Promise<{ path: string }[]>((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as { path: string }[]);
    req.onerror = () => resolve([]);
  });
  for (const rec of allRecs) {
    await reg._deleteKey(rec.path);
  }

  const fs = new FileSystemAccess();
  fs.resetToDirectories(DEFAULT_DIRECTORIES);

  await seedDefaults();
  window.location.reload();
}
