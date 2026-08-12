import { startVantaBackground, stopVantaBackground } from "../Apis/theme";
import { FileSystemAccess } from "../Apis/FileSystemApi";
import { RegistryInstanceAccess } from "../Apis/RegistryApi";
import { THEME_PATH, THEME_BKG_VALUE, WALLPAPERS_DIR } from "../Apis/system-defaults";
import chicken from "../Assets/inclbkgrn/chicken.jpg";
import manridingwoman from "../Assets/inclbkgrn/manridingwoman.png";
import win7 from "../Assets/inclbkgrn/wallpaper.webp";

import { setWallpaper, setWallpaperWithBlob } from "./systems";

export interface WallpaperInfo {
  id: string;
  name: string;
  url?: string;
  vanta?: boolean;
}

export const VANTA_WALLPAPER_ID = "vanta";

const VANTA_WALLPAPER: WallpaperInfo = { id: VANTA_WALLPAPER_ID, name: "Vanta (Animated)", vanta: true };

export const DEFAULT_WALLPAPERS: WallpaperInfo[] = [
  { id: "default0", name: "Man Riding Woman", url: manridingwoman },
  { id: "default1", name: "win7", url: win7 },
  { id: "default2", name: "Chicken", url: chicken },
  VANTA_WALLPAPER,
];

export function getDefaultWallpaper(id: string): WallpaperInfo | undefined {
  return DEFAULT_WALLPAPERS.find((w) => w.id === id);
}

export async function getCurrentWallpaperId(): Promise<string> {
  const reg = new RegistryInstanceAccess();
  const record = await reg._load(THEME_PATH);
  return String(record?.values[THEME_BKG_VALUE] ?? "default0");
}

export async function applyWallpaperById(id: string): Promise<void> {
  stopVantaBackground();
  if (id === VANTA_WALLPAPER_ID) {
    const el = document.getElementById("wallpaper");
    if (el) {
      el.style.backgroundImage = "";
      startVantaBackground(el);
    }
    return;
  }

  const def = getDefaultWallpaper(id);
  if (def?.url) {
    setWallpaper(def.url);
    return;
  }
  if (id.startsWith("/")) {
    const fs = new FileSystemAccess();
    const blob = await fs.data.read(id);
    if (blob) setWallpaperWithBlob(blob);
  }
}

export async function applyWallpaperFromRegistry(): Promise<void> {
  const id = await getCurrentWallpaperId();
  await applyWallpaperById(id);
}

export async function setCurrentWallpaper(id: string): Promise<void> {
  const reg = new RegistryInstanceAccess();
  await reg._write(THEME_PATH, THEME_BKG_VALUE, id);
  await applyWallpaperById(id);
}

// wallpapers stored in the vfs (user uploads). returns a stable "id" that is
// just the vfs path, plus a blob url for previews.
export async function getVfsWallpapers(): Promise<WallpaperInfo[]> {
  const fs = new FileSystemAccess();
  if (!fs.exists(WALLPAPERS_DIR)) return [];
  const files = fs
    .listDirectory(WALLPAPERS_DIR)
    .filter((p) => fs.isFile(p));
  const out: WallpaperInfo[] = [];
  for (const file of files) {
    const blob = await fs.data.read(file);
    if (blob) {
      out.push({
        id: file,
        name: file.split("/").filter(Boolean).pop() || file,
        url: URL.createObjectURL(blob),
      });
    }
  }
  return out;
}

export async function getAllWallpapers(): Promise<WallpaperInfo[]> {
  const vfs = await getVfsWallpapers();
  return [...DEFAULT_WALLPAPERS, ...vfs];
}

// stores an uploaded image in the vfs wallpapers folder and returns its path.
export async function saveWallpaperFile(file: File): Promise<string> {
  const fs = new FileSystemAccess();
  const name = file.name.replace(/[\\/]/g, "_");
  const path = `${WALLPAPERS_DIR}/${name}`;
  if (!fs.exists(WALLPAPERS_DIR)) fs.createDirectory(WALLPAPERS_DIR);
  if (!fs.isFile(path)) fs.createFile(path);
  await fs.data.write(path, file);
  fs.updateFileMeta(path, file);
  return path;
}
