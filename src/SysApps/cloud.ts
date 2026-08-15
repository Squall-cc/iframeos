// vibecoded skid of games.ts for some stratus api fork i found on github, copied 1 to 1

import "./games.css";
import "./cloud.css";

import catalogData from "../Assets/cloud.json";
import { CloudSession, launchGameSession, type CloudStatus } from "../Apis/CloudGaming";
import { wFetchBlob } from "../Core/systems";
import { onWindowClose, setContent, setMinSize } from "../Core/windowhelpers";

interface CloudGame {
  name: string;
  game_key: string;
  description: string;
  image: string;
  cover: string;
  tags: string[];
}

const catalog = catalogData as CloudGame[];

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

export default function run(hwnd: symbol): void {
  setMinSize(hwnd, 480, 360);

  let session: CloudSession | null = null;
  let currentGame: CloudGame | null = null;
  let observer: IntersectionObserver | null = null;
  const imageCache = new Map<string, string>();

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

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Search games...";
  search.className = "games-search";
  header.appendChild(search);

  const filterSelect = document.createElement("select");
  filterSelect.className = "games-select";
  const noneOpt = document.createElement("option");
  noneOpt.value = "none";
  noneOpt.textContent = "All Tags";
  filterSelect.appendChild(noneOpt);
  header.appendChild(filterSelect);

  const randomBtn = iconButton("fa-solid fa-shuffle", "Random game");
  header.appendChild(randomBtn);

  const aboutBtn = iconButton("fa-solid fa-circle-question", "About");
  header.appendChild(aboutBtn);

  // grid summary + grid
  const gridSummary = document.createElement("div");
  gridSummary.className = "games-grid-summary";
  root.appendChild(gridSummary);

  const grid = document.createElement("div");
  grid.className = "games-grid";
  root.appendChild(grid);

  // viewer
  const viewer = document.createElement("div");
  viewer.className = "games-viewer";
  viewer.hidden = true;
  root.appendChild(viewer);

  const viewerBar = document.createElement("div");
  viewerBar.className = "games-viewer-bar";
  viewer.appendChild(viewerBar);

  const viewerBack = iconButton("fa-solid fa-arrow-left", "Back to library");
  viewerBar.appendChild(viewerBack);

  const viewerInfoBox = document.createElement("div");
  viewerInfoBox.className = "games-viewer-info";
  const viewerName = document.createElement("span");
  viewerName.className = "games-viewer-name";
  const viewerAuthor = document.createElement("span");
  viewerAuthor.className = "games-viewer-author";
  viewerInfoBox.appendChild(viewerName);
  viewerInfoBox.appendChild(viewerAuthor);
  viewerBar.appendChild(viewerInfoBox);

  const statusPill = document.createElement("span");
  statusPill.className = "cloud-status cloud-status-ended";
  viewerBar.appendChild(statusPill);

  const viewerInfoBtn = iconButton("fa-solid fa-circle-info", "Game info");
  const viewerFullscreenBtn = iconButton("fa-solid fa-expand", "Fullscreen");
  viewerBar.appendChild(viewerInfoBtn);
  viewerBar.appendChild(viewerFullscreenBtn);

  const stage = document.createElement("div");
  stage.className = "games-viewer-frame-wrap cloud-stage";
  viewer.appendChild(stage);

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

  const endedOverlay = document.createElement("div");
  endedOverlay.className = "cloud-overlay";
  endedOverlay.hidden = true;
  const endedIcon = document.createElement("i");
  endedIcon.className = "fa-solid fa-plug-circle-xmark";
  endedOverlay.appendChild(endedIcon);
  const endedMessage = document.createElement("span");
  endedMessage.className = "cloud-ended-message";
  endedOverlay.appendChild(endedMessage);
  const reconnectBtn = document.createElement("button");
  reconnectBtn.className = "games-btn";
  reconnectBtn.textContent = "Retry";
  endedOverlay.appendChild(reconnectBtn);
  stage.appendChild(endedOverlay);

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

  // ---- cover images, fetched through wisp (hotlink-protected CDN) ----

  async function loadCover(img: HTMLImageElement, rawUrl: string) {
    const cached = imageCache.get(rawUrl);
    if (cached) {
      img.src = cached;
      return;
    }
    try {
      const blobUrl = await wFetchBlob(rawUrl);
      imageCache.set(rawUrl, blobUrl);
      img.src = blobUrl;
    } catch {
      // leave the card without a cover rather than break the grid
    }
  }

  function observeLazyImages(container: HTMLElement) {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) void loadCover(img, img.dataset.src);
            img.classList.remove("games-lazy-img");
            obs.unobserve(img);
          }
        },
        { rootMargin: "150px", threshold: 0.1 },
      );
    }
    container.querySelectorAll("img.games-lazy-img").forEach((img) => observer!.observe(img));
  }

  function makeCard(game: CloudGame): HTMLButtonElement {
    const card = document.createElement("button");
    card.className = "games-card";
    const img = document.createElement("img");
    img.dataset.src = game.cover;
    img.alt = game.name;
    img.loading = "lazy";
    img.className = "games-lazy-img";
    card.appendChild(img);
    const label = document.createElement("span");
    label.className = "games-card-label";
    label.textContent = game.name;
    card.appendChild(label);
    card.addEventListener("click", () => void playGame(game));
    return card;
  }

  function currentList(): CloudGame[] {
    let list = catalog.slice();
    const tag = filterSelect.value;
    if (tag !== "none") list = list.filter((g) => g.tags.includes(tag));
    const q = search.value.trim().toLowerCase();
    if (q) list = list.filter((g) => g.name.toLowerCase().includes(q));
    return list;
  }

  function render() {
    const list = currentList();
    grid.innerHTML = "";
    for (const game of list) grid.appendChild(makeCard(game));
    gridSummary.textContent = `${list.length} game${list.length === 1 ? "" : "s"}`;
    observeLazyImages(grid);
  }

  // ---- streaming ----

  function updateStatus(status: CloudStatus, message?: string) {
    statusPill.textContent = status === "connecting" ? "Connecting" : status === "live" ? "Live" : "Ended";
    statusPill.className = `cloud-status cloud-status-${status}`;
    connectingOverlay.hidden = status !== "connecting";
    endedOverlay.hidden = status !== "ended";
    if (status === "ended") endedMessage.textContent = message ?? "The session has ended.";
  }

  async function playGame(game: CloudGame) {
    currentGame = game;
    viewerName.textContent = game.name;
    viewerAuthor.textContent = game.tags.join(", ");
    viewer.hidden = false;

    session?.destroy();
    session = new CloudSession(hwnd, video, updateStatus);

    updateStatus("connecting");
    connectingLabel.textContent = "Creating session...";
    try {
      const embed = await launchGameSession(game.game_key, (message) => {
        connectingLabel.textContent = message;
      });
      session.connectWithEmbedData(embed);
    } catch (e) {
      updateStatus("ended", (e as Error).message);
    }
  }

  function closeViewer() {
    session?.destroy();
    session = null;
    viewer.hidden = true;
    currentGame = null;
  }

  async function randomGame() {
    if (catalog.length === 0) return;
    await playGame(catalog[Math.floor(Math.random() * catalog.length)]);
  }

  // ---- events ----
  search.addEventListener("input", render);
  filterSelect.addEventListener("change", render);
  randomBtn.addEventListener("click", () => void randomGame());
  viewerBack.addEventListener("click", closeViewer);
  reconnectBtn.addEventListener("click", () => {
    if (currentGame) void playGame(currentGame);
  });

  viewerFullscreenBtn.addEventListener("click", () => {
    void video.requestFullscreen?.();
  });

  viewerInfoBtn.addEventListener("click", () => {
    if (!currentGame) return;
    const body = document.createElement("div");
    const rows: [string, string][] = [
      ["Name", currentGame.name],
      ["Tags", currentGame.tags.map(toTitleCase).join(", ")],
      ["Game key", currentGame.game_key],
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
    const desc = document.createElement("p");
    desc.style.margin = "6px 0 0";
    desc.textContent = currentGame.description;
    body.appendChild(desc);
    openPopup("Game Info", body);
  });

  aboutBtn.addEventListener("click", () => {
    const body = document.createElement("div");
    const p = document.createElement("p");
    p.style.margin = "0";
    p.textContent =
      "Starts a remote session for the selected game and streams it over WebRTC, taking over keyboard, mouse, and gamepad input while connected.";
    body.appendChild(p);
    openPopup("About", body);
  });

  onWindowClose(hwnd, () => {
    session?.destroy();
    for (const url of imageCache.values()) URL.revokeObjectURL(url);
  });

  const tags = new Set<string>();
  for (const g of catalog) for (const t of g.tags) tags.add(t);
  for (const tag of [...tags].sort()) {
    const opt = document.createElement("option");
    opt.value = tag;
    opt.textContent = toTitleCase(tag);
    filterSelect.appendChild(opt);
  }

  setContent(hwnd, root);
  render();
}
