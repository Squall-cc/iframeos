import { render } from "solid-js/web";

import "solid-devtools";
import * as appStoreApi from "./Apis/AppStore";
import * as fileSystemApi from "./Apis/FileSystemApi";
import { WindowHandle, shellOpen, shellOpenWithPicker, shellModal, shellSelectFile, getAllInstalledApps, launchSpaApp, spawn } from "./Apis/iSApi";
import * as launcher from "./Apis/Launcher";
import * as registryApi from "./Apis/RegistryApi";
import * as scramjetApi from "./Apis/scramjet";
import App from "./Core/App";
import * as systems from "./Core/systems";
import * as editorApi from "./SysApps/editor";

const fsInstance = new fileSystemApi.FileSystemAccess();
const fs = { ...fileSystemApi, ...fsInstance };

declare global {
  interface Window {
    __API: {
      WindowHandle: typeof WindowHandle;
      systems: typeof systems;
      registry: typeof registryApi;
      fs: typeof fileSystemApi & fileSystemApi.FileSystemAccess;
      launcher: typeof launcher;
      scramjet: typeof scramjetApi;
      appStore: typeof appStoreApi;
      editor: typeof editorApi;
      version: string;
      spawn: typeof spawn;
      shellOpen: typeof shellOpen;
      shellOpenWithPicker: typeof shellOpenWithPicker;
      shellModal: typeof shellModal;
      shellSelectFile: typeof shellSelectFile;
      getAllInstalledApps: typeof getAllInstalledApps;
      launchSpaApp: typeof launchSpaApp;
    };
    WindowHandle: typeof WindowHandle;
    spawn: typeof spawn;
    shellOpen: typeof shellOpen;
    shellModal: typeof shellModal;
  }
}

const API = {
  WindowHandle,
  systems,
  registry: registryApi,
  fs,
  launcher,
  scramjet: scramjetApi,
  appStore: appStoreApi,
  editor: editorApi,
  version: "1.0.0",
  spawn,
  shellOpen,
  shellOpenWithPicker,
  shellModal,
  shellSelectFile,
  getAllInstalledApps,
  launchSpaApp,
};

// make global
window.__API = API;
window.WindowHandle = WindowHandle;
window.spawn = spawn;
window.shellOpen = shellOpen;
window.shellModal = shellModal;

// logging
if (import.meta.env.DEV) {
  console.log("available:", Object.keys(API));
  console.log("WindowHandle:", WindowHandle);
}

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

render(() => <App />, root!);
