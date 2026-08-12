import type { RegistryRecord, RegistryValue } from "../Apis/RegistryApi";
import { RegistryInstanceAccess } from "../Apis/RegistryApi";
import { setContent, setMinSize } from "../Core/windowhelpers";

interface TreeNode {
  name: string;
  fullPath: string;
  children: TreeNode[];
  expanded: boolean;
}

function formatValue(v: RegistryValue): string {
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function valueType(v: RegistryValue): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function buildTree(paths: string[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const sorted = paths.slice().sort((a, b) => a.localeCompare(b));

  for (const path of sorted) {
    const parts = path.split("/");
    let current = roots;
    let prefix = "";

    for (let i = 0; i < parts.length; i++) {
      prefix = prefix ? prefix + "/" + parts[i] : parts[i];
      let node = current.find((n) => n.name === parts[i]);
      if (!node) {
        node = { name: parts[i], fullPath: prefix, children: [], expanded: false };
        current.push(node);
      }
      current = node.children;
    }
  }
  return roots;
}

interface SearchResult {
  path: string;
  match: string;
  type: "key" | "value";
}

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 550, 350);
  const reg = new RegistryInstanceAccess();
  let selectedPath: string | null = null;
  let allRecords: RegistryRecord[] = [];
  let treeRoot: TreeNode[] = [];

  const container = document.createElement("div");
  container.style.cssText =
    "display:flex;flex-direction:column;height:100%;font-family:Segoe UI,sans-serif;font-size:12px;";

  const menuBar = document.createElement("div");
  menuBar.style.cssText =
    "display:flex;gap:4px;padding:4px 6px;border-bottom:1px solid rgba(0,0,0,0.15);background:rgba(0,0,0,0.04);align-items:center;";

  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex:1;overflow:hidden;";

  const sidebar = document.createElement("div");
  sidebar.style.cssText =
    "width:260px;min-width:260px;display:flex;flex-direction:column;background:rgba(0,0,0,0.05);border-right:1px solid rgba(0,0,0,0.15);";

  const sidebarHeader = document.createElement("div");
  sidebarHeader.style.cssText =
    "padding:4px 8px;font-weight:600;font-size:11px;border-bottom:1px solid rgba(0,0,0,0.15);";
  sidebarHeader.textContent = "Registry Keys";
  sidebar.appendChild(sidebarHeader);

  const treeContainer = document.createElement("div");
  treeContainer.style.cssText = "flex:1;overflow-y:auto;overflow-x:auto;";
  sidebar.appendChild(treeContainer);

  const sidebarActions = document.createElement("div");
  sidebarActions.style.cssText =
    "display:flex;gap:4px;padding:4px;border-top:1px solid rgba(0,0,0,0.15);";

  const newKeyBtn = document.createElement("button");
  newKeyBtn.textContent = "New Key";
  newKeyBtn.style.cssText =
    "flex:1;padding:4px 6px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  newKeyBtn.addEventListener("click", addKey);
  sidebarActions.appendChild(newKeyBtn);

  const delKeyBtn = document.createElement("button");
  delKeyBtn.textContent = "Delete Key";
  delKeyBtn.style.cssText =
    "flex:1;padding:4px 6px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,0,0,0.1);";
  delKeyBtn.addEventListener("click", deleteKey);
  sidebarActions.appendChild(delKeyBtn);

  sidebar.appendChild(sidebarActions);

  const main = document.createElement("div");
  main.style.cssText = "flex:1;display:flex;flex-direction:column;overflow:hidden;";

  const mainHeader = document.createElement("div");
  mainHeader.style.cssText =
    "padding:4px 8px;font-weight:600;font-size:11px;border-bottom:1px solid rgba(0,0,0,0.15);";
  mainHeader.textContent = "Select a key";
  main.appendChild(mainHeader);

  const valueArea = document.createElement("div");
  valueArea.style.cssText = "flex:1;overflow-y:auto;padding:4px;";
  main.appendChild(valueArea);

  const valueActions = document.createElement("div");
  valueActions.style.cssText =
    "display:flex;gap:4px;padding:4px;border-top:1px solid rgba(0,0,0,0.15);";

  const newValBtn = document.createElement("button");
  newValBtn.textContent = "Add Value";
  newValBtn.style.cssText =
    "padding:4px 6px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  newValBtn.addEventListener("click", addValue);
  valueActions.appendChild(newValBtn);

  main.appendChild(valueActions);

  body.appendChild(sidebar);
  body.appendChild(main);
  container.appendChild(menuBar);
  container.appendChild(body);
  setContent(hwnd, container);

  const expandAllBtn = document.createElement("button");
  expandAllBtn.textContent = "Expand All";
  expandAllBtn.style.cssText =
    "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  expandAllBtn.addEventListener("click", () => {
    const expandedPaths = allRecords.map((r) => r.path);
    refreshKeys(expandedPaths);
  });
  menuBar.appendChild(expandAllBtn);

  const collapseAllBtn = document.createElement("button");
  collapseAllBtn.textContent = "Collapse All";
  collapseAllBtn.style.cssText =
    "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  collapseAllBtn.addEventListener("click", () => {
    refreshKeys();
  });
  menuBar.appendChild(collapseAllBtn);

  const sep = document.createElement("span");
  sep.style.cssText = "flex:1;";
  menuBar.appendChild(sep);

  const searchBtn = document.createElement("button");
  searchBtn.textContent = "Search Registry";
  searchBtn.style.cssText =
    "padding:3px 8px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
  searchBtn.addEventListener("click", openSearchDialog);
  menuBar.appendChild(searchBtn);

  async function loadRecords(): Promise<RegistryRecord[]> {
    await reg._load("");
    const tx = reg._db.transaction("registry", "readonly");
    const store = tx.objectStore("registry");
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as RegistryRecord[]);
      req.onerror = () => resolve([]);
    });
  }

  async function refreshKeys(expandedPaths?: string[]) {
    allRecords = await loadRecords();
    treeRoot = buildTree(allRecords.map((r) => r.path));

    if (expandedPaths) {
      const paths = expandedPaths;
      function restoreExpanded(nodes: TreeNode[]) {
        for (const n of nodes) {
          if (paths.includes(n.fullPath)) {
            n.expanded = true;
            restoreExpanded(n.children);
          }
        }
      }
      restoreExpanded(treeRoot);
    }

    renderTree(treeRoot);
  }

  function renderTree(nodes: TreeNode[], depth: number = 0) {
    treeRoot = nodes;
    treeContainer.innerHTML = "";
    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none;margin:0;padding:0;";
    treeContainer.appendChild(ul);
    renderNodes(nodes, ul, depth);

    if (nodes.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:12px 8px;color:rgba(0,0,0,0.4);text-align:center;font-size:11px;";
      empty.textContent = "No registry keys";
      treeContainer.appendChild(empty);
    }
  }

  function renderNodes(nodes: TreeNode[], parent: HTMLElement, depth: number) {
    for (const node of nodes) {
      const li = document.createElement("li");
      li.style.cssText = "margin:0;padding:0;";

      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:2px;padding:2px 4px 2px 0;cursor:pointer;white-space:nowrap;";
      row.style.paddingLeft = depth * 16 + 4 + "px";

      if (node.fullPath === selectedPath) {
        row.style.background = "rgba(0,100,200,0.25)";
      }

      const toggle = document.createElement("span");
      toggle.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;font-size:8px;user-select:none;flex-shrink:0;";
      if (node.children.length > 0) {
        toggle.textContent = node.expanded ? "▼" : "▶";
        toggle.style.cursor = "pointer";
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          node.expanded = !node.expanded;
          refreshTreeKeepingState();
        });
      } else {
        toggle.textContent = "  ";
      }
      row.appendChild(toggle);

      const icon = document.createElement("i");
      icon.style.cssText = "margin-right:3px;font-size:11px;flex-shrink:0;color:#e8b339;";
      icon.className = "fa-solid fa-folder";
      row.appendChild(icon);

      const label = document.createElement("span");
      label.style.cssText = "font-size:11px;overflow:hidden;text-overflow:ellipsis;";
      label.textContent = node.name;
      row.appendChild(label);

      row.addEventListener("mouseenter", () => {
        if (node.fullPath !== selectedPath)
          row.style.background = "rgba(0,0,0,0.06)";
      });
      row.addEventListener("mouseleave", () => {
        if (node.fullPath !== selectedPath) row.style.background = "";
      });
      row.addEventListener("click", () => {
        selectedPath = node.fullPath;
        mainHeader.textContent = "Key: " + node.fullPath;
        loadAndRenderValues(node.fullPath);
        refreshTreeKeepingState();
      });

      li.appendChild(row);

      if (node.expanded && node.children.length > 0) {
        const childUl = document.createElement("ul");
        childUl.style.cssText = "list-style:none;margin:0;padding:0;";
        li.appendChild(childUl);
        renderNodes(node.children, childUl, depth + 1);
      }

      parent.appendChild(li);
    }
  }

  function refreshTreeKeepingState() {
    const expandedPaths = new Set<string>();
    function collectExpanded(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.expanded) {
          expandedPaths.add(n.fullPath);
          collectExpanded(n.children);
        }
      }
    }
    collectExpanded(treeRoot);
    refreshKeys([...expandedPaths]);
  }

  async function loadAndRenderValues(path: string) {
    const record = await reg._load(path);
    if (record) {
      renderValues(record.values);
    } else {
      renderValues({});
    }
  }

  function renderValues(values: Record<string, RegistryValue>) {
    valueArea.innerHTML = "";

    const entries = Object.entries(values);

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "padding:12px;color:rgba(0,0,0,0.4);text-align:center;font-size:11px;";
      empty.textContent = "(empty)";
      valueArea.appendChild(empty);
      return;
    }

    for (const [name, val] of entries) {
      const card = document.createElement("div");
      card.style.cssText =
        "display:flex;align-items:center;gap:8px;padding:3px 6px;border-bottom:1px solid rgba(0,0,0,0.06);";

      const nameSpan = document.createElement("span");
      nameSpan.style.cssText = "font-weight:600;min-width:140px;overflow:hidden;text-overflow:ellipsis;font-size:11px;";
      nameSpan.textContent = name;

      const typeSpan = document.createElement("span");
      typeSpan.style.cssText =
        "font-size:10px;color:rgba(0,0,0,0.4);min-width:40px;text-transform:uppercase;";
      typeSpan.textContent = valueType(val);

      const valSpan = document.createElement("span");
      valSpan.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(0,0,0,0.7);font-size:11px;";
      valSpan.textContent = formatValue(val);

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.style.cssText =
        "padding:1px 6px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);";
      editBtn.addEventListener("click", () => editValue(name, val));

      const delBtn = document.createElement("button");
      delBtn.textContent = "Del";
      delBtn.style.cssText =
        "padding:1px 6px;font-size:11px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,0,0,0.1);";
      delBtn.addEventListener("click", () => deleteValue(name));

      card.appendChild(nameSpan);
      card.appendChild(typeSpan);
      card.appendChild(valSpan);
      card.appendChild(editBtn);
      card.appendChild(delBtn);
      valueArea.appendChild(card);
    }
  }

  function editValue(name: string, current: RegistryValue) {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:10000;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "background:#fff;border-radius:4px;padding:16px;min-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Segoe UI,sans-serif;font-size:12px;";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:600;margin-bottom:12px;";
    title.textContent = "Edit: " + name;
    dialog.appendChild(title);

    const label = document.createElement("div");
    label.style.cssText = "margin-bottom:4px;color:rgba(0,0,0,0.6);font-size:11px;";
    label.textContent = "Value:";
    dialog.appendChild(label);

    const input = document.createElement("textarea");
    input.style.cssText =
      "width:100%;box-sizing:border-box;min-height:60px;font-family:monospace;font-size:12px;padding:4px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;resize:vertical;";
    input.value = typeof current === "object" ? JSON.stringify(current, null, 2) : String(current ?? "");
    dialog.appendChild(input);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:12px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;";
    cancelBtn.addEventListener("click", () => overlay.remove());

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.cssText =
      "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;font-size:11px;";
    saveBtn.addEventListener("click", async () => {
      const raw = input.value.trim();
      let parsed: RegistryValue = raw;
      try {
        parsed = JSON.parse(raw);
      } catch { void 0 }
      if (selectedPath) {
        await reg._write(selectedPath, name, parsed);
        loadAndRenderValues(selectedPath);
      }
      overlay.remove();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
  }

  async function deleteValue(name: string) {
    if (!selectedPath) return;
    await reg._deleteValue(selectedPath, name);
    loadAndRenderValues(selectedPath);
  }

  async function addValue() {
    if (!selectedPath) return;
    const name = window.prompt("Enter value name:");
    if (!name) return;
    const raw = window.prompt("Enter value (JSON or plain text):");
    if (raw === null) return;
    let parsed: RegistryValue = raw;
    try {
      parsed = JSON.parse(raw);
    } catch { void 0 }
    await reg._write(selectedPath, name, parsed);
    loadAndRenderValues(selectedPath);
  }

  async function addKey() {
    if (!selectedPath) {
      const path = window.prompt("Enter new key path:");
      if (!path) return;
      await reg._save({ path, values: {} });
      selectedPath = path;
      mainHeader.textContent = "Key: " + path;
      renderValues({});
      refreshKeys();
      return;
    }
    const name = window.prompt("Enter new key name:");
    if (!name) return;
    const newPath = selectedPath + "/" + name;
    await reg._save({ path: newPath, values: {} });
    selectedPath = newPath;
    mainHeader.textContent = "Key: " + newPath;
    renderValues({});
    const expandedPaths = new Set<string>();
    expandedPaths.add(selectedPath);
    let p = selectedPath;
    while (p.includes("/")) {
      p = p.substring(0, p.lastIndexOf("/"));
      expandedPaths.add(p);
    }
    refreshKeys([...expandedPaths]);
  }

  async function deleteKey() {
    if (!selectedPath) return;
    if (!window.confirm(`Delete key "${selectedPath}" and all its values?`)) return;
    const prefix = selectedPath + "/";
    for (const record of allRecords) {
      if (record.path === selectedPath || record.path.startsWith(prefix)) {
        await reg._deleteKey(record.path);
      }
    }
    selectedPath = null;
    mainHeader.textContent = "Select a key";
    valueArea.innerHTML =
      '<div style="padding:12px;color:rgba(0,0,0,0.4);text-align:center;font-size:11px;">Select a key</div>';
    refreshKeys();
  }

  function openSearchDialog() {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:10000;cursor:wait;";

    const dialog = document.createElement("div");
    dialog.style.cssText =
      "background:#fff;border-radius:4px;padding:16px;min-width:450px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:Segoe UI,sans-serif;font-size:12px;cursor:default;";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:600;margin-bottom:12px;";
    title.textContent = "Search Registry";
    dialog.appendChild(title);

    const inputRow = document.createElement("div");
    inputRow.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search keys and values...";
    searchInput.style.cssText =
      "flex:1;padding:4px 6px;font-size:12px;border:1px solid rgba(0,0,0,0.2);border-radius:2px;font-family:Segoe UI,sans-serif;";
    inputRow.appendChild(searchInput);

    const findBtn = document.createElement("button");
    findBtn.textContent = "Find";
    findBtn.style.cssText =
      "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,100,200,0.5);border-radius:2px;background:rgba(0,100,200,0.1);font-weight:600;font-size:11px;";
    inputRow.appendChild(findBtn);
    dialog.appendChild(inputRow);

    const navRow = document.createElement("div");
    navRow.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Previous";
    prevBtn.style.cssText =
      "padding:3px 10px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);font-size:11px;";
    navRow.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.style.cssText =
      "padding:3px 10px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:rgba(255,255,255,0.5);font-size:11px;";
    navRow.appendChild(nextBtn);

    const resultInfo = document.createElement("span");
    resultInfo.style.cssText = "font-size:11px;color:rgba(0,0,0,0.5);margin-left:auto;align-self:center;";
    resultInfo.textContent = "No results";
    navRow.appendChild(resultInfo);

    dialog.appendChild(navRow);

    const resultList = document.createElement("div");
    resultList.style.cssText =
      "max-height:200px;overflow-y:auto;border:1px solid rgba(0,0,0,0.1);border-radius:2px;margin-bottom:8px;display:none;";
    dialog.appendChild(resultList);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.cssText =
      "padding:4px 12px;cursor:pointer;border:1px solid rgba(0,0,0,0.2);border-radius:2px;background:#f5f5f5;font-size:11px;float:right;";
    closeBtn.addEventListener("click", () => overlay.remove());
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let results: SearchResult[] = [];
    let currentIndex = -1;

    function navigateTo(result: SearchResult) {
      selectedPath = result.path;
      mainHeader.textContent = "Key: " + result.path;
      loadAndRenderValues(result.path);

      const expandedPaths = new Set<string>();
      let p = result.path;
      while (p) {
        expandedPaths.add(p);
        const idx = p.lastIndexOf("/");
        if (idx === -1) break;
        p = p.substring(0, idx);
      }
      refreshKeys([...expandedPaths]);

      resultList.querySelectorAll(".search-result-item").forEach((el, i) => {
        (el as HTMLElement).style.background =
          i === currentIndex ? "rgba(0,100,200,0.2)" : "";
      });
    }

    function renderResults() {
      resultList.innerHTML = "";
      if (results.length === 0) {
        resultList.style.display = "none";
        resultInfo.textContent = "No results";
        return;
      }
      resultList.style.display = "block";
      resultInfo.textContent = `${currentIndex + 1} of ${results.length}`;

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const item = document.createElement("div");
        item.className = "search-result-item";
        item.style.cssText =
          "padding:4px 6px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.05);font-size:11px;";
        item.style.background = i === currentIndex ? "rgba(0,100,200,0.2)" : "";

        const pathEl = document.createElement("div");
        pathEl.style.cssText = "font-weight:600;overflow:hidden;text-overflow:ellipsis;";
        pathEl.textContent = r.path;
        item.appendChild(pathEl);

        const matchEl = document.createElement("div");
        matchEl.style.cssText = "color:rgba(0,0,0,0.5);overflow:hidden;text-overflow:ellipsis;";
        matchEl.textContent = (r.type === "key" ? "Key: " : "Value: ") + r.match;
        item.appendChild(matchEl);

        item.addEventListener("click", () => {
          currentIndex = i;
          renderResults();
          navigateTo(r);
        });

        item.addEventListener("dblclick", () => {
          currentIndex = i;
          overlay.remove();
          navigateTo(r);
        });

        resultList.appendChild(item);
      }
    }

    function performSearch() {
      overlay.style.cursor = "wait";
      dialog.style.cursor = "wait";
      const query = searchInput.value.toLowerCase().trim();
      if (!query) {
        results = [];
        currentIndex = -1;
        renderResults();
        overlay.style.cursor = "";
        dialog.style.cursor = "";
        return;
      }

      results = [];
      for (const record of allRecords) {
        if (record.path.toLowerCase().includes(query)) {
          results.push({ path: record.path, match: record.path, type: "key" });
        }
        for (const [vname, vval] of Object.entries(record.values)) {
          const valStr = vname.toLowerCase() + "=" + formatValue(vval).toLowerCase();
          if (valStr.includes(query)) {
            results.push({
              path: record.path,
              match: vname + " = " + formatValue(vval),
              type: "value",
            });
          }
        }
      }

      currentIndex = results.length > 0 ? 0 : -1;
      renderResults();
      if (results.length > 0) navigateTo(results[0]);
      overlay.style.cursor = "";
      dialog.style.cursor = "";
    }

    findBtn.addEventListener("click", performSearch);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") performSearch();
    });

    prevBtn.addEventListener("click", () => {
      if (results.length === 0) return;
      currentIndex = (currentIndex - 1 + results.length) % results.length;
      renderResults();
      navigateTo(results[currentIndex]);
    });

    nextBtn.addEventListener("click", () => {
      if (results.length === 0) return;
      currentIndex = (currentIndex + 1) % results.length;
      renderResults();
      navigateTo(results[currentIndex]);
    });

    searchInput.focus();
  }

  (async () => {
    await refreshKeys();
    if (treeRoot.length > 0) {
      const first = treeRoot[0];
      selectedPath = first.fullPath;
      mainHeader.textContent = "Key: " + first.fullPath;
      await loadAndRenderValues(first.fullPath);
      refreshTreeKeepingState();
    }
  })();
}
