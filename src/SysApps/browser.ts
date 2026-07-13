//shitty port of pulsar without html

import "./browser.css";

import { attachsjFrame, pref } from "../Apis/scramjet";
import { nettransport } from "../Apis/scramjet/nettransport";
import { setContent } from "../Core/windowhelpers";

const sadg = "http://www.w3.org/2000/svg";

function url(raw: string): string {
  try {
    return new URL(raw).href;
  } catch {
    try {
      if (!raw.includes(".")) throw new Error();
      return new URL("https://" + raw).href;
    } catch {
      return "https://duckduckgo.com/?q=" + encodeURIComponent(raw);
    }
  }
}

function hist(url: string): void {
  const list: string[] = JSON.parse(localStorage.getItem("h") ?? "[]");
  list.push(url);
  localStorage.setItem("h", JSON.stringify(list));
}

function navButton(path: string, onClick: () => void): HTMLButtonElement {
  const svg = document.createElementNS(sadg, "svg");
  svg.setAttribute("viewBox", "0 0 512 512");
  svg.classList.add("browser-icon");

  const pathEl = document.createElementNS(sadg, "path");
  pathEl.setAttribute("d", path);
  svg.appendChild(pathEl);

  const btn = document.createElement("button");
  btn.classList.add("browser-btn");
  btn.appendChild(svg);
  btn.onclick = onClick;
  return btn;
}

export default function run(id: symbol) {
  const container = document.createElement("div");
  container.classList.add("browser-app");

  const bar = document.createElement("div");
  bar.classList.add("browser-bar");

  const iframe = document.createElement("iframe");
  iframe.classList.add("browser-frame");

  const back = navButton(
    // copied from fontawesome
    "9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 288 480 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-370.7 0 105.4-105.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z",
    () => iframe.contentWindow?.history.back(),
  );
  const forward = navButton(
    // copied from fontawesome
    "502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l370.7 0-105.4 105.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z",
    () => iframe.contentWindow?.history.forward(),
  );

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "URL or search...";
  urlInput.classList.add("browser-url");

  bar.appendChild(back);
  bar.appendChild(forward);
  bar.appendChild(urlInput);

  container.appendChild(bar);
  container.appendChild(iframe);
  setContent(id, container);

  attachsjFrame(iframe, new nettransport()).then((frame) => {
    urlInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const raw = urlInput.value.trim();
      if (!raw) return;
      frame.go(url(raw));
    });

    let lastUrl: string | undefined;
    setInterval(() => {
      const href = iframe.contentWindow?.location.href;
      if (!href) return;

      const idx = href.indexOf(pref);
      if (idx === -1) return;

      const url = decodeURIComponent(href.slice(idx + pref.length));
      urlInput.value = url;

      if (url !== lastUrl) {
        lastUrl = url;
        hist(url);
      }
    }, 1000);
  });
}
