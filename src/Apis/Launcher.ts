import { spawn, setContent } from "../Core/windowhelpers";

import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";

export function launch(code: string): void {
  (0, eval)(code);
}

export async function launchfromfile(path: string): Promise<void> {
  const fs = new FileSystemAccess();
  const handle = fs.openFile(path);
  const code = await handle.read();
  if (code === undefined) return;
  launch(code);
}

export function launchhtml(title: string, html: string): void {
  spawn(title, (hwnd) => {
    const container = document.createElement("div");
    container.innerHTML = html;
    setContent(hwnd, container);
  });
}

export type LauncherAppEntry =
  | { type: "builtin"; key: string; name: string }
  | { type: "spa"; key: string; name: string }
  | { type: "raw"; key: string; name: string };

const LAUNCHER_REGISTRY_PATH = "InternalSystem/Launcher";
const LAUNCHER_REGISTRY_VALUE = "apps";

const DEFAULT_BUILTIN_APPS: LauncherAppEntry[] = [
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

// bypasses RegistryKey's fire-and-forget getValue().value (populated async
// with no way to await it) since the launcher needs a reliable read
// old registry data can still contain internet-backed appstore entries
type LegacyLauncherAppEntry =
  | LauncherAppEntry
  | { type: "appstore"; url: string; name: string };

export async function getLauncherApps(): Promise<LauncherAppEntry[]> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(LAUNCHER_REGISTRY_PATH);
  const existing = record?.values[LAUNCHER_REGISTRY_VALUE] as
    | LegacyLauncherAppEntry[]
    | undefined;

  if (existing) {
    // drop the old internet-backed appstore entries
    const cleaned = existing.filter((a) => a.type !== "appstore") as LauncherAppEntry[];
    let changed = cleaned.length !== existing.length;
    for (const builtin of DEFAULT_BUILTIN_APPS) {
      const idx = cleaned.findIndex((a) => a.key === builtin.key);
      if (idx === -1) {
        cleaned.push(builtin);
        changed = true;
      } else if (cleaned[idx].name !== builtin.name) {
        // renames: update the existing entry (e.g. "App Installer" -> "App Manager")
        cleaned[idx] = builtin;
        changed = true;
      }
    }
    // collapse duplicate keys (keep the first occurrence)
    const seen = new Set<string>();
    const deduped = cleaned.filter((a) => {
      if (seen.has(a.key)) return false;
      seen.add(a.key);
      return true;
    });
    if (deduped.length !== cleaned.length) changed = true;
    if (changed) {
      await reg._write(LAUNCHER_REGISTRY_PATH, LAUNCHER_REGISTRY_VALUE, deduped);
    }
    return deduped;
  }

  // first run: seed the registry with the built-in apps
  await reg._write(
    LAUNCHER_REGISTRY_PATH,
    LAUNCHER_REGISTRY_VALUE,
    DEFAULT_BUILTIN_APPS,
  );
  return DEFAULT_BUILTIN_APPS;
}
