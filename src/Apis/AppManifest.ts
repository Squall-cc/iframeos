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
