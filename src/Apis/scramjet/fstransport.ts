import { FileSystemAccess } from "../FileSystemApi";

// proxy-transports does truly suck and i cant do custom scheme, so use https://filesystem/ for now
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

export function isFsUrl(url: URL): boolean {
  return url.hostname === "filesystem";
}

export async function handle(
  remote: URL,
  method: string,
  body: BodyInit | null,
): Promise<TransferrableResponse> {
  const fs = new FileSystemAccess();
  const path = decodeURIComponent(remote.pathname) || "/";

  switch (method) {
    case "GET": {
      // caddy / nginx directory index page ()
      if (fs.isFile(path)) {
        return reply(200, (await fs.openFile(path).read()) ?? "");
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

// compatible with ProxyTransport interface but uhh network stuff is just a stub
export class fstransport {
  ready = true;
  async init() {}

  request(remote: URL, method: string, body: BodyInit | null) {
    if (!isFsUrl(remote)) throw new Error("fstransport: not a filesystem url");
    return handle(remote, method, body);
  }

  connect(): never {
    throw new Error("fstransport: websockets not supported");
  }
}
