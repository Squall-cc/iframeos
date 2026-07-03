// this file is NOT written by me
// ai slop

import { execSync } from "node:child_process";
import {
  createReadStream,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import devtools from "solid-devtools/vite";
import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";

const browser_repo = "https://github.com/Squall-cc/browser.git";
const pulsar_repo = "https://github.com/abndnce/pulsar.git";
const browser_cache = path.resolve(import.meta.dirname, ".cache/browser");
const pulsar_dir = path.join(browser_cache, "pulsar");
const pulsar_client_dir = path.join(pulsar_dir, "packages", "client");

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

function cloneOrPull(repo: string, dir: string) {
  if (existsSync(dir)) {
    execSync("git pull", { cwd: dir, stdio: "inherit" });
  } else {
    execSync(`git clone --depth 1 ${repo} "${dir}"`, { stdio: "inherit" });
  }
}

function ensureWorkspaces(pkgPath: string, workspaces: string[]) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (!pkg.workspaces) {
    pkg.workspaces = workspaces;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}

function buildBrowser() {
  cloneOrPull(browser_repo, browser_cache);
  cloneOrPull(pulsar_repo, pulsar_dir);
  ensureWorkspaces(path.join(pulsar_dir, "package.json"), ["packages/*"]);

  execSync("bun install", { cwd: browser_cache, stdio: "inherit" });
  execSync("bun run build", { cwd: pulsar_client_dir, stdio: "inherit" });
  execSync("bun run build", { cwd: browser_cache, stdio: "inherit" });
}

// browser's own index.html would collide with our root index.html once
// merged into the same dist, so it gets renamed to browser.html first.
function ensureBrowserHtmlName(distDir: string) {
  const index = path.join(distDir, "index.html");
  const renamed = path.join(distDir, "browser.html");
  if (!existsSync(renamed) && existsSync(index)) {
    renameSync(index, renamed);
  }
}

function browserSubBuildPlugin(): Plugin {
  return {
    name: "browser-sub-build",
    configureServer(server) {
      const browserDist = path.join(browser_cache, "dist");
      if (!existsSync(browserDist)) {
        buildBrowser();
      }
      ensureBrowserHtmlName(browserDist);

      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || "/").split("?")[0];
        if (urlPath === "/" || urlPath === "/index.html") return next();

        const filePath = path.join(browserDist, urlPath);
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
          return next();
        }

        res.setHeader(
          "Content-Type",
          MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
        );
        createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      buildBrowser();

      const srcDist = path.join(browser_cache, "dist");
      ensureBrowserHtmlName(srcDist);

      const destRoot = path.resolve(import.meta.dirname, "dist");
      cpSync(srcDist, destRoot, { recursive: true });
    },
  };
}

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
  plugins: [
    devtools(),
    solidPlugin(),
    browserSubBuildPlugin(),
    scramjetAssetsPlugin(),
  ],
  server: {
    port: 3001,
  },
  build: {
    target: "esnext",
  },
});
