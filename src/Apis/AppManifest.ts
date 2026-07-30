export interface SpaManifest {
  name: string;
  key: string;
  version: string;
  description: string;
  entryPoint: string;
  fileOpener?: string;
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
