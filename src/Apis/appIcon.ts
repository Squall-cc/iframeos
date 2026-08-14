import noappIcon from "../Assets/iconsUI/noapp.ico";

import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";
import { CLASSES_ROOT_PREFIX } from "./system-defaults";


export const DEFAULT_APP_ICON = noappIcon;

const iconCache = new Map<string, string>();

const APP_MANIFEST_PREFIX = "InternalSystem/Apps";

const assetIcons: Record<string, string> = {};
const assetGlob = import.meta.glob(
  "/src/Assets/**/*.{ico,png,jpg,jpeg,gif,webp,svg,bmp}",
  { eager: true, import: "default" },
);
for (const [path, url] of Object.entries(assetGlob)) {
  const base = path.split("/").pop()?.toLowerCase();
  if (base && !(base in assetIcons)) assetIcons[base] = url as string;
}

export async function getAppIconUrl(
  appKey: string,
  iconPath?: string | null,
): Promise<string> {
  if (iconPath) {
    const clean = iconPath.replace(/^\/+/, "").replace(/\\/g, "/");
    if (clean) {
      if (!clean.includes("/")) {
        const asset = assetIcons[clean.toLowerCase()];
        if (asset) return asset;
      }
      const fs = new FileSystemAccess();
      const full = `/iSi/apps/${appKey}/${clean}`;
      const blob = await fs.data.read(full);
      if (blob) {
        const url = URL.createObjectURL(blob);
        iconCache.set(appKey, url);
        return url;
      }
    }
  } else {
    try {
      const reg = new RegistryInstanceAccess();
      const record = await reg._load(`${APP_MANIFEST_PREFIX}/${appKey}`);
      const manifest = record?.values["manifest"] as { icon?: string } | undefined;
      if (manifest?.icon) return getAppIconUrl(appKey, manifest.icon);
    } catch {
      // fall through to the default icon
    }
  }
  const cached = iconCache.get(appKey);
  return cached ?? DEFAULT_APP_ICON;
}

export async function getFileTypeIconUrl(
  filePath: string,
): Promise<string | undefined> {
  const extIdx = filePath.lastIndexOf(".");
  if (extIdx === -1) return undefined;
  const ext = filePath.slice(extIdx).toLowerCase();
  try {
    const reg = new RegistryInstanceAccess();
    const record = await reg._load(`${CLASSES_ROOT_PREFIX}/${ext}`);
    const appKey = record?.values["app"] as string | undefined;
    if (appKey) return getAppIconUrl(appKey, undefined);
  } catch {
    // no association -> fall back to the generic file icon
  }
  return undefined;
}
