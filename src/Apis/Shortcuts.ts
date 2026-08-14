import { FileSystemAccess, emitVfsChanged } from "./FileSystemApi";

export const SHORTCUT_EXT = ".lnk";
export const TRASH_DIR = "/trash";

export interface ShortcutTarget {
  kind: "app" | "file";
  target: string;
  name?: string;
}

export function isShortcutFile(path: string): boolean {
  return path.toLowerCase().endsWith(SHORTCUT_EXT);
}

export function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() || path;
}

function normalize(path: string): string {
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

function uniquePath(fs: FileSystemAccess, desired: string): string {
  let dest = desired;
  let n = 1;
  while (fs.exists(dest)) {
    const dot = desired.lastIndexOf(".");
    const base = dot > 0 ? desired.slice(0, dot) : desired;
    const ext = dot > 0 ? desired.slice(dot) : "";
    dest = `${base} (${n})${ext}`;
    n++;
  }
  return dest;
}

export async function createShortcutFile(
  target: string,
  dir: string,
  name?: string,
  opts?: { emit?: boolean },
): Promise<string | null> {
  const fs = new FileSystemAccess();
  if (!fs.exists(target)) return null;
  const base = name?.trim() || basename(target);
  const dest = uniquePath(fs, normalize(`${dir}/${base}${SHORTCUT_EXT}`));
  fs.createFile(dest);
  const data = JSON.stringify({ target });
  await fs.data.write(dest, data);
  fs.updateFileMeta(dest, data);
  if (opts?.emit !== false) emitVfsChanged();
  return dest;
}

// creates a .lnk file in `dir` that launches an installed app.
export async function createAppShortcutFile(
  appKey: string,
  appName: string,
  dir: string,
  opts?: { emit?: boolean },
): Promise<string | null> {
  const fs = new FileSystemAccess();
  const dest = uniquePath(fs, normalize(`${dir}/${appName}${SHORTCUT_EXT}`));
  fs.createFile(dest);
  const data = JSON.stringify({ app: appKey, name: appName });
  await fs.data.write(dest, data);
  fs.updateFileMeta(dest, data);
  if (opts?.emit !== false) emitVfsChanged();
  return dest;
}

// reads the target of a .lnk file, or null when it isn't a valid shortcut.
export async function readShortcut(path: string): Promise<ShortcutTarget | null> {
  const fs = new FileSystemAccess();
  if (!isShortcutFile(path) || !fs.isFile(path)) return null;
  const text = await fs.data.readText(path);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as {
      target?: unknown;
      app?: unknown;
      name?: unknown;
    };
    if (typeof parsed.app === "string") {
      return { kind: "app", target: parsed.app, name: parsed.name as string | undefined };
    }
    if (typeof parsed.target === "string") {
      return { kind: "file", target: parsed.target };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function fullyResolveShortcut(path: string): Promise<ShortcutTarget> {
  let current = path;
  const seen = new Set<string>();
  while (isShortcutFile(current)) {
    if (seen.has(current)) break;
    seen.add(current);
    const st = await readShortcut(current);
    if (!st) break;
    if (st.kind === "app") return st;
    current = st.target;
  }
  return { kind: "file", target: current };
}

export async function resolveShortcutPath(path: string): Promise<string> {
  const resolved = await fullyResolveShortcut(path);
  return resolved.target;
}

// resolves a path to its effective target, following chains of .lnk.
export async function resolveShortcut(path: string): Promise<ShortcutTarget> {
  return fullyResolveShortcut(path);
}

async function moveDirectory(
  src: string,
  dest: string,
  fs: FileSystemAccess,
): Promise<void> {
  fs.createDirectory(dest);
  for (const child of fs.listDirectory(src).filter((p) => p !== src)) {
    if (fs.isDirectory(child)) {
      const childName = basename(child);
      await moveDirectory(child, `${dest}/${childName}`, fs);
    } else {
      const childName = basename(child);
      const target = `${dest}/${childName}`;
      const blob = await fs.data.read(child);
      fs.createFile(target);
      if (blob) {
        await fs.data.write(target, blob);
        fs.updateFileMeta(target, blob);
      }
      fs.deleteFile(child);
    }
  }
  fs.deleteDirectory(src);
}

export async function movePath(
  src: string,
  destDir: string,
): Promise<string | null> {
  const fs = new FileSystemAccess();
  const name = basename(src);
  if (!name) return null;
  const dest = uniquePath(fs, normalize(`${destDir}/${name}`));
  if (normalize(src) === normalize(dest)) return src;
  if (normalize(dest).startsWith(normalize(src) + "/")) return null;
  if (fs.isDirectory(src)) {
    await moveDirectory(src, dest, fs);
  } else {
    fs.rename(src, dest);
  }
  emitVfsChanged();
  return dest;
}

// moves a file or folder into the trash. returns the new path, or null.
export async function moveToTrash(src: string): Promise<string | null> {
  const fs = new FileSystemAccess();
  if (normalize(src) === TRASH_DIR) return null;
  if (normalize(src).startsWith(TRASH_DIR + "/")) return src;
  const name = basename(src);
  if (!name) return null;
  const dest = uniquePath(fs, normalize(`${TRASH_DIR}/${name}`));
  if (fs.isDirectory(src)) {
    await moveDirectory(src, dest, fs);
  } else {
    fs.rename(src, dest);
  }
  emitVfsChanged();
  return dest;
}

export function emptyTrash(): number {
  const fs = new FileSystemAccess();
  const children = fs.listDirectory(TRASH_DIR).filter((p) => p !== TRASH_DIR);
  for (const child of children) {
    if (fs.isDirectory(child)) fs.deleteDirectoryRecursive(child);
    else fs.deleteFile(child);
  }
  emitVfsChanged();
  return children.length;
}
