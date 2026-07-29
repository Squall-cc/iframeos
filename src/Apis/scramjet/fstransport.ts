import { FileSystemAccess } from "../FileSystemApi";
//api usage from scramjet embedded apps

// proxy-transports does truly suck and i cant do custom scheme, so use https://aspen/ for now
export interface TransferrableResponse {
  body: string;
  headers: [string, string][];
  status: number;
  statusText: string;
}

function reply(
  status: number,
  body: string,
  contentType = "text/plain",
): TransferrableResponse {
  return {
    status,
    statusText: status === 200 ? "OK" : status === 404 ? "Not Found" : "Error",
    headers: [["content-type", contentType]],
    body,
  };
}

export function isAspenUrl(url: URL): boolean {
  return url.hostname === "aspen";
}
// todo: find some lib to do this for me
const MIME_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  svg: "image/svg+xml",
};

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return (ext && MIME_TYPES[ext]) || "text/plain";
}

async function handleFilesystem(
  path: string,
  method: string,
  body: BodyInit | null,
): Promise<TransferrableResponse> {
  const fs = new FileSystemAccess();

  switch (method) {
    case "GET": {
      if (fs.isFile(path)) {
        return reply(200, (await fs.openFile(path).read()) ?? "", mimeFor(path));
      }
      return reply(404, "not found");
    }
    case "PUT":
    case "POST": {
      const text = body ? await new Response(body).text() : "";
      fs.openFile(path).write(text);
      return reply(200, "ok");
    }
    case "DELETE": {
      if (fs.isDirectory(path)) fs.deleteDirectory(path);
      else fs.deleteFile(path);
      return reply(200, "ok");
    }
    default:
      return reply(405, "method not allowed");
  }
}

// runs the decoded code in the top-level (non-sandboxed) page, outside the
// scramjet iframe, so proxied apps can call back into window.__API etc.
async function handleEval(encoded: string): Promise<TransferrableResponse> {
  const code = decodeURIComponent(encoded);
  try {
    const result = await (0, eval)(code);
    return reply(200, JSON.stringify(result ?? null) ?? "null", "application/json");
  } catch (e) {
    return reply(500, e instanceof Error ? e.message : String(e));
  }
}

export async function handle(
  remote: URL,
  method: string,
  body: BodyInit | null,
): Promise<TransferrableResponse> {
  const [route, ...rest] = decodeURIComponent(remote.pathname)
    .replace(/^\/+/, "")
    .split("/");

  if (route === "filesystem") {
    return handleFilesystem("/" + rest.join("/"), method, body);
  }
  if (route === "eval") {
    return handleEval(rest.join("/"));
  }
  return reply(404, "not found");
}

// compatible with ProxyTransport interface but uhh network stuff is just a stub
export class fstransport {
  ready = true;
  async init() {}

  request(remote: URL, method: string, body: BodyInit | null) {
    if (!isAspenUrl(remote)) throw new Error("fstransport: not an aspen url");
    return handle(remote, method, body);
  }

  connect(): never {
    throw new Error("fstransport: websockets not supported");
  }
}
