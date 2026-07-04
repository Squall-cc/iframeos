import { spawn, setContent } from "../Core/windowhelpers";

import { fstransport } from "./scramjet/fstransport";
import { nettransport } from "./scramjet/nettransport";

export const pref = "/~/sj/";

function load(x: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const d = document.createElement("script");
    d.src = x;
    d.onload = () => resolve();
    d.onerror = () => reject(new Error("failed to load :" + x));
    document.head.appendChild(d);
  });
}

// wires an iframe up to scramjet w/ traansport and returns handler
export async function attachsjFrame(
  iframe: HTMLIFrameElement,
  transport: fstransport | nettransport,
) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sw = navigator.serviceWorker.controller || reg.active;
  if (!sw) throw new Error("no service worker");

  if (!(window as any).$scramjet) {
    await load("/scramjet/scramjet.js");
  }
  await load("/controller/controller.api.js");
  const { Controller, config } = (window as any).$scramjetController;

  config.prefix = pref;
  config.injectPath = "/controller/controller.inject.js";
  config.scramjetPath = "/scramjet/scramjet.js";
  config.wasmPath = "/scramjet/scramjet.wasm";

  const ctrl = new Controller({ serviceworker: sw, transport });
  await ctrl.wait();

  return ctrl.createFrame(iframe);
}

function spawnf(
  title: string,
  transport: fstransport | nettransport,
  url: string,
) {
  spawn(title, (hwnd) => {
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    setContent(hwnd, iframe);

    attachsjFrame(iframe, transport).then((frame) => frame.go(url));
  });
}

export function launchScramFs(path: string = "/"): void {
  spawnf("scramjet", new fstransport(), `https://filesystem${path}`);
}

export function launchScramCurl(url: string): void {
  spawnf("proxy", new nettransport(), url);
}
