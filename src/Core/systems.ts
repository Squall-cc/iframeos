//@ts-nocheck
import { libcurl } from "libcurl.js/bundled";

export function setWallpaper(url: string) {
  const el = document.getElementById("wallpaper");
  if (el) el.style.backgroundImage = `url(${url})`;
}

let lastWallpaperBlobUrl: string | null = null;

export function setWallpaperWithBlob(blob: Blob) {
  if (lastWallpaperBlobUrl) URL.revokeObjectURL(lastWallpaperBlobUrl);
  lastWallpaperBlobUrl = URL.createObjectURL(blob);
  setWallpaper(lastWallpaperBlobUrl);
}

export function setWisp(url: string) {
  libcurl.set_websocket(url);
}

export function wFetchText(url: string) {
  return libcurl.fetch(url).text();
}

export async function wFetchBlob(url: string) {
  let response = await libcurl.fetch(url);
  return URL.createObjectURL(await response.blob());
}
