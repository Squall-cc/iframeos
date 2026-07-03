// @ts-nocheck
import { libcurl } from "libcurl.js/bundled";
// this file is ai-generated + stolen from te repo. idk how 2 use libcurl fetch for allat
let session: any;
let ready: Promise<void> | undefined;

function ensureReady() {
  if (!ready)
    ready = libcurl.load_wasm().then(() => {
      session = new libcurl.HTTPSession();
    });
  return ready;
}

// real network requests, routed through whatever wisp server systems.setWisp() pointed libcurl at
export class nettransport {
  ready = false;

  async init() {
    await ensureReady();
    this.ready = true;
  }

  async request(
    remote: URL,
    method: string,
    body: BodyInit | null,
    headers: [string, string][],
  ) {
    await ensureReady();

    const filtered = headers.filter(
      ([k]) => !["host", "connection", "keep-alive"].includes(k.toLowerCase()),
    );
    const reqBody =
      body && method !== "GET" && method !== "HEAD"
        ? await new Response(body).arrayBuffer()
        : undefined;

    const res = await session.fetch(remote.href, {
      method,
      headers: filtered,
      body: reqBody,
      redirect: "manual",
    });

    return {
      status: res.status,
      statusText: res.statusText,
      headers: Array.isArray(res.raw_headers)
        ? res.raw_headers
        : [...res.headers],
      body: res.body ?? new ArrayBuffer(0),
    };
  }

  connect(
    url: URL,
    protocols: string[],
    requestHeaders: [string, string][],
    onopen: (protocol: string, extensions: string) => void,
    onmessage: (data: any) => void,
    onclose: (code: number, reason: string) => void,
    onerror: (error: string) => void,
  ) {
    let socket: any;

    (async () => {
      await ensureReady();
      socket = new libcurl.WebSocket(url.toString(), protocols, {
        headers: requestHeaders,
      });
      socket.binaryType = "arraybuffer";
      socket.onopen = () => onopen("", "");
      socket.onclose = (e: any) => onclose(e.code, e.reason);
      socket.onerror = () => onerror("transport failed");
      socket.onmessage = (e: any) => onmessage(e.data);
    })();

    return [
      (d: any) => socket?.send(d),
      (c: number, r: string) => socket?.close(c, r),
    ];
  }
}
