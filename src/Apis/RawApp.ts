// raw (html) apps: plain HTML pages defined in a manifest, installed into the
// virtual filesystem and launched through the scramjet filesystem transport —
// the same mechanism the app store used, except served from the VFS instead of
// fetched from the internet.
//
// a raw app manifest lives at /iSi/apps/{key}/manifest.json:
//   {
//     "name": "...",
//     "key": "...",
//     "version": "1.0.0",
//     "description": "...",
//     "type": "raw",
//     "entryModule": "index.html",   // html file loaded when the app runs
//     "handlerModule": "handler.html", // html file loaded to open files
//     "fileassoc": [".test1", ".test2"]
//   }
//
// there are no handler *functions*: entryModule and handlerModule are just html
// files, and when a file is opened the handler is loaded with the file path
// passed as ?file=/path/to/file. the app reads it with isapi.getFileArg().

import { spawn, setContent, windowsmap } from "../Core/windowhelpers";

import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";
import { attachsjFrame } from "./scramjet";
import { fstransport } from "./scramjet/fstransport";
import { unzip, findManifestEntry, type ZipEntry } from "./zip";

export const APPS_REG_PREFIX = "InternalSystem/Apps";
export const APP_INDEX_PATH = "InternalSystem/AppIndex";
export const CLASSES_ROOT_PREFIX = "InternalSystem/ClassesRoot";

export interface InstallProgress {
  phase: "extract" | "write" | "register";
  done: number;
  total: number;
}

const DEFAULT_ENTRY = "index.html";

export interface RawManifest {
  name: string;
  key: string;
  version: string;
  description: string;
  type?: "raw";
  // html file launched when the app is run (default: index.html)
  entryModule?: string;
  // html file launched to open files (default: entryModule); the file path is
  // passed to it as ?file=/path/to/file
  handlerModule?: string;
  fileassoc?: string[];
}

export interface RegisteredRawManifest {
  name: string;
  key: string;
  version: string;
  description: string;
  type: "raw";
  entryModule: string;
  handlerModule?: string;
  fileassoc: string[];
  hasFileOpener: boolean;
}

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

function normalizeExtension(ext: string): string {
  const e = ext.trim().toLowerCase();
  if (!e) return "";
  return e.startsWith(".") ? e : "." + e;
}

function ensureDirs(fs: FileSystemAccess, filePath: string): void {
  const parts = filePath.split("/").filter(Boolean);
  parts.pop();
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    if (!fs.exists(cur)) fs.createDirectory(cur);
  }
}

export async function installRawApp(
  files: Record<string, string>,
  manifest: RawManifest,
  options?: { fileAssociations?: string[] },
  onProgress?: (p: InstallProgress) => void,
): Promise<string> {
  const key = manifest.key;
  const name = manifest.name;
  if (!key || !name) {
    throw new Error("raw app manifest must include 'key' and 'name'");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new Error(`invalid app key "${key}"`);
  }

  const version = manifest.version || "1.0.0";
  const description = manifest.description || "";
  const entryModule = manifest.entryModule || DEFAULT_ENTRY;
  const handlerModule = manifest.handlerModule;
  const declaredAssoc = (manifest.fileassoc ?? [])
    .map(normalizeExtension)
    .filter(Boolean);
  const fileassoc = (options?.fileAssociations ?? declaredAssoc)
    .map(normalizeExtension)
    .filter(Boolean);

  const fs = new FileSystemAccess();
  const appDir = `/iSi/apps/${key}`;

  if (fs.exists(appDir)) fs.deleteDirectoryRecursive(appDir);
  fs.createDirectory(appDir);

  const fileNames = Object.keys(files);
  onProgress?.({ phase: "write", done: 0, total: fileNames.length });
  let done = 0;
  for (const [rel, content] of Object.entries(files)) {
    const clean = rel.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!clean) continue;
    const dest = normalizePath(`${appDir}/${clean}`);
    if (!dest.startsWith(`${appDir}/`)) {
      throw new Error(`unsafe path in raw app: "${rel}"`);
    }
    ensureDirs(fs, dest);
    fs.createFile(dest);
    const blob = new Blob([content]);
    await fs.data.write(dest, blob);
    fs.updateFileMeta(dest, blob);
    done++;
    onProgress?.({ phase: "write", done, total: fileNames.length });
  }

  onProgress?.({ phase: "register", done: 0, total: 0 });

  const registered: RegisteredRawManifest = {
    name,
    key,
    version,
    description,
    type: "raw",
    entryModule,
    handlerModule,
    fileassoc: declaredAssoc,
    hasFileOpener: !!handlerModule,
  };

  const reg = new RegistryInstanceAccess();
  await reg._write(`${APPS_REG_PREFIX}/${key}`, "manifest", registered);

  const indexRecord = await reg._load(APP_INDEX_PATH);
  const list = (indexRecord?.values["list"] as
    | Array<{ key: string; name: string; version: string; description: string }>
    | undefined) ?? [];
  if (!list.some((a) => a.key === key)) {
    list.push({ key, name, version, description });
    await reg._write(APP_INDEX_PATH, "list", list);
  }

  if (handlerModule) {
    for (const ext of fileassoc) {
      await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "app", key);
      await reg._write(`${CLASSES_ROOT_PREFIX}/${ext}`, "entry", "handler");
    }
  }

  return name;
}

// installs a raw app from a .zip/.spa package: finds manifest.json (even when
// the archive wraps everything in a folder), reads every other entry as a text
// file, and installs them into the VFS under /iSi/apps/{key}.
export async function installRawAppFromZip(
  bytes: ArrayBuffer,
  options?: { fileAssociations?: string[] },
  onProgress?: (p: InstallProgress) => void,
): Promise<string> {
  onProgress?.({ phase: "extract", done: 0, total: 0 });
  const entries = await unzip(bytes);

  const manifestEntry = findManifestEntry(entries);
  if (!manifestEntry) {
    throw new Error("raw app archive must contain a manifest.json");
  }
  let manifest: RawManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as RawManifest;
  } catch {
    throw new Error("invalid manifest.json in raw app archive");
  }
  if (manifest.type !== "raw") {
    throw new Error(
      `"${manifest.name ?? "app"}" is not a raw app (manifest type: ${manifest.type ?? "missing"})`,
    );
  }

  const files: Record<string, string> = {};
  for (const entry of entries) {
    const clean = entry.name.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!clean || clean.toLowerCase().endsWith("manifest.json")) continue;
    files[clean] = new TextDecoder().decode(entry.data);
  }

  return installRawApp(files, manifest, options, onProgress);
}

export async function getRawEntryMethods(appKey: string): Promise<string[]> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  const manifest = record?.values["manifest"] as RegisteredRawManifest | undefined;
  if (!manifest) return ["run"];
  const methods = ["run"];
  if (manifest.hasFileOpener) methods.push("handler");
  return methods;
}

export async function launchRawApp(appKey: string): Promise<boolean> {
  return launchRawEntry(appKey, "run");
}

export async function launchRawEntry(
  appKey: string,
  entry: string,
  filename?: string,
): Promise<boolean> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(`${APPS_REG_PREFIX}/${appKey}`);
  if (!record) return false;
  const manifest = record.values["manifest"] as RegisteredRawManifest | undefined;
  if (!manifest) return false;

  const fs = new FileSystemAccess();
  const appRoot = `/iSi/apps/${appKey}`;
  if (!fs.exists(appRoot)) return false;

  const module =
    entry === "handler" && manifest.handlerModule
      ? manifest.handlerModule
      : manifest.entryModule || DEFAULT_ENTRY;
  const filePath = normalizePath(`${appRoot}/${module}`);
  if (!fs.isFile(filePath)) return false;

  const title = filename
    ? filename.split("/").pop() || manifest.name
    : manifest.name;

  spawn(title, (hwnd) => {
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    setContent(hwnd, iframe);

    attachsjFrame(iframe, new fstransport()).then((frame) => {
      const params = new URLSearchParams();
      if (filename) params.set("file", filename);
      const ulid = windowsmap.get(hwnd);
      if (ulid) params.set("hwnd", ulid);
      const qs = params.toString();
      frame.go(`https://aspen/filesystem${filePath}${qs ? `?${qs}` : ""}`);
    });
  });

  return true;
}
