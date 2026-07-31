// Demo SPA - installed from a .spa (zip) archive.
//
// The entry points below are exported functions; the manifest.json declares
// which ones are the app entry ("run") and the file opener ("openFile").
//
// The platform API is injected at runtime: __API, spawn, WindowHandle,
// shellOpen, shellModal, etc. are in scope, and window.__API is also global.

declare const __API: any;

function view(html: string, hwnd: any) {
  const d = document.createElement("div");
  d.style.cssText = "padding:20px;font-family:Segoe UI,sans-serif;";
  d.innerHTML = html;
  hwnd.setContent(d);
}

export function run(hwnd: any) {
  const btn = document.createElement("button");
  btn.textContent = "Click";
  btn.onclick = () => window.alert("hi");
  const d = document.createElement("div");
  d.style.cssText = "padding:20px;font-family:Segoe UI,sans-serif;";
  d.innerHTML = "<h2>Demo SPA</h2><p>Installed from a .spa archive (zip + TypeScript)</p>";
  d.appendChild(btn);
  hwnd.setContent(d);
}

export function greet(name: string, hwnd: any) {
  view(`<h2>Hello ${name}</h2>`, hwnd);
}

export function openFile(path: string, hwnd: any) {
  const fs = new __API.fs.FileSystemAccess();
  const handle = fs.openFile(path);
  handle.read().then((text: string) => {
    view(`<h3>${path.split("/").pop()}</h3><pre>${text || ""}</pre>`, hwnd);
  });
}
