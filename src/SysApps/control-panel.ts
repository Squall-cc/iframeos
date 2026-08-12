import { shellModal, shellSelectFile } from "../Apis/iSApi";
import { resetSystem } from "../Apis/system-defaults";
import { applyTheme, getTaskbarBlur, getThemeList, setTaskbarBlur } from "../Apis/theme";
import { FileSystemAccess } from "../Apis/FileSystemApi";
import {
  getAllWallpapers,
  getCurrentWallpaperId,
  saveWallpaperFile,
  setCurrentWallpaper,
  type WallpaperInfo,
} from "../Core/wallpaper";
import { setContent, setMinSize, spawn } from "../Core/windowhelpers";

import appInstaller from "./app-installer";

const btnStyle =
  "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;";
const ghostBtnStyle =
  "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);align-self:flex-start;";

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 460, 360);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;box-sizing:border-box;";

  const header = document.createElement("div");
  header.style.cssText = "font-weight:600;font-size:14px;padding:12px 12px 0;";
  header.textContent = "Control Panel";
  container.appendChild(header);

  const desc = document.createElement("div");
  desc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);padding:0 12px 10px;";
  desc.textContent = "Manage system settings and reset configuration.";
  container.appendChild(desc);

  const body = document.createElement("div");
  body.style.cssText = "flex:1;overflow-y:auto;padding:0 12px 12px;display:flex;flex-direction:column;gap:12px;";
  container.appendChild(body);

  // ---- wallpaper selector ----
  const wallpaperSection = document.createElement("div");
  wallpaperSection.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid rgba(0,100,200,0.2);border-radius:4px;background:rgba(0,100,200,0.03);";

  const wallpaperHeader = document.createElement("div");
  wallpaperHeader.style.cssText = "font-weight:600;font-size:12px;color:#0078d4;";
  wallpaperHeader.textContent = "Wallpaper";
  wallpaperSection.appendChild(wallpaperHeader);

  const wallpaperDesc = document.createElement("div");
  wallpaperDesc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:4px;";
  wallpaperDesc.textContent = "Pick a background image. Uploaded wallpapers are stored in the VFS.";
  wallpaperSection.appendChild(wallpaperDesc);

  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;";
  wallpaperSection.appendChild(grid);

  const addWallpaperBtn = document.createElement("button");
  addWallpaperBtn.textContent = "Add from guest (VFS)...";
  addWallpaperBtn.style.cssText = ghostBtnStyle;
  addWallpaperBtn.addEventListener("click", async () => {
    const path = await shellSelectFile({
      title: "Choose an image",
      filter: { label: "Images", extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"] },
    });
    if (!path) return;
    const fs = new FileSystemAccess();
    const blob = await fs.data.read(path);
    if (!blob) {
      await shellModal("error", hwnd, "Read Failed", `Could not read "${path}".`);
      return;
    }
    const name = path.split("/").filter(Boolean).pop() || "wallpaper.png";
    const file = new File([blob], name);
    try {
      await saveWallpaperFile(file);
      await shellModal("info", hwnd, "Wallpaper Added", `"${name}" was added to the wallpapers folder.`);
      renderWallpapers();
    } catch (e) {
      await shellModal("error", hwnd, "Upload Failed", `An error occurred: ${(e as Error).message}`);
    }
  });
  wallpaperSection.appendChild(addWallpaperBtn);
  body.appendChild(wallpaperSection);

  async function renderWallpapers() {
    const [all, current] = await Promise.all([getAllWallpapers(), getCurrentWallpaperId()]);
    grid.innerHTML = "";
    for (const w of all) {
      grid.appendChild(makeWallpaperTile(w, current));
    }
  }

  function makeWallpaperTile(w: WallpaperInfo, currentId: string): HTMLElement {
    const tile = document.createElement("button");
    tile.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;cursor:pointer;border:1px solid rgba(0,0,0,0.15);border-radius:4px;background:rgba(255,255,255,0.5);overflow:hidden;";
    if (w.id === currentId) {
      tile.style.border = "2px solid #0078d4";
    }

    const preview = document.createElement("div");
    preview.style.cssText = "width:100%;height:52px;background-size:cover;background-position:center;border-radius:2px;background-color:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;";
    if (w.vanta) {
      preview.style.background = "linear-gradient(135deg, #008542, #89ab0e)";
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-wave-square";
      icon.style.cssText = "color:rgba(255,255,255,0.85);font-size:18px;";
      preview.appendChild(icon);
    } else if (w.url) {
      preview.style.backgroundImage = `url("${w.url}")`;
    }
    tile.appendChild(preview);

    const label = document.createElement("span");
    label.style.cssText = "font-size:10px;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    label.textContent = w.name;
    tile.appendChild(label);

    tile.addEventListener("click", async () => {
      await setCurrentWallpaper(w.id);
      renderWallpapers();
    });
    return tile;
  }

  // ---- theme selector ----
  const themeSection = document.createElement("div");
  themeSection.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid rgba(0,100,200,0.2);border-radius:4px;background:rgba(0,100,200,0.03);";

  const themeHeader = document.createElement("div");
  themeHeader.style.cssText = "font-weight:600;font-size:12px;color:#0078d4;";
  themeHeader.textContent = "Theme";
  themeSection.appendChild(themeHeader);

  const themeDesc = document.createElement("div");
  themeDesc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:4px;";
  themeDesc.textContent = "Pick an accent color scheme. Also recolors the Vanta wallpaper when it's active.";
  themeSection.appendChild(themeDesc);

  const themeGrid = document.createElement("div");
  themeGrid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;";
  themeSection.appendChild(themeGrid);

  const savedTheme = localStorage.getItem("theme") || "windows7";
  for (const t of getThemeList()) {
    const card = document.createElement("button");
    card.className = "theme-card";
    card.dataset.theme = t.id;
    card.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;cursor:pointer;border:1px solid rgba(0,0,0,0.15);border-radius:4px;background:rgba(255,255,255,0.5);";
    if (t.id === savedTheme) card.style.border = "2px solid #0078d4";

    const swatches = document.createElement("div");
    swatches.style.cssText = "display:flex;width:100%;height:28px;border-radius:2px;overflow:hidden;";
    for (const color of t.swatches) {
      const chip = document.createElement("div");
      chip.style.cssText = `flex:1;background:${color};`;
      swatches.appendChild(chip);
    }
    card.appendChild(swatches);

    const label = document.createElement("span");
    label.style.cssText = "font-size:10px;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    label.textContent = t.name;
    card.appendChild(label);

    card.addEventListener("click", () => {
      applyTheme(t.id);
      for (const c of Array.from(themeGrid.children) as HTMLElement[]) {
        c.style.border = c.dataset.theme === t.id ? "2px solid #0078d4" : "1px solid rgba(0,0,0,0.15)";
      }
    });
    themeGrid.appendChild(card);
  }

  const blurRow = document.createElement("label");
  blurRow.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;margin-top:2px;cursor:pointer;";
  const blurCheckbox = document.createElement("input");
  blurCheckbox.type = "checkbox";
  blurCheckbox.checked = getTaskbarBlur();
  blurCheckbox.addEventListener("change", () => {
    setTaskbarBlur(blurCheckbox.checked);
  });
  blurRow.appendChild(blurCheckbox);
  blurRow.appendChild(document.createTextNode("Blur taskbar background"));
  themeSection.appendChild(blurRow);

  body.appendChild(themeSection);

  // ---- apps section ----
  const appsSection = document.createElement("div");
  appsSection.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid rgba(0,100,200,0.2);border-radius:4px;background:rgba(0,100,200,0.03);";

  const appsHeader = document.createElement("div");
  appsHeader.style.cssText = "font-weight:600;font-size:12px;color:#0078d4;";
  appsHeader.textContent = "Apps";
  appsSection.appendChild(appsHeader);

  const appsDesc = document.createElement("div");
  appsDesc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:8px;";
  appsDesc.textContent = "Install, uninstall, and configure file type associations for apps.";
  appsSection.appendChild(appsDesc);

  const appManagerBtn = document.createElement("button");
  appManagerBtn.textContent = "Open App Manager";
  appManagerBtn.style.cssText = btnStyle;
  appManagerBtn.addEventListener("click", () => {
    spawn("App Manager", appInstaller);
  });
  appsSection.appendChild(appManagerBtn);
  body.appendChild(appsSection);

  // ---- reset section ----
  const resetSection = document.createElement("div");
  resetSection.style.cssText = "display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid rgba(200,0,0,0.2);border-radius:4px;background:rgba(200,0,0,0.03);";

  const resetHeader = document.createElement("div");
  resetHeader.style.cssText = "font-weight:600;font-size:12px;color:#c00;";
  resetHeader.textContent = "Reset System";
  resetSection.appendChild(resetHeader);

  const resetDesc = document.createElement("div");
  resetDesc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-bottom:8px;";
  resetDesc.textContent = "Wipes the registry and filesystem back to factory defaults (built-in apps, default directories, wallpaper, and file associations), then reloads the system.";
  resetSection.appendChild(resetDesc);

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset to Defaults";
  resetBtn.style.cssText = "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(200,0,0,0.5);border-radius:2px;background:rgba(200,0,0,0.1);font-weight:600;align-self:flex-start;";
  resetBtn.addEventListener("click", async () => {
    const confirm = await shellModal("yesno", hwnd, "Confirm Reset", "This will wipe the registry and filesystem, removing all installed apps and user files, and restore the system to factory defaults. Continue?");
    if (confirm !== "yes") return;

    const confirm2 = await shellModal("yesno", hwnd, "Are You Sure?", "All installed apps and user files will be permanently deleted. This cannot be undone.");
    if (confirm2 !== "yes") return;

    resetBtn.disabled = true;
    resetBtn.textContent = "Resetting...";

    try {
      await resetSystem();
    } catch (e) {
      await shellModal("error", hwnd, "Reset Failed", `An error occurred: ${(e as Error).message}`);
      resetBtn.disabled = false;
      resetBtn.textContent = "Reset to Defaults";
    }
  });
  resetSection.appendChild(resetBtn);
  body.appendChild(resetSection);

  renderWallpapers();

  setContent(hwnd, container);
}
