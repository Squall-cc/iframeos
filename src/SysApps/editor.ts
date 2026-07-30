import { FileSystemAccess } from "../Apis/FileSystemApi";
import { setContent, spawn } from "../Core/windowhelpers";

// text editor for file explorer
export function editFile(path: string): void {
  spawn(path, (hwnd) => {
    const fs = new FileSystemAccess();
    const file = fs.openFile(path);

    const textarea = document.createElement("textarea");
    textarea.style.width = "100%";
    textarea.style.height = "100%";
    textarea.style.boxSizing = "border-box";
    textarea.style.border = "none";
    textarea.style.resize = "none";
    textarea.style.fontFamily = "monospace";// we should standardize fonts across apps aside from segeoue ui
    textarea.style.fontSize = "14px";
    textarea.disabled = true;

    file.read().then((text) => {
      textarea.value = text ?? "";
      textarea.disabled = false;
    });

    textarea.addEventListener("input", () => {
      file.write(textarea.value);
    });

    setContent(hwnd, textarea);
  });
}

export default editFile;
