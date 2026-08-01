// .spa runtime: installs zipped apps and loads them from the virtual
// filesystem, injecting the isapi (__API) into each module at runtime.
//
// a .spa archive is just a renamed zip containing:
//   manifest.json  - name/key/version/entryPoint/fileOpener/etc.
//   *.ts / *.js    - the app's code files (TypeScript is transpiled on load)
//
// on install the manifest goes into the registry and every file is copied
// into the VFS under /iSi/apps/{key}/. at launch the entry module is read
// from the VFS, transpiled, and evaluated inside a CommonJS wrapper whose
// factory receives the injected API bindings.

import { spawn, setWindowIcon } from "../Core/windowhelpers";

import type { RegisteredSpaManifest } from "./AppManifest";
import { getAppIconUrl } from "./appIcon";
import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";
import { unzip, findManifestEntry, type ZipEntry } from "./zip";

export const APPS_REG_PREFIX = "InternalSystem/Apps";
export const APP_INDEX_PATH = "InternalSystem/AppIndex";
export const CLASSES_ROOT_PREFIX = "InternalSystem/ClassesRoot";

const DEFAULT_ENTRY_MODULE = "main.ts";

function normalizePath(path: string): string {
  if (!path) return "/";
  const parts = path.split("/").filter(Boolean);
  const stack: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") {
      stack.pop();
      continue;
    }
    stack.push(p);
  }
  return "/" + stack.join("/");
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

// ---- TypeScript transpilation (lazy, so the big compiler is code-split) ----

let tsPromise: Promise<unknown> | undefined;

function loadTypeScript(): Promise<{ transpileModule: Function }> {
  if (!tsPromise) {
    tsPromise = import("typescript").then((m) => {
      const ts = ((m as unknown as { default?: unknown }).default ?? m) as {
        transpileModule: Function;
      };
      return ts;
    });
  }
  return tsPromise as Promise<{ transpileModule: Function }>;
}

async function compileTs(code: string, fileName: string): Promise<string> {
  const ts = await loadTypeScript();
  const result = ts.transpileModule(code, {
    fileName,
    compilerOptions: {
      target: "ES2022",
      module: "CommonJS",
      esModuleInterop: true,
      allowJs: true,
      jsx: "Preserve",
      sourceMap: false,
    },
    reportDiagnostics: false,
  });
  return result.outputText;
}

// ---- module records and evaluation ----

interface SpaModuleRecord {
  fullPath: string;
  code: string;
  exports: Record<string, unknown>;
  loaded: boolean;
}

function collectFiles(fs: FileSystemAccess, dir: string, out: string[] = []): string[] {
  for (const child of fs.listDirectory(dir)) {
    if (fs.isDirectory(child)) collectFiles(fs, child, out);
    else out.push(child);
  }
  return out;
}

async function preloadModules(appRoot: string): Promise<Map<string, SpaModuleRecord>> {
  const fs = new FileSystemAccess();
  const records = new Map<string, SpaModuleRecord>();

  for (const file of collectFiles(fs, appRoot)) {
    const code = await fs.openFile(file).read();
    if (code === undefined) continue;
    let js = code;
    if (/\.tsx?$/i.test(file)) js = await compileTs(code, file);
    records.set(file, {
      fullPath: file,
      code: js,
      exports: {},
      loaded: false,
    });
  }

  return records;
}

function resolveModule(
  records: Map<string, SpaModuleRecord>,
  appRoot: string,
  fromDir: string,
  id: string,
): string | null {
  let candidate: string;
  if (id.startsWith("/")) {
    candidate = normalizePath(id);
  } else {
    const clean = id.replace(/^\/+/, "");
    const base = id.startsWith(".") ? fromDir : appRoot;
    candidate = normalizePath(`${base}/${clean}`);
  }

  if (records.has(candidate)) return candidate;

  if (!/\.[a-z0-9]+$/i.test(id)) {
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", "/index.ts", "/index.js"]) {
      const withExt = normalizePath(candidate + ext);
      if (records.has(withExt)) return withExt;
    }
  }

  return null;
}

function pickEntry(exportsObj: Record<string, unknown>, entryFn: string): unknown {
  if (typeof exportsObj[entryFn] === "function") return exportsObj[entryFn];
  const def = exportsObj["default"];
  if (typeof def === "function") return def;
  if (def && typeof def === "object") {
    const d = def as Record<string, unknown>;
    if (typeof d[entryFn] === "function") return d[entryFn];
  }
  return undefined;
}
const INJECTED_NAMES = [
  "module",
  "exports",
  "require",
  "__API",
  "spawn",
  "WindowHandle",
  "shellOpen",
  "shellOpenWithPicker",
  "shellOpenWith",
  "shellModal",
  "shellSelectFile",
  "shellSelectDir",
  "getAllInstalledApps",
  "launchSpaApp",
];

function evaluateModule(
  records: Map<string, SpaModuleRecord>,
  appRoot: string,
  entryPath: string,
  api: Record<string, unknown>,
): Record<string, unknown> {
  function makeRequire(record: SpaModuleRecord) {
    const fromDir = dirname(record.fullPath);
    return function requireModule(id: string): unknown {
      const resolved = resolveModule(records, appRoot, fromDir, id);
      if (!resolved) {
        throw new Error(`[spa] cannot resolve module "${id}" from "${record.fullPath}"`);
      }
      const target = records.get(resolved)!;
      if (!target.loaded) {
        target.loaded = true;
        if (/\.json$/i.test(resolved)) {
          target.exports = JSON.parse(target.code) as Record<string, unknown>;
        } else {
          const moduleObj = { exports: target.exports };
          const params = [
            moduleObj,
            moduleObj.exports,
            makeRequire(target),
            api,
            api["spawn"],
            api["WindowHandle"],
            api["shellOpen"],
            api["shellOpenWithPicker"],
            api["shellOpenWith"],
            api["shellModal"],
            api["shellSelectFile"],
            api["shellSelectDir"],
            api["getAllInstalledApps"],
            api["launchSpaApp"],
          ];
          const factory = new Function(...INJECTED_NAMES, target.code) as (
            ...args: unknown[]
          ) => void;
          factory(...params);
          target.exports = (moduleObj.exports as Record<string, unknown>) ?? target.exports;
        }
      }
      return target.exports;
    };
  }

  const entry = records.get(entryPath);
  if (!entry) throw new Error(`[spa] entry module "${entryPath}" not found`);
  makeRequire(entry)(entryPath);
  return entry.exports;
}

// ---- install ----

function ensureDirs(fs: FileSystemAccess, filePath: string): void {
  const parts = filePath.split("/").filter(Boolean);
  parts.pop();
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    if (!fs.exists(cur)) fs.createDirectory(cur);
  }
}

function normalizeExtension(ext: string): string {
  const e = ext.trim().toLowerCase();
  if (!e) return "";
  return e.startsWith(".") ? e : "." + e;
}

async function extractManifest(entries: ZipEntry[]): Promise<Record<string, unknown>> {
  const manifestEntry = findManifestEntry(entries);
  if (!manifestEntry) {
    throw new Error(".spa archive must contain a manifest.json");
  }
  try {
    return JSON.parse(new TextDecoder().decode(manifestEntry.data)) as Record<string, unknown>;
  } catch {
    throw new Error("invalid manifest.json in .spa archive");
  }
}

export interface SpaArchiveInfo {
  manifest: Record<string, unknown>;
  fileAssociations: string[];
  fileCount: number;
  entries: ZipEntry[];
}

// parses a .spa archive so the installer can preview the manifest and let the
// user pick which file associations to create before installing.
export async function parseSpaArchive(bytes: ArrayBuffer): Promise<SpaArchiveInfo> {
  const entries = await unzip(bytes);
  const manifest = await extractManifest(entries);
  const rawAssoc = Array.isArray(manifest["fileassoc"])
    ? (manifest["fileassoc"] as unknown[])
    : [];
  return {
    manifest,
    fileAssociations: rawAssoc
      .filter((e): e is string => typeof e === "string")
      .map(normalizeExtension)
      .filter(Boolean),
    fileCount: entries.length,
    entries,
  };
}

export interface InstallSpaOptions {
  // extensions to associate in ClassesRoot; defaults to the manifest's
  // "fileassoc" list. only used when the app declares a fileOpener.
  fileAssociations?: string[];
}

export interface InstallProgress {
  phase: "extract" | "write" | "register";
  done: number;
  total: number;
}

export async function installSpaFromZip(
  bytes: ArrayBuffer,
  options?: InstallSpaOptions,
  onProgress?: (p: InstallProgress) => void,
): Promise<string> {
  const { manifest: raw, fileAssociations, entries } = await parseSpaArchive(bytes);
  onProgress?.({ phase: "write", done: 0, total: entries.length });

  const name = raw["name"] as string | undefined;
  const key = raw["key"] as string | undefined;
  const version = (raw["version"] as string | undefined) || "1.0.0";
  const description = (raw["description"] as string | undefined) || "";
  const entryPoint = raw["entryPoint"] as string | undefined;
  const entryModule = (raw["entryModule"] as string | undefined) || DEFAULT_ENTRY_MODULE;
  const fileOpener = raw["fileOpener"] as string | undefined;
  const fileOpenerModule = (raw["fileOpenerModule"] as string | undefined) || entryModule;
  const icon = raw["icon"] as string | undefined;
  const startMenu = raw["startMenu"] as boolean | undefined;

  if (!key || !name || !entryPoint) {
    throw new Error(".spa manifest must include 'key', 'name', and 'entryPoint'");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new Error(`invalid app key "${key}"`);
  }

  const fs = new FileSystemAccess();
  const appDir = `/iSi/apps/${key}`;

  if (fs.exists(appDir)) fs.deleteDirectoryRecursive(appDir);
  fs.createDirectory(appDir);

  let done = 0;
  for (const entry of entries) {
    const rel = entry.name.replace(/^\/+/, "");
    if (!rel || rel.toLowerCase() === "manifest.json") continue;
    const dest = normalizePath(`${appDir}/${rel}`);
    if (!dest.startsWith(`${appDir}/`)) {
      throw new Error(`unsafe path in archive: "${entry.name}"`);
    }
    ensureDirs(fs, dest);
    fs.createFile(dest);
    const blob = new Blob([entry.data as unknown as BlobPart]);
    await fs.data.write(dest, blob);
    fs.updateFileMeta(dest, blob);
    done++;
    onProgress?.({ phase: "write", done, total: entries.length });
  }

  onProgress?.({ phase: "register", done: 0, total: 0 });

  const registered: RegisteredSpaManifest = {
    name,
    key,
    version,
    description,
    type: "spa",
    entryPoint,
    entryModule,
    fileOpener,
    fileOpenerModule,
    fileassoc: fileAssociations,
    hasFileOpener: !!fileOpener,
    icon,
    startMenu,
  };

  const reg = new RegistryInstanceAccess();
  await reg._write(`${APPS_REG_PREFIX}/${key}`, "manifest", registered);

  const indexRecord = await reg._load(APP_INDEX_PATH);
  const list = (indexRecord?.values["list"] as Array<{ key: string }>) ?? [];
  if (!list.some((a) => a.key === key)) {
    //@ts-ignore
    list.push({ key, name, version, description });
    await reg._write(APP_INDEX_PATH, "list", list);
  }

  if (fileOpener) {
    const assoc = (options?.fileAssociations ?? fileAssociations)
      .map(normalizeExtension)
      .filter(Boolean);
    for (const ext of assoc) {
      await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", key);
      await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", fileOpener);
    }
  }

  return name;
}

// ---- launch ----

export async function getSpaEntryMethods(appKey: string): Promise<string[]> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  const manifest = record?.values["manifest"] as RegisteredSpaManifest | undefined;
  if (!manifest) return ["run"];

  const methods = new Set<string>();
  if (manifest.entryPoint) methods.add(manifest.entryPoint);
  if (manifest.fileOpener) methods.add(manifest.fileOpener);
  return methods.size > 0 ? [...methods] : ["run"];
}

export async function launchSpaEntry(
  appKey: string,
  entryFn: string,
  filename?: string,
): Promise<boolean> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return false;
  const manifest = record.values["manifest"] as RegisteredSpaManifest | undefined;
  if (!manifest) return false;

  const fs = new FileSystemAccess();
  const appRoot = `/iSi/apps/${appKey}`;
  if (!fs.exists(appRoot)) return false;

  let entryModule = manifest.entryModule || DEFAULT_ENTRY_MODULE;
  if (
    manifest.hasFileOpener &&
    entryFn === manifest.fileOpener &&
    manifest.fileOpenerModule &&
    manifest.fileOpenerModule !== entryModule
  ) {
    entryModule = manifest.fileOpenerModule;
  }

  let entryPath = normalizePath(`${appRoot}/${entryModule}`);
  if (!fs.isFile(entryPath)) {
    entryPath = normalizePath(`${appRoot}/${DEFAULT_ENTRY_MODULE}`);
    if (!fs.isFile(entryPath)) return false;
  }

  const api = (window as unknown as Record<string, unknown>)["__API"] as Record<
    string,
    unknown
  >;

  let records: Map<string, SpaModuleRecord>;
  let exportsObj: Record<string, unknown>;
  try {
    records = await preloadModules(appRoot);
    exportsObj = evaluateModule(records, appRoot, entryPath, api);
  } catch (e) {
    console.error(`[spa] failed to load "${appKey}":`, e);
    return false;
  }

  const fn = pickEntry(exportsObj, entryFn);
  if (typeof fn !== "function") return false;

  const WindowHandleCtor = api["WindowHandle"] as { new (hwnd: symbol): unknown } | undefined;
  const title = filename ? (filename.split("/").pop() || manifest.name) : manifest.name;
  const iconUrl = await getAppIconUrl(appKey, manifest.icon);

  spawn(title, (hwnd) => {
    setWindowIcon(hwnd, iconUrl);
    const handle = WindowHandleCtor ? new WindowHandleCtor(hwnd) : hwnd;
    try {
      if (filename) (fn as (f: string, h: unknown) => void)(filename, handle);
      else (fn as (h: unknown) => void)(handle);
    } catch (e) {
      console.error(`[spa] "${appKey}" entry "${entryFn}" failed:`, e);
    }
  });

  return true;
}
