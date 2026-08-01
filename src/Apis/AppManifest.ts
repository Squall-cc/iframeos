// manifest.json for a .spa archive (which is just a renamed zip)
//
// the manifest is copied into the registry on install; the code files inside
// the archive are copied into the virtual filesystem.
export interface SpaManifest {
  name: string;
  key: string;
  version: string;
  description: string;
  // name of the exported function on the entry module's exports object
  entryPoint: string;
  // path to the entry code file, relative to the app root (default: main.ts)
  entryModule?: string;
  // optional exported function used to open files
  fileOpener?: string;
  // optional module containing the file opener (default: entryModule)
  fileOpenerModule?: string;
  // file extensions to offer associating with this app on install (e.g. [".txt"])
  fileassoc?: string[];
  // path to an icon file relative to the app root (optional; defaults to the
  // system fallback icon)
  icon?: string;
  // whether the app should show up in the start menu (default: true)
  startMenu?: boolean;
}

// the manifest as stored in the registry (InternalSystem/Apps/{key})
export interface RegisteredSpaManifest {
  name: string;
  key: string;
  version: string;
  description: string;
  type: string;
  entryPoint: string;
  entryModule?: string;
  fileOpener?: string;
  fileOpenerModule?: string;
  fileassoc?: string[];
  hasFileOpener: boolean;
  icon?: string;
  startMenu?: boolean;
}

export interface InstalledAppInfo {
  name: string;
  key: string;
  version: string;
  description: string;
}

export interface ClassRootEntry {
  app: string;
  entry: string;
}
