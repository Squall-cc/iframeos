// vibecoded skid of games.ts for some stratus api fork i found on github, copied 1 to 1

import "./games.css";
import "./cloud.css";

import { CloudSession, type CloudStatus } from "../Apis/CloudGaming";
import { onWindowClose, setContent, setMinSize } from "../Core/windowhelpers";

export default function run(hwnd: symbol): void {
  setMinSize(hwnd, 480, 360);

  let session: CloudSession | null = null;
  let currentId: string | null = null;
  let currentHost: string | undefined;

  const root = document.createElement("div");
  root.className = "games-app cloud-app";

  function iconButton(iconClass: string, label: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "games-icon-btn";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    const icon = document.createElement("i");
    icon.className = iconClass;
    btn.appendChild(icon);
    return btn;
  }

  // header
  const header = document.createElement("div");
  header.className = "games-header";
  root.appendChild(header);

  const title = document.createElement("span");
  title.className = "cloud-title";
  title.textContent = "Cloud Gaming";
  header.appendChild(title);

  const statusPill = document.createElement("span");
  statusPill.className = "cloud-status cloud-status-ended";
  statusPill.textContent = "Disconnected";
  header.appendChild(statusPill);

  const infoBtn = iconButton("fa-solid fa-circle-info", "Session info");
  header.appendChild(infoBtn);

  const fullscreenBtn = iconButton("fa-solid fa-expand", "Fullscreen");
  header.appendChild(fullscreenBtn);

  const disconnectBtn = iconButton("fa-solid fa-plug-circle-xmark", "Disconnect");
  header.appendChild(disconnectBtn);

  const aboutBtn = iconButton("fa-solid fa-circle-question", "About");
  header.appendChild(aboutBtn);

  // stage
  const stage = document.createElement("div");
  stage.className = "cloud-stage";
  root.appendChild(stage);

  const video = document.createElement("video");
  video.className = "cloud-video";
  video.autoplay = true;
  video.playsInline = true;
  stage.appendChild(video);

  const connectingOverlay = document.createElement("div");
  connectingOverlay.className = "cloud-overlay";
  connectingOverlay.hidden = true;
  const spinner = document.createElement("div");
  spinner.className = "cloud-spinner";
  connectingOverlay.appendChild(spinner);
  const connectingLabel = document.createElement("span");
  connectingLabel.textContent = "Connecting to session...";
  connectingOverlay.appendChild(connectingLabel);
  stage.appendChild(connectingOverlay);

  const formOverlay = document.createElement("div");
  formOverlay.className = "cloud-overlay";
  stage.appendChild(formOverlay);

  const formIcon = document.createElement("i");
  formIcon.className = "fa-solid fa-satellite-dish";
  formOverlay.appendChild(formIcon);

  const formMessage = document.createElement("span");
  formMessage.className = "cloud-ended-message";
  formMessage.hidden = true;
  formOverlay.appendChild(formMessage);

  const idInput = document.createElement("input");
  idInput.type = "text";
  idInput.placeholder = "Session ID";
  idInput.className = "games-search cloud-id-input";
  formOverlay.appendChild(idInput);

  const hostInput = document.createElement("input");
  hostInput.type = "text";
  hostInput.placeholder = "Host override (optional)";
  hostInput.className = "games-search cloud-id-input";
  formOverlay.appendChild(hostInput);

  const connectBtn = document.createElement("button");
  connectBtn.className = "games-btn";
  connectBtn.textContent = "Connect";
  formOverlay.appendChild(connectBtn);

  // popup
  const popupOverlay = document.createElement("div");
  popupOverlay.className = "games-popup-overlay";
  popupOverlay.hidden = true;
  root.appendChild(popupOverlay);

  const popup = document.createElement("div");
  popup.className = "games-popup";
  popupOverlay.appendChild(popup);

  const popupHeader = document.createElement("div");
  popupHeader.className = "games-popup-header";
  const popupTitle = document.createElement("span");
  popupHeader.appendChild(popupTitle);
  const popupClose = iconButton("fa-solid fa-xmark", "Close");
  popupHeader.appendChild(popupClose);
  popup.appendChild(popupHeader);

  const popupBody = document.createElement("div");
  popupBody.className = "games-popup-body";
  popup.appendChild(popupBody);

  function closePopup() {
    popupOverlay.hidden = true;
  }
  function openPopup(title: string, body: HTMLElement) {
    popupTitle.textContent = title;
    popupBody.innerHTML = "";
    popupBody.appendChild(body);
    popupOverlay.hidden = false;
  }
  popupOverlay.addEventListener("click", (e) => {
    if (e.target === popupOverlay) closePopup();
  });
  popupClose.addEventListener("click", closePopup);

  // ---- streaming ----

  function updateStatus(status: CloudStatus, message?: string) {
    statusPill.textContent = status === "connecting" ? "Connecting" : status === "live" ? "Live" : "Disconnected";
    statusPill.className = `cloud-status cloud-status-${status}`;
    connectingOverlay.hidden = status !== "connecting";
    formOverlay.hidden = status !== "ended";
    formMessage.hidden = status !== "ended" || !message;
    if (status === "ended" && message) formMessage.textContent = message;
  }

  function connect(id: string, host?: string) {
    currentId = id;
    currentHost = host;
    session?.destroy();
    session = new CloudSession(hwnd, video, updateStatus);
    void session.connect(id, host);
  }

  // ---- events ----

  connectBtn.addEventListener("click", () => {
    const id = idInput.value.trim();
    if (!id) return;
    connect(id, hostInput.value.trim() || undefined);
  });
  idInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") connectBtn.click();
  });

  disconnectBtn.addEventListener("click", () => {
    session?.destroy();
    session = null;
    updateStatus("ended");
  });

  fullscreenBtn.addEventListener("click", () => {
    void video.requestFullscreen?.();
  });

  infoBtn.addEventListener("click", () => {
    const body = document.createElement("div");
    const rows: [string, string][] = [
      ["Session ID", currentId ?? "—"],
      ["Host override", currentHost ?? "default"],
    ];
    for (const [k, v] of rows) {
      const p = document.createElement("p");
      p.style.margin = "0";
      const b = document.createElement("b");
      b.textContent = `${k}: `;
      p.appendChild(b);
      p.appendChild(document.createTextNode(v));
      body.appendChild(p);
    }
    openPopup("Session Info", body);
  });

  aboutBtn.addEventListener("click", () => {
    const body = document.createElement("div");
    const p = document.createElement("p");
    p.style.margin = "0";
    p.textContent =
      "Connects to a remote session over WebRTC and streams keyboard, mouse, and gamepad input back to it in real time.";
    body.appendChild(p);
    openPopup("About", body);
  });

  onWindowClose(hwnd, () => session?.destroy());

  setContent(hwnd, root);
  updateStatus("ended");

  // the page's own URL can deep-link straight into a session
  const params = new URLSearchParams(window.location.search);
  const urlId = params.get("id");
  const urlHost = params.get("host");
  if (urlId) {
    idInput.value = urlId;
    if (urlHost) hostInput.value = urlHost;
    connect(urlId, urlHost ?? undefined);
  }
}
