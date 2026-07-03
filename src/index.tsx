import { render } from "solid-js/web";

import "solid-devtools";
import * as fileSystemApi from "./Apis/FileSystemApi";
import { WindowHandle, spawn } from "./Apis/iSApi";
import * as launcher from "./Apis/Launcher";
import * as registryApi from "./Apis/RegistryApi";
import * as scramjetApi from "./Apis/scramjet";
import App from "./Core/App";
import * as systems from "./Core/systems";

declare global {
  interface Window {
    __API: {
      WindowHandle: typeof WindowHandle;
      systems: typeof systems;
      registry: typeof registryApi;
      fs: typeof fileSystemApi;
      launcher: typeof launcher;
      scramjet: typeof scramjetApi;
      version: string;
      spawn: typeof spawn;
    };
    WindowHandle: typeof WindowHandle;
    spawn: typeof spawn;
  }
}

const API = {
  WindowHandle,
  systems,
  registry: registryApi,
  fs: fileSystemApi,
  launcher,
  scramjet: scramjetApi,
  version: "1.0.0",
  spawn,
};

// make global
window.__API = API;
window.WindowHandle = WindowHandle;
window.spawn = spawn;

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
