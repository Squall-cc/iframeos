import { setContent, setMinSize } from "../Core/windowhelpers";

export default function run(id: symbol) {
  setMinSize(id, 400, 300);
  const iframe = document.createElement("iframe");
  iframe.src = "https://example.com";
  setContent(id, iframe);
}
