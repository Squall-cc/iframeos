// this file is NOT written by me
// ai slop

import { createReadStream, cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import devtools from "solid-devtools/vite";
import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const scramjet_dir = path.resolve(import.meta.dirname, "scramjet");

// real scramjet's runtime assets, checked into ./scramjet, served/copied to
// the fixed paths attachScramjetFrame() expects (see src/Apis/scramjet.ts)
const SCRAMJET_ASSETS: { url: string; file: string }[] = [
  { url: "/sw.js", file: "sw.js" },
  {
    url: "/controller/controller.api.js",
    file: "controller/controller.api.js",
  },
  {
    url: "/controller/controller.inject.js",
    file: "controller/controller.inject.js",
  },
  {
    url: "/controller/controller.sw.js",
    file: "controller/controller.sw.js",
  },
  { url: "/scramjet/scramjet.js", file: "scramjet/scramjet.js" },
  { url: "/scramjet/scramjet.wasm", file: "scramjet/scramjet.wasm" },
];

function scramjetAssetsPlugin(): Plugin {
  return {
    name: "scramjet-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || "/").split("?")[0];
        const asset = SCRAMJET_ASSETS.find((a) => a.url === urlPath);
        if (!asset) return next();

        const filePath = path.join(scramjet_dir, asset.file);
        if (!existsSync(filePath)) return next();

        res.setHeader(
          "Content-Type",
          MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
        );
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      const destRoot = path.resolve(import.meta.dirname, "dist");
      for (const asset of SCRAMJET_ASSETS) {
        const dest = path.join(destRoot, asset.url);
        mkdirSync(path.dirname(dest), { recursive: true });
        cpSync(path.join(scramjet_dir, asset.file), dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [devtools(), solidPlugin(), scramjetAssetsPlugin()],
  server: {
    port: 8080,
    allowedHosts:true,
  },
  build: {
    target: "esnext",
  },
});
