import { FileSystemAccess } from "./FileSystemApi";
import {
  TRASH_DIR,
  SHORTCUT_EXT,
  basename,
  createAppShortcutFile,
  isShortcutFile,
  readShortcut,
} from "./Shortcuts";
import { DESKTOP_JSON } from "./system-defaults";

// the desktop is a reflection of the /desktop directory. every shortcut lives
// there as a real .lnk file; desktop.json is only hidden bookkeeping that
// stores where each icon sits. app shortcuts are .lnk files too, so dragging
// something from the start menu creates one just like any other file.
export interface DesktopAppShortcut {
  file: string;
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
// custom mime type used when dragging start menu / app icons around.
export const APP_DRAG_MIME = "application/x-is-app";

export function isAppShortcut(s: DesktopShortcut): s is DesktopAppShortcut {
  return typeof (s as DesktopAppShortcut).app === "string";
}

export function isFileShortcut(s: DesktopShortcut): s is DesktopFileShortcut {
  return !isAppShortcut(s);
}

export function shortcutKey(s: DesktopShortcut): string {
  return s.file;
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

// strips a trailing .lnk so shortcuts display without the extension.
export function displayShortcutName(path: string): string {
  let name = basename(path);
  if (name.toLowerCase().endsWith(SHORTCUT_EXT)) {
    name = name.slice(0, -SHORTCUT_EXT.length);
  }
  return name || basename(path);
}

// the bottom edge of the first icon column, used by the down-then-right
// layout so icons fill a column before spilling into the next one.
function desktopColumnBottom(): number {
  return Math.max(80, window.innerHeight - 96);
}

function findFreeSlot(
  icons: DesktopShortcut[],
  startX = 16,
  startY = 16,
): { x: number; y: number } {
  const occupied = new Set(icons.map((i) => `${i.x},${i.y}`));
  const step = 96;
  const maxY = desktopColumnBottom();
  let x = startX;
  let y = startY;
  while (occupied.has(`${x},${y}`)) {
    y += step;
    if (y > maxY) {
      y = startY;
      x += step;
    }
  }
  return { x, y };
}

// reads the stored icon positions (and migrates any legacy app entries that
// predate .lnk files into real file-based ones).
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
        const file =
          typeof s.file === "string"
            ? s.file
            : `${DESKTOP_DIR}/${s.name}${SHORTCUT_EXT}`;
        out.push({ file, app: s.app, name: s.name, x: num(s.x, 16), y: num(s.y, 16) });
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
  const data = icons.map((i) => ({ file: i.file, x: i.x, y: i.y }));
  const text = JSON.stringify({ icons: data }, null, 2);
  await fs.data.write(DESKTOP_JSON, text);
  fs.updateFileMeta(DESKTOP_JSON, text);
  if (opts?.emit !== false) emitDesktopChanged();
}

async function setPosition(file: string, x: number, y: number): Promise<void> {
  const icons = await readDesktopIcons();
  const idx = icons.findIndex((i) => i.file === file);
  const pos = clampDesktopPosition(x, y);
  if (idx === -1) icons.push({ file, x: pos.x, y: pos.y });
  else icons[idx] = { ...icons[idx], x: pos.x, y: pos.y };
  await writeDesktopIcons(icons);
}

export async function addAppShortcut(
  appKey: string,
  name: string,
  x?: number,
  y?: number,
  opts?: { allowDuplicate?: boolean },
): Promise<void> {
  const fs = new FileSystemAccess();
  if (!opts?.allowDuplicate) {
    for (const p of fs.listDirectory(DESKTOP_DIR)) {
      if (!isShortcutFile(p)) continue;
      const st = await readShortcut(p);
      if (st?.kind === "app" && st.target === appKey) return;
    }
  }
  const dest = await createAppShortcutFile(appKey, name, DESKTOP_DIR, {
    emit: false,
  });
  if (!dest) return;
  if (x !== undefined && y !== undefined) await setPosition(dest, x, y);
  emitDesktopChanged();
}

export async function addFileShortcut(
  filePath: string,
  x?: number,
  y?: number,
  _opts?: { allowDuplicate?: boolean },
): Promise<void> {
  if (x !== undefined && y !== undefined) await setPosition(filePath, x, y);
}

export async function removeShortcut(target: DesktopShortcut): Promise<void> {
  const icons = await readDesktopIcons();
  const next = icons.filter((i) => i.file !== target.file);
  if (next.length !== icons.length) await writeDesktopIcons(next);
}

export async function updateShortcutPosition(
  target: DesktopShortcut,
  x: number,
  y: number,
): Promise<void> {
  await setPosition(target.file, x, y);
}

// makes sure every file/folder physically in /desktop has an entry (resolving
// .lnk files into app or file shortcuts) and that the trash is always present.
// returns the reconciled list.
export async function syncDesktopFiles(): Promise<DesktopShortcut[]> {
  const fs = new FileSystemAccess();
  const stored = await readDesktopIcons();
  const posByPath = new Map<string, { x: number; y: number }>();
  for (const s of stored) posByPath.set(s.file, { x: s.x, y: s.y });

  // migrate legacy stored app shortcuts (that predate .lnk files) into real
  // .lnk files sitting on the desktop. emits are suppressed so the migration
  // can't cascade into re-entrant desktop syncs.
  for (const s of stored) {
    if (isAppShortcut(s) && !fs.exists(s.file)) {
      const dest = await createAppShortcutFile(s.app, s.name, DESKTOP_DIR, {
        emit: false,
      });
      if (dest && dest !== s.file) {
        const pos = posByPath.get(s.file);
        posByPath.delete(s.file);
        if (pos) posByPath.set(dest, pos);
      }
    }
  }

  const out: DesktopShortcut[] = [];
  const listed = new Set<string>();
  const addFile = (file: string) => {
    const pos = posByPath.get(file) ?? findFreeSlot(out);
    out.push({ file, x: pos.x, y: pos.y });
    listed.add(file);
  };

  for (const p of fs.listDirectory(DESKTOP_DIR)) {
    if (p === DESKTOP_JSON) continue;
    if (isShortcutFile(p)) {
      const st = await readShortcut(p);
      if (st?.kind === "app") {
        const pos = posByPath.get(p) ?? findFreeSlot(out);
        out.push({
          file: p,
          app: st.target,
          name: st.name ?? displayShortcutName(p),
          x: pos.x,
          y: pos.y,
        });
        listed.add(p);
        continue;
      }
    }
    addFile(p);
  }

  if (!listed.has(TRASH_DIR)) {
    const pos = posByPath.get(TRASH_DIR) ?? findFreeSlot(out);
    out.push({ file: TRASH_DIR, x: pos.x, y: pos.y });
  }

  const storedKeys = new Set(stored.map((s) => s.file));
  const outKeys = new Set(out.map((s) => s.file));
  const changed =
    storedKeys.size !== outKeys.size ||
    [...storedKeys].some((k) => !outKeys.has(k));
  if (changed) await writeDesktopIcons(out, { emit: false });
  return out;
}

// sorts the desktop icons so the trash comes first, then apps, then folders,
// then files, each in alphabetical order, and lays them out in a grid that
// fills columns top-to-bottom before moving right.
export async function arrangeDesktopIcons(): Promise<void> {
  const fs = new FileSystemAccess();
  const icons = await syncDesktopFiles();

  const rank = (i: DesktopShortcut): number => {
    if (i.file === TRASH_DIR) return 0;
    if (isAppShortcut(i)) return 1;
    if (fs.isDirectory(i.file)) return 2;
    return 3;
  };

  const sorted = icons
    .slice()
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        displayShortcutName(a.file).localeCompare(displayShortcutName(b.file)),
    );

  const step = 96;
  const startX = 16;
  const startY = 16;
  const maxY = desktopColumnBottom();
  let x = startX;
  let y = startY;
  for (const icon of sorted) {
    const pos = clampDesktopPosition(x, y);
    icon.x = pos.x;
    icon.y = pos.y;
    y += step;
    if (y > maxY) {
      y = startY;
      x += step;
    }
  }
  await writeDesktopIcons(sorted);
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
