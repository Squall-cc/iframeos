import { FileSystemAccess } from "../Apis/FileSystemApi";
import { getAllInstalledApps, launchSpaApp, shellSelectFile } from "../Apis/iSApi";
import { installSpaFromZip, parseSpaArchive } from "../Apis/SpaApp";
import { setContent, setMinSize } from "../Core/windowhelpers";

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 550, 420);

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const header = document.createElement("div");
  header.style.cssText = "padding:8px;font-weight:600;font-size:13px;border-bottom:1px solid rgba(0,0,0,0.15);";
  header.textContent = "App Installer";
  container.appendChild(header);

  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid rgba(0,0,0,0.1);";

  const hostTab = document.createElement("button");
  hostTab.textContent = "From Host";
  hostTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:#fff;border-bottom:2px solid #0078d4;";
  tabs.appendChild(hostTab);

  const guestTab = document.createElement("button");
  guestTab.textContent = "From Guest";
  guestTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:rgba(0,0,0,0.04);border-bottom:2px solid transparent;";
  tabs.appendChild(guestTab);

  const installedTab = document.createElement("button");
  installedTab.textContent = "Installed";
  installedTab.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px 2px 0 0;background:rgba(0,0,0,0.04);border-bottom:2px solid transparent;";
  tabs.appendChild(installedTab);

  container.appendChild(tabs);

  const content = document.createElement("div");
  content.style.cssText = "flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;";
  container.appendChild(content);

  const statusBar = document.createElement("div");
  statusBar.style.cssText = "padding:4px 8px;border-top:1px solid rgba(0,0,0,0.1);font-size:11px;color:rgba(0,0,0,0.5);";
  statusBar.textContent = "Ready";
  container.appendChild(statusBar);

  function activateTab(active: HTMLElement, others: HTMLElement[]) {
    active.style.background = "#fff";
    active.style.borderBottom = "2px solid #0078d4";
    for (const other of others) {
      other.style.background = "rgba(0,0,0,0.04)";
      other.style.borderBottom = "2px solid transparent";
    }
  }

  const btnStyle =
    "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;align-self:flex-start;";
  const ghostBtnStyle =
    "padding:6px 16px;font-size:12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);align-self:flex-start;";

  // shared confirmation step: show the manifest and let the user pick which
  // file types from the manifest's "fileassoc" list get registered
  function showConfirmView(
    bytes: ArrayBuffer,
    fileName: string,
    back: () => void,
  ) {
    statusBar.textContent = "Parsing archive...";
    parseSpaArchive(bytes)
      .then((info) => {
        content.innerHTML = "";
        const raw = info.manifest;

        const title = document.createElement("div");
        title.style.cssText = "font-weight:600;font-size:13px;";
        title.textContent = `Install "${raw["name"] ?? fileName}" v${raw["version"] ?? "?"}`;
        content.appendChild(title);

        const keyRow = document.createElement("div");
        keyRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);";
        keyRow.textContent = `Key: ${String(raw["key"] ?? "?")}`;
        content.appendChild(keyRow);

        const descRow = document.createElement("div");
        descRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);";
        descRow.textContent = String(raw["description"] ?? "");
        content.appendChild(descRow);

        const entryRow = document.createElement("div");
        entryRow.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);";
        entryRow.textContent = `Entry point: ${String(raw["entryPoint"] ?? "run")}`;
        content.appendChild(entryRow);

        const fileOpener = raw["fileOpener"];

        if (fileOpener && info.fileAssociations.length > 0) {
          const assocLabel = document.createElement("div");
          assocLabel.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-top:4px;";
          assocLabel.textContent = `Associate these file types with "${raw["name"] ?? fileName}"?`;
          content.appendChild(assocLabel);

          const box = document.createElement("div");
          box.style.cssText = "display:flex;flex-direction:column;gap:4px;padding:6px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

          for (const ext of info.fileAssociations) {
            const row = document.createElement("label");
            row.style.cssText = "display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = true;
            cb.value = ext;
            cb.style.cssText = "margin:0;cursor:pointer;";

            row.appendChild(cb);
            row.appendChild(document.createTextNode(ext));
            box.appendChild(row);
          }
          content.appendChild(box);
        }

        const rowBtns = document.createElement("div");
        rowBtns.style.cssText = "display:flex;gap:8px;align-items:center;";

        const installBtn = document.createElement("button");
        installBtn.textContent = "Install";
        installBtn.style.cssText = btnStyle;
        installBtn.addEventListener("click", async () => {
          const selected = [...content.querySelectorAll('input[type="checkbox"]:checked')]
            .map((cb) => (cb as HTMLInputElement).value)
            .filter(Boolean);
          installBtn.disabled = true;
          installBtn.textContent = "Installing...";
          statusBar.textContent = "Installing...";
          try {
            const name = await installSpaFromZip(bytes, {
              fileAssociations: selected,
            });
            statusBar.textContent = `Installed "${name}" successfully`;
            back();
          } catch (e) {
            statusBar.textContent = `Error: ${(e as Error).message}`;
            installBtn.disabled = false;
            installBtn.textContent = "Install";
          }
        });
        rowBtns.appendChild(installBtn);

        const backBtn = document.createElement("button");
        backBtn.textContent = "Back";
        backBtn.style.cssText = ghostBtnStyle;
        backBtn.addEventListener("click", back);
        rowBtns.appendChild(backBtn);

        content.appendChild(rowBtns);
      })
      .catch((e) => {
        statusBar.textContent = `Error: ${(e as Error).message}`;
        back();
      });
  }

  function showHostView() {
    content.innerHTML = "";
    activateTab(hostTab, [guestTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:8px;";
    label.textContent = "Load a .spa (zip) package from the host machine:";
    content.appendChild(label);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".spa,.zip";
    fileInput.style.cssText = "margin-bottom:8px;font-size:11px;";
    content.appendChild(fileInput);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.style.cssText = btnStyle;
    nextBtn.disabled = true;

    fileInput.addEventListener("change", () => {
      nextBtn.disabled = !fileInput.files || fileInput.files.length === 0;
    });

    nextBtn.addEventListener("click", () => {
      const file = fileInput.files?.[0];
      if (!file) {
        statusBar.textContent = "Select a .spa file first";
        return;
      }
      statusBar.textContent = "Reading archive...";
      file.arrayBuffer().then((bytes) => showConfirmView(bytes, file.name, showHostView));
    });
    content.appendChild(nextBtn);
  }

  function showGuestView() {
    content.innerHTML = "";
    activateTab(guestTab, [hostTab, installedTab]);

    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;color:rgba(0,0,0,0.6);margin-bottom:8px;";
    label.textContent = "Select a .spa (zip) package from the guest (VFS):";
    content.appendChild(label);

    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Browse VFS...";
    selectBtn.style.cssText = btnStyle;
    content.appendChild(selectBtn);

    selectBtn.addEventListener("click", async () => {
      const path = await shellSelectFile({
        title: "Select .spa file",
        filter: { label: "SPA Packages", extensions: [".spa", ".zip"] },
      });
      if (path) {
        const fs = new FileSystemAccess();
        if (!fs.isFile(path)) {
          statusBar.textContent = `Error: "${path}" does not exist`;
          return;
        }
        statusBar.textContent = `Reading ${path}...`;
        const blob = await fs.data.read(path);
        if (!blob) {
          statusBar.textContent = `Error: could not read "${path}"`;
          return;
        }
        showConfirmView(await blob.arrayBuffer(), path.split("/").pop() || path, showGuestView);
      }
    });

    content.appendChild(selectBtn);
  }

  function showInstalledView() {
    content.innerHTML = "";
    activateTab(installedTab, [hostTab, guestTab]);

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "Refresh";
    refreshBtn.style.cssText = "padding:4px 10px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);margin-bottom:8px;align-self:flex-start;";
    content.appendChild(refreshBtn);

    const listDiv = document.createElement("div");
    listDiv.style.cssText = "display:flex;flex-direction:column;gap:4px;";
    content.appendChild(listDiv);

    async function loadList() {
      listDiv.innerHTML = "";
      try {
        const apps = await getAllInstalledApps();
        if (apps.length === 0) {
          const empty = document.createElement("div");
          empty.style.cssText = "padding:12px;color:rgba(0,0,0,0.4);text-align:center;font-size:11px;";
          empty.textContent = "No apps installed yet";
          listDiv.appendChild(empty);
          return;
        }
        for (const app of apps) {
          const card = document.createElement("div");
          card.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid rgba(0,0,0,0.1);border-radius:2px;";

          const nameEl = document.createElement("span");
          nameEl.style.cssText = "font-weight:600;flex:1;font-size:11px;";
          nameEl.textContent = app.name;
          card.appendChild(nameEl);

          const verEl = document.createElement("span");
          verEl.style.cssText = "font-size:10px;color:rgba(0,0,0,0.4);";
          verEl.textContent = `v${app.version}`;
          card.appendChild(verEl);

          const launchBtn = document.createElement("button");
          launchBtn.textContent = "Launch";
          launchBtn.style.cssText = "padding:2px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);";
          launchBtn.addEventListener("click", async () => {
            const ok = await launchSpaApp(app.key);
            if (!ok) statusBar.textContent = `Failed to launch "${app.name}"`;
          });
          card.appendChild(launchBtn);

          listDiv.appendChild(card);
        }
      } catch (e) {
        statusBar.textContent = `Error: ${(e as Error).message}`;
      }
    }

    refreshBtn.addEventListener("click", loadList);
    loadList();
  }

  hostTab.addEventListener("click", showHostView);
  guestTab.addEventListener("click", showGuestView);
  installedTab.addEventListener("click", showInstalledView);

  showHostView();

  setContent(hwnd, container);
}
