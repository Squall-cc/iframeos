import { FileSystemAccess } from "./FileSystemApi";
import { RegistryInstanceAccess } from "./RegistryApi";

import noappIcon from "../Assets/iconsUI/noapp.ico";

export const DEFAULT_APP_ICON = noappIcon;

const iconCache = new Map<string, string>();

const APP_MANIFEST_PREFIX = "InternalSystem/Apps";

// every image/icon shipped in the assets directory, keyed by lowercase
// filename. builtin apps can reference an icon by bare filename (e.g.
// "paint.ico") and it will resolve here instead of the vfs.
const assetIcons: Record<string, string> = {};
const assetGlob = import.meta.glob(
  "/src/Assets/**/*.{ico,png,jpg,jpeg,gif,webp,svg,bmp}",
  { eager: true, import: "default" },
);
for (const [path, url] of Object.entries(assetGlob)) {
  const base = path.split("/").pop()?.toLowerCase();
  if (base && !(base in assetIcons)) assetIcons[base] = url as string;
}

// resolves the display URL for an app's icon.
//  - a bare filename (no "/") resolves from the assets directory first, then
//    from the app's folder in the vfs
//  - a relative path resolves from /iSi/apps/{key}/{path} in the vfs
//  - when no path is given, the app's registered manifest is consulted for an
//    "icon" value
// falls back to the system default icon.
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
