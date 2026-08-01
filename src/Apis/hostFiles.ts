export interface HostFilePickOptions {
  multiple?: boolean;
  accept?: string[];
  description?: string;
}

// opens the OS file picker for files on the host machine. prefers the File
// System Access API (showOpenFilePicker) because a programmatically clicked
// <input type=file> can silently fail to open a dialog in some Windows /
// Chromium setups; falls back to the input for browsers without the API.
// returns the picked files, or null when the user cancels.
export async function pickHostFiles(
  options?: HostFilePickOptions,
): Promise<File[] | null> {
  const multiple = options?.multiple ?? false;
  const accept = options?.accept?.filter(Boolean) ?? [];

  const w = window as Window & {
    showOpenFilePicker?: (options?: unknown) => Promise<
      Array<{ getFile(): Promise<File> }>
    >;
  };

  if (typeof w.showOpenFilePicker === "function") {
    try {
      const handles = await w.showOpenFilePicker({
        multiple,
        types: [
          {
            description: options?.description ?? "Files",
            accept: {
              "application/octet-stream": accept.length > 0 ? accept : ["*"],
            },
          },
        ],
      });
      const files: File[] = [];
      for (const handle of handles) files.push(await handle.getFile());
      return files.length > 0 ? files : null;
    } catch (e) {
      if ((e as Error).name === "AbortError") return null;
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    if (accept.length > 0) input.accept = accept.join(",");
    input.style.cssText =
      "position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;";
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
      window.removeEventListener("focus", onFocus);
    };
    const onFocus = () => {
      if (input.files && input.files.length > 0) {
        resolve([...input.files]);
      } else {
        resolve(null);
      }
      cleanup();
    };

    input.addEventListener("change", () => {
      resolve(input.files && input.files.length > 0 ? [...input.files] : null);
      cleanup();
    });
    input.addEventListener("cancel", () => {
      resolve(null);
      cleanup();
    });

    window.addEventListener("focus", onFocus);
    input.click();

    window.setTimeout(() => {
      resolve(null);
      cleanup();
    }, 60000);
  });
}
