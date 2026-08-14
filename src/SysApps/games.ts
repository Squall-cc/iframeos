import "./games.css";

import { shellModal } from "../Apis/iSApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

interface GameZone {
  id: number;
  name: string;
  url: string;
  cover: string;
  author?: string;
  authorLink?: string;
  special?: string[];
  featured?: boolean;
}

const ZONES_URLS = [
  "https://cdn.jsdelivr.net/gh/daknux/assets@latest/zones.json",
  "https://cdn.jsdelivr.net/gh/daknux/assets@master/zones.json",
  "https://cdn.jsdelivr.net/gh/daknux/assets/zones.json",
];
const COVER_URL = "https://cdn.jsdelivr.net/gh/daknux/covers@main";
const HTML_URL = "https://cdn.jsdelivr.net/gh/daknux/html@main";
const STATS_BASE = "https://data.jsdelivr.com/v1/stats/packages/gh/daknux/html@main/files";

function resolveUrl(template: string): string {
  return template.replace("{COVER_URL}", COVER_URL).replace("{HTML_URL}", HTML_URL);
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

const SORT_OPTIONS: [string, string][] = [
  ["name", "Name"],
  ["id", "Newest"],
  ["popular", "Most Played (Year)"],
  ["trendingMonth", "Trending (Month)"],
  ["trendingWeek", "Trending (Week)"],
  ["trendingDay", "Trending (Day)"],
];

export default function run(hwnd: symbol): void {
  setMinSize(hwnd, 480, 360);

  let zones: GameZone[] = [];
  const popularity: Record<string, Record<number, number>> = {};
  let observer: IntersectionObserver | null = null;
  let frame: HTMLIFrameElement | null = null;

  const root = document.createElement("div");
  root.className = "games-app";

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
  search.placeholder = "Search games..."
  search.className = "games-search";
  header.appendChild(search);

  const sortSelect = document.createElement("select");
  sortSelect.className = "games-select";
  for (const [value, label] of SORT_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    sortSelect.appendChild(opt);
  }
  header.appendChild(sortSelect);

  const filterSelect = document.createElement("select");
  filterSelect.className = "games-select";
  const noneOpt = document.createElement("option");
  noneOpt.value = "none";
  noneOpt.textContent = "All Tags";
  filterSelect.appendChild(noneOpt);
  header.appendChild(filterSelect);

  const randomBtn = iconButton("fa-solid fa-shuffle", "Random game");
  header.appendChild(randomBtn);

  const settingsBtn = iconButton("fa-solid fa-gear", "Settings");
  header.appendChild(settingsBtn);

  const aboutBtn = iconButton("fa-solid fa-circle-info", "About");
  header.appendChild(aboutBtn);

  // ftrd
  const featuredDetails = document.createElement("details");
  featuredDetails.className = "games-featured";
  featuredDetails.open = true;
  featuredDetails.hidden = true;
  const featuredSummary = document.createElement("summary");
  featuredSummary.textContent = "Featured";
  featuredDetails.appendChild(featuredSummary);
  const featuredGrid = document.createElement("div");
  featuredGrid.className = "games-grid games-grid-featured";
  featuredDetails.appendChild(featuredGrid);
  root.appendChild(featuredDetails);

  // games+ summary
  const gridSummary = document.createElement("div");
  gridSummary.className = "games-grid-summary";
  gridSummary.textContent = "Loading...";
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

  const viewerInfo = document.createElement("div");
  viewerInfo.className = "games-viewer-info";
  const viewerName = document.createElement("span");
  viewerName.className = "games-viewer-name";
  const viewerAuthor = document.createElement("span");
  viewerAuthor.className = "games-viewer-author";
  viewerInfo.appendChild(viewerName);
  viewerInfo.appendChild(viewerAuthor);
  viewerBar.appendChild(viewerInfo);

  const viewerInfoBtn = iconButton("fa-solid fa-circle-info", "Game info");
  const viewerDownloadBtn = iconButton("fa-solid fa-download", "Download"); // andrey
  const viewerPopoutBtn = iconButton("fa-solid fa-up-right-from-square", "Open in new tab");
  const viewerFullscreenBtn = iconButton("fa-solid fa-expand", "Fullscreen");
  viewerBar.appendChild(viewerInfoBtn);
  viewerBar.appendChild(viewerDownloadBtn);
  viewerBar.appendChild(viewerPopoutBtn);
  viewerBar.appendChild(viewerFullscreenBtn);

  const viewerFrameWrap = document.createElement("div");
  viewerFrameWrap.className = "games-viewer-frame-wrap";
  viewer.appendChild(viewerFrameWrap);

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

  // ai perf optimization
  function observeLazyImages(container: HTMLElement) {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) img.src = img.dataset.src;
            img.classList.remove("games-lazy-img");
            obs.unobserve(img);
          }
        },
        { rootMargin: "150px", threshold: 0.1 },
      );
    }
    container.querySelectorAll("img.games-lazy-img").forEach((img) => observer!.observe(img));
  }

  function makeCard(zone: GameZone): HTMLButtonElement {
    const card = document.createElement("button");
    card.className = "games-card";
    const img = document.createElement("img");
    img.dataset.src = resolveUrl(zone.cover);
    img.alt = zone.name;
    img.loading = "lazy";
    img.className = "games-lazy-img";
    card.appendChild(img);
    const label = document.createElement("span");
    label.className = "games-card-label";
    label.textContent = zone.name;
    card.appendChild(label);
    card.addEventListener("click", () => void openZone(zone));
    return card;
  }

  function currentList(): GameZone[] {
    let list = zones.slice();
    const sortBy = sortSelect.value;
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "id") {
      list.sort((a, b) => b.id - a.id);
    } else {
      const period = sortBy === "popular" ? "year" : sortBy === "trendingMonth" ? "month" : sortBy === "trendingWeek" ? "week" : "day";
      const data = popularity[period] ?? {};
      list.sort((a, b) => (data[b.id] ?? 0) - (data[a.id] ?? 0));
    }
    const tag = filterSelect.value;
    if (tag !== "none") list = list.filter((z) => z.special?.includes(tag));
    const q = search.value.trim().toLowerCase();
    if (q) list = list.filter((z) => z.name.toLowerCase().includes(q));
    return list;
  }

  function render() {
    const list = currentList();
    grid.innerHTML = "";
    for (const zone of list) grid.appendChild(makeCard(zone));
    gridSummary.textContent = zones.length === 0 ? "No games available" : `${list.length} game${list.length === 1 ? "" : "s"}`;
    observeLazyImages(grid);
  }

  function displayFeatured(list: GameZone[]) {
    featuredGrid.innerHTML = "";
    for (const zone of list) featuredGrid.appendChild(makeCard(zone));
    featuredDetails.hidden = list.length === 0;
    observeLazyImages(featuredGrid);
  }

  async function pickZonesUrl(): Promise<string> {
    try {
      const res = await fetch(`https://api.github.com/repos/daknux/assets/commits?t=${Date.now()}`);
      if (res.ok) {
        const json = (await res.json()) as { sha?: string }[];
        const sha = json?.[0]?.sha;
        if (sha) return `https://cdn.jsdelivr.net/gh/daknux/assets@${sha}/zones.json`;
      }
    } catch {
      // fall through to a versioned mirror below
    }
    return ZONES_URLS[Math.floor(Math.random() * ZONES_URLS.length)];
  }

  async function fetchPopularity(period: string): Promise<Record<number, number>> {
    const out: Record<number, number> = {};
    try {
      const res = await fetch(`${STATS_BASE}?period=${period}`);
      const data = (await res.json()) as { name: string; hits?: { total?: number } }[];
      for (const file of data) {
        const m = file.name.match(/\/(\d+)\.html$/);
        if (m) out[Number(m[1])] = file.hits?.total ?? 0;
      }
    } catch {
      // sorting falls back to treating everything as 0 plays
    }
    return out;
  }

  async function loadZones() {
    gridSummary.textContent = "Loading...";
    try {
      const url = await pickZonesUrl();
      const res = await fetch(`${url}?t=${Date.now()}`);
      const json = (await res.json()) as GameZone[];
      zones = json;
      if (zones[0]) zones[0].featured = true;

      const [year, month, week, day] = await Promise.all([
        fetchPopularity("year"),
        fetchPopularity("month"),
        fetchPopularity("week"),
        fetchPopularity("day"),
      ]);
      popularity.year = year;
      popularity.month = month;
      popularity.week = week;
      popularity.day = day;

      const tags = new Set<string>();
      for (const z of zones) for (const t of z.special ?? []) tags.add(t);
      for (const tag of tags) {
        const opt = document.createElement("option");
        opt.value = tag;
        opt.textContent = toTitleCase(tag);
        filterSelect.appendChild(opt);
      }

      displayFeatured(zones.filter((z) => z.featured));
      render();
    } catch (e) {
      gridSummary.textContent = `Failed to load games: ${(e as Error).message}`;
    }
  }

  async function openZone(zone: GameZone) {
    if (zone.url.startsWith("http")) {
      window.open(zone.url, "_blank");
      return;
    }
    try {
      const html = await (await fetch(`${resolveUrl(zone.url)}?t=${Date.now()}`)).text();
      viewerFrameWrap.innerHTML = "";
      frame = document.createElement("iframe");
      frame.className = "games-frame";
      viewerFrameWrap.appendChild(frame);
      const doc = frame.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
      viewerName.textContent = zone.name;
      viewerAuthor.textContent = zone.author ? `by ${zone.author}` : "";
      viewer.dataset.zoneId = String(zone.id);
      viewer.hidden = false;
    } catch (e) {
      await shellModal("error", hwnd, "Failed to Load", `Could not load "${zone.name}": ${(e as Error).message}`);
    }
  }

  function closeViewer() {
    viewer.hidden = true;
    viewerFrameWrap.innerHTML = "";
    frame = null;
  }

  function activeZone(): GameZone | undefined {
    return zones.find((z) => String(z.id) === viewer.dataset.zoneId);
  }

  async function randomZone() {
    if (zones.length === 0) {
      await shellModal("info", hwnd, "No Games", "No games are available yet.");
      return;
    }
    await openZone(zones[Math.floor(Math.random() * zones.length)]);
  }

  // ---- events ----
  search.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  filterSelect.addEventListener("change", render);
  randomBtn.addEventListener("click", () => void randomZone());
  viewerBack.addEventListener("click", closeViewer);

  viewerDownloadBtn.addEventListener("click", async () => {
    const zone = activeZone();
    if (!zone) return;
    const text = await (await fetch(`${resolveUrl(zone.url)}?t=${Date.now()}`)).text();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${zone.name}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  viewerPopoutBtn.addEventListener("click", async () => {
    const zone = activeZone();
    if (!zone) return;
    const win = window.open("about:blank", "_blank");
    const html = await (await fetch(`${resolveUrl(zone.url)}?t=${Date.now()}`)).text();
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  });

  viewerFullscreenBtn.addEventListener("click", () => {
    void frame?.requestFullscreen?.();
  });

  viewerInfoBtn.addEventListener("click", () => {
    const zone = activeZone();
    if (!zone) return;
    const body = document.createElement("div");
    const rows: [string, string][] = [
      ["ID", String(zone.id)],
      ["Name", zone.name],
    ];
    if (zone.author) rows.push(["Author", zone.author]);
    if (zone.special?.length) rows.push(["Tags", zone.special.map(toTitleCase).join(", ")]);
    for (const [k, v] of rows) {
      const p = document.createElement("p");
      p.style.margin = "0";
      const b = document.createElement("b");
      b.textContent = `${k}: `;
      p.appendChild(b);
      p.appendChild(document.createTextNode(v));
      body.appendChild(p);
    }
    openPopup("Game Info", body);
  });

  settingsBtn.addEventListener("click", () => {
    const body = document.createElement("div");
    const randomAction = document.createElement("button");
    randomAction.className = "games-btn";
    randomAction.textContent = "Play a Random Game";
    randomAction.addEventListener("click", () => {
      closePopup();
      void randomZone();
    });
    body.appendChild(randomAction);
    openPopup("Settings", body);
  });

  aboutBtn.addEventListener("click", () => {
    const body = document.createElement("div");
    const p = document.createElement("p");
    p.style.margin = "0";
    p.textContent = "Game listings and playable builds are pulled live from a public, community-maintained catalog.";
    body.appendChild(p);
    openPopup("About", body);
  });

  setContent(hwnd, root);
  void loadZones();
}
