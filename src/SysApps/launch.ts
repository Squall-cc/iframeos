import { launch } from "../Apis/Launcher";
import { setContent, setMinSize } from "../Core/windowhelpers";

export default function run(hwnd: symbol) {
  setMinSize(hwnd, 400, 300);
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "code to run...";

  const runbtn = document.createElement("button");
  runbtn.textContent = "run";
  runbtn.onclick = () => launch(textarea.value);

  container.appendChild(textarea);
  container.appendChild(runbtn);

  setContent(hwnd, container);
}
