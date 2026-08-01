import { DESKTOP_DIR } from "../Apis/DesktopApi";
import { shellSelectDir, shellSelectFile } from "../Apis/iSApi";
import { createShortcutFile } from "../Apis/Shortcuts";
import { setContent, setMinSize } from "../Core/windowhelpers";

const btnStyle =
  "padding:5px 12px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
const primaryBtnStyle =
  "padding:5px 14px;font-size:11px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;";

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 440, 300);

  const container = document.createElement("div");
  container.style.cssText =
    "display:flex;flex-direction:column;gap:10px;padding:14px;height:100%;box-sizing:border-box;font-family:Segoe UI,sans-serif;font-size:12px;";

  const header = document.createElement("div");
  header.textContent = "Shortcut Creation Wizard";
  header.style.cssText = "font-weight:600;font-size:14px;";
  container.appendChild(header);

  const desc = document.createElement("div");
  desc.textContent =
    "Choose a file or folder to make a shortcut of. The shortcut will be created on the desktop.";
  desc.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);";
  container.appendChild(desc);

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:8px;align-items:center;";
  container.appendChild(row);

  const fileBtn = document.createElement("button");
  fileBtn.textContent = "Choose File...";
  fileBtn.style.cssText = btnStyle;
  const dirBtn = document.createElement("button");
  dirBtn.textContent = "Choose Folder...";
  dirBtn.style.cssText = btnStyle;
  row.appendChild(fileBtn);
  row.appendChild(dirBtn);

  let target: string | null = null;

  const targetLabel = document.createElement("div");
  targetLabel.textContent = "Target: none";
  targetLabel.style.cssText =
    "font-size:11px;background:rgba(0,0,0,0.04);border:1px solid rgba(0,0,0,0.1);border-radius:2px;padding:6px 8px;word-break:break-all;";
  container.appendChild(targetLabel);

  const nameRow = document.createElement("div");
  nameRow.style.cssText = "display:flex;align-items:center;gap:8px;";
  container.appendChild(nameRow);

  const nameLabel = document.createElement("span");
  nameLabel.textContent = "Shortcut name:";
  nameLabel.style.cssText = "font-size:11px;white-space:nowrap;";
  nameRow.appendChild(nameLabel);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.style.cssText =
    "flex:1;padding:4px 6px;font-size:12px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;font-family:Segoe UI,sans-serif;";
  nameInput.placeholder = "Shortcut name";
  nameRow.appendChild(nameInput);

  const status = document.createElement("div");
  status.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);min-height:16px;";
  container.appendChild(status);

  const createBtn = document.createElement("button");
  createBtn.textContent = "Create Shortcut";
  createBtn.style.cssText = primaryBtnStyle;
  createBtn.disabled = true;
  container.appendChild(createBtn);

  function setTarget(p: string | null) {
    target = p;
    if (p) {
      targetLabel.textContent = `Target: ${p}`;
      nameInput.value = p.split("/").filter(Boolean).pop() || "shortcut";
      createBtn.disabled = false;
    } else {
      targetLabel.textContent = "Target: none";
      createBtn.disabled = true;
    }
  }

  fileBtn.addEventListener("click", async () => {
    const p = await shellSelectFile({ title: "Choose a file to make a shortcut of" });
    if (p) setTarget(p);
  });

  dirBtn.addEventListener("click", async () => {
    const p = await shellSelectDir({ title: "Choose a folder to make a shortcut of" });
    if (p) setTarget(p);
  });

  createBtn.addEventListener("click", async () => {
    if (!target) return;
    const name =
      nameInput.value.trim() || target.split("/").filter(Boolean).pop() || "shortcut";
    const dest = await createShortcutFile(target, DESKTOP_DIR, name);
    if (!dest) {
      status.textContent = "Failed: the target no longer exists.";
      return;
    }
    status.textContent = `Created "${name}" on the desktop.`;
    nameInput.value = "";
    setTarget(null);
  });

  setContent(hwnd, container);
}
