import { FileSystemAccess } from "./FileSystemApi";
import { DESKTOP_JSON } from "./system-defaults";

export interface DesktopAppShortcut {
  app: string;
  name: string;
  x: number;
  y: number;
}

export interface DesktopFileShortcut {
  file: string;
  x: number;
  y: number;
}

export type DesktopShortcut = DesktopAppShortcut | DesktopFileShortcut;

export const DESKTOP_DIR = "/desktop";
export const DESKTOP_CHANGED_EVENT = "is-desktop-changed";
// custom mime type used when dragging items out of the file explorer so the
// desktop (or anything else) can recognize an internal vfs path.
export const VFS_DRAG_MIME = "application/x-is-vfs-path";

export function isAppShortcut(s: DesktopShortcut): s is DesktopAppShortcut {
  return typeof (s as DesktopAppShortcut).app === "string";
}

export function isFileShortcut(s: DesktopShortcut): s is DesktopFileShortcut {
  return typeof (s as DesktopFileShortcut).file === "string";
}

export function shortcutKey(s: DesktopShortcut): string {
  return isAppShortcut(s) ? `app:${s.app}` : `file:${s.file}`;
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : d;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function clampDesktopPosition(
  x: number,
  y: number,
): { x: number; y: number } {
  const w = window.innerWidth - 84;
  const h = window.innerHeight - 40 - 48;
  return { x: clamp(x, 8, Math.max(8, w)), y: clamp(y, 8, Math.max(8, h)) };
}

export function emitDesktopChanged(): void {
  window.dispatchEvent(new CustomEvent(DESKTOP_CHANGED_EVENT));
}

export function onDesktopChanged(fn: () => void): () => void {
  window.addEventListener(DESKTOP_CHANGED_EVENT, fn);
  return () => window.removeEventListener(DESKTOP_CHANGED_EVENT, fn);
}

export async function readDesktopIcons(): Promise<DesktopShortcut[]> {
  const fs = new FileSystemAccess();
  try {
    const blob = await fs.data.read(DESKTOP_JSON);
    if (!blob) return [];
    const parsed = JSON.parse(await blob.text()) as { icons?: unknown };
    if (!Array.isArray(parsed.icons)) return [];
    const out: DesktopShortcut[] = [];
    for (const item of parsed.icons) {
      if (typeof item !== "object" || item === null) continue;
      const s = item as Record<string, unknown>;
      if (typeof s.app === "string" && typeof s.name === "string") {
        out.push({ app: s.app, name: s.name, x: num(s.x, 16), y: num(s.y, 16) });
      } else if (typeof s.file === "string") {
        out.push({ file: s.file, x: num(s.x, 16), y: num(s.y, 16) });
      }
    }
    return out;
  } catch (e) {
    console.error("readDesktopIcons:", e);
    return [];
  }
}

export async function writeDesktopIcons(
  icons: DesktopShortcut[],
  opts?: { emit?: boolean },
): Promise<void> {
  const fs = new FileSystemAccess();
  if (!fs.isFile(DESKTOP_JSON)) fs.createFile(DESKTOP_JSON);
  const text = JSON.stringify({ icons }, null, 2);
  await fs.data.write(DESKTOP_JSON, text);
  fs.updateFileMeta(DESKTOP_JSON, text);
  if (opts?.emit !== false) emitDesktopChanged();
}

function findFreeSlot(
  icons: DesktopShortcut[],
  startX = 16,
  startY = 16,
): { x: number; y: number } {
  const occupied = new Set(icons.map((i) => `${i.x},${i.y}`));
  let x = startX;
  let y = startY;
  while (occupied.has(`${x},${y}`)) {
    x += 96;
    if (x > 960) {
      x = 16;
      y += 96;
    }
  }
  return { x, y };
}

export async function addAppShortcut(
  appKey: string,
  name: string,
  x?: number,
  y?: number,
): Promise<void> {
  const icons = await readDesktopIcons();
  if (icons.some((i) => isAppShortcut(i) && i.app === appKey)) return;
  const slot =
    x !== undefined && y !== undefined ? { x, y } : findFreeSlot(icons);
  icons.push({ app: appKey, name, x: slot.x, y: slot.y });
  await writeDesktopIcons(icons);
}

export async function addFileShortcut(
  filePath: string,
  x?: number,
  y?: number,
): Promise<void> {
  const icons = await readDesktopIcons();
  if (icons.some((i) => isFileShortcut(i) && i.file === filePath)) return;
  const slot =
    x !== undefined && y !== undefined ? { x, y } : findFreeSlot(icons);
  icons.push({ file: filePath, x: slot.x, y: slot.y });
  await writeDesktopIcons(icons);
}

export async function removeShortcut(target: DesktopShortcut): Promise<void> {
  const icons = await readDesktopIcons();
  const key = shortcutKey(target);
  const next = icons.filter((i) => shortcutKey(i) !== key);
  if (next.length !== icons.length) await writeDesktopIcons(next);
}

export async function updateShortcutPosition(
  target: DesktopShortcut,
  x: number,
  y: number,
): Promise<void> {
  const icons = await readDesktopIcons();
  const idx = icons.findIndex((i) => shortcutKey(i) === shortcutKey(target));
  if (idx === -1) return;
  const pos = clampDesktopPosition(x, y);
  icons[idx] = { ...icons[idx], x: pos.x, y: pos.y };
  await writeDesktopIcons(icons);
}

// makes sure every file/folder physically in /desktop has a shortcut and that
// shortcuts pointing at deleted files are dropped. returns the reconciled list.
export async function syncDesktopFiles(): Promise<DesktopShortcut[]> {
  const fs = new FileSystemAccess();
  const icons = await readDesktopIcons();
  const cleaned = icons.filter((i) => {
    if (isFileShortcut(i)) return fs.exists(i.file);
    return true;
  });
  const known = new Set(cleaned.filter(isFileShortcut).map((i) => i.file));
  let changed = cleaned.length !== icons.length;
  for (const p of fs.listDirectory(DESKTOP_DIR)) {
    if (p === DESKTOP_JSON) continue;
    if (known.has(p)) continue;
    const slot = findFreeSlot(cleaned);
    cleaned.push({ file: p, x: slot.x, y: slot.y });
    changed = true;
  }
  if (changed) await writeDesktopIcons(cleaned, { emit: false });
  return cleaned;
}

async function moveDirectory(
  src: string,
  dest: string,
  fs: FileSystemAccess,
): Promise<void> {
  fs.createDirectory(dest);
  for (const child of fs.listDirectory(src).filter((p) => p !== src)) {
    if (fs.isDirectory(child)) {
      const childName = child.split("/").filter(Boolean).pop() || child;
      await moveDirectory(child, `${dest}/${childName}`, fs);
    } else {
      const childName = child.split("/").filter(Boolean).pop() || child;
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

function uniqueDesktopPath(name: string): string {
  const fs = new FileSystemAccess();
  let dest = `${DESKTOP_DIR}/${name}`;
  let n = 1;
  while (fs.exists(dest)) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    dest = `${DESKTOP_DIR}/${base} (${n})${ext}`;
    n++;
  }
  return dest;
}

// moves a file or folder from anywhere in the vfs into the desktop directory
// and adds a shortcut for it. returns the new path, or null if it couldn't.
export async function moveToDesktop(src: string): Promise<string | null> {
  const fs = new FileSystemAccess();
  const name = src.split("/").filter(Boolean).pop();
  if (!name) return null;
  if (normalizeDesktopPath(src) === normalizeDesktopPath(`${DESKTOP_DIR}/${name}`)) {
    return src;
  }
  const dest = uniqueDesktopPath(name);
  if (fs.isDirectory(src)) {
    await moveDirectory(src, dest, fs);
  } else {
    fs.rename(src, dest);
  }
  await addFileShortcut(dest);
  emitDesktopChanged();
  return dest;
}

function normalizeDesktopPath(p: string): string {
  return p.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

// copies a host File (from a drag/drop or file picker) into the desktop
// directory and adds a shortcut. returns the new path.
export async function copyHostFileToDesktop(file: File): Promise<string> {
  const fs = new FileSystemAccess();
  const name = file.name.replace(/[\\/]/g, "_") || "file";
  const dest = uniqueDesktopPath(name);
  fs.createFile(dest);
  await fs.data.write(dest, file);
  fs.updateFileMeta(dest, file);
  await addFileShortcut(dest);
  emitDesktopChanged();
  return dest;
}

// copies a vfs file into the desktop directory and adds a shortcut.
export async function copyVfsFileToDesktop(src: string): Promise<string | null> {
  const fs = new FileSystemAccess();
  const name = src.split("/").filter(Boolean).pop();
  if (!name || fs.isDirectory(src)) return null;
  const dest = uniqueDesktopPath(name);
  const blob = await fs.data.read(src);
  if (!blob) return null;
  fs.createFile(dest);
  await fs.data.write(dest, blob);
  fs.updateFileMeta(dest, blob);
  await addFileShortcut(dest);
  emitDesktopChanged();
  return dest;
}
