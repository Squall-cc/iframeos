//vibecoded stratus api skid
// NOT allegro, allegro is not releasing for a while


// WebRTC cloud-streaming client. Talks to /cloud/v1/embed-data for session
// info, negotiates over a JSON signaling websocket, and streams input back
// over an unreliable data channel using a fixed binary layout. See cloud.txt
// at the repo root for the wire format this replicates.

import { windows } from "../Core/windowhelpers";

export interface EmbedData {
  ice_servers: RTCIceServer[];
  signaling_ws: string;
}

export type CloudStatus = "connecting" | "live" | "ended";

// custom gamepad button -> bitmask mapping (indices 0-15 of the standard
// mapping; 6 and 7 are the analog triggers and are sent as separate bytes).
const GAMEPAD_BTN_MASK = [
  4096, 8192, 16384, 32768, 256, 512, 0, 0, 32, 16, 64, 128, 1, 2, 4, 8,
];
const CURSOR_MIME = ["image/x-icon", "image/jpeg", "image/png", "image/gif"];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function fetchEmbedData(id: string, host?: string): Promise<EmbedData> {
  const params = new URLSearchParams({ id });
  if (host) params.set("host", host);
  const res = await fetch(`/cloud/v1/embed-data?${params.toString()}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

interface CreateSessionEvent {
  status: string;
  uuid?: string;
  queue_pos?: number;
  error?: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return String(body.error);
  } catch {
    // non-JSON error body, keep the generic message
  }
  return `Request failed (${res.status})`;
}

// POST /cloud/v1/createSession streams newline-delimited JSON progress
// events and closes once the session either lands in a queue or is ready to
// start — it does not wait out the queue itself, that's polled separately.
async function createCloudSession(
  gameKey: string,
  onProgress: (event: CreateSessionEvent) => void,
): Promise<{ uuid: string; queued: boolean }> {
  const res = await fetch("/cloud/v1/createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game_key: gameKey }),
  });
  if (!res.ok || !res.body) throw new Error(await readError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let uuid: string | undefined;
  let queued = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const event = JSON.parse(line) as CreateSessionEvent;
      onProgress(event);
      if (event.status === "error") throw new Error(event.error ?? "Session creation failed");
      if (event.uuid) uuid = event.uuid;
      if (event.status === "queue") queued = true;
    }
  }
  if (!uuid) throw new Error("Session creation ended without a session id");
  return { uuid, queued };
}

// GET /cloud/v1/getQueue — poll at most once every 3s per the server's rate limit.
async function pollQueue(uuid: string): Promise<number | "finished_queue"> {
  const res = await fetch(`/cloud/v1/getQueue?${new URLSearchParams({ uuid })}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ? String(body.error) : `Request failed (${res.status})`);
  return body.status === "finished_queue" ? "finished_queue" : (body.queue_pos ?? 0);
}

// POST /cloud/v1/startGame — must be called within 30s of the session
// reaching "finished_queue", returns the same ice_servers/signaling_ws shape
// embed-data does.
async function startGame(uuid: string): Promise<EmbedData> {
  const res = await fetch("/cloud/v1/startGame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ? String(body.error) : `Request failed (${res.status})`);
  return { ice_servers: body.ice_servers, signaling_ws: body.signaling_ws };
}

function describeEvent(event: CreateSessionEvent): string {
  switch (event.status) {
    case "creating_account":
      return "Creating account...";
    case "account_ready":
      return "Account ready...";
    case "requesting_game":
      return "Requesting game...";
    case "queue":
      return `Queued (position ${event.queue_pos ?? "?"})...`;
    case "finished_queue":
      return "Starting...";
    default:
      return event.status;
  }
}

// full flow for turning a catalog game_key into a live, connectable session:
// createSession -> (poll getQueue if queued) -> startGame.
export async function launchGameSession(
  gameKey: string,
  onProgress: (message: string) => void,
): Promise<EmbedData> {
  const { uuid, queued } = await createCloudSession(gameKey, (event) => onProgress(describeEvent(event)));

  if (queued) {
    for (;;) {
      await new Promise((r) => setTimeout(r, 3500));
      const pos = await pollQueue(uuid);
      if (pos === "finished_queue") break;
      onProgress(`Queued (position ${pos})...`);
    }
  }

  onProgress("Starting...");
  return startGame(uuid);
}

function normalizeCandidate(raw: unknown): RTCIceCandidateInit | undefined {
  if (typeof raw === "string") return { candidate: raw };
  if (raw && typeof raw === "object" && "candidate" in raw) return raw as RTCIceCandidateInit;
  return undefined;
}

// the taskbar/App shell compute "active window" the same way; duplicated
// here so this client can gate input capture without depending on Solid's
// reactive graph from an imperative event handler.
function isActiveWindow(hwnd: symbol): boolean {
  let maxZ = -1;
  let active: symbol | null = null;
  for (const w of windows) {
    if (w.z > maxZ && !w.minimized) {
      maxZ = w.z;
      active = w.hwnd;
    }
  }
  return active === hwnd;
}

export class CloudSession {
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private dc: RTCDataChannel | null = null;
  private remoteStream: MediaStream | null = null;
  private rafId: number | null = null;
  private escapeTimer: number | null = null;
  private readonly heldKeys = new Set<number>();
  private cursorHidden = false;
  private cursorObjectUrl: string | null = null;
  private focused = false;
  private destroyed = false;
  private lastAbsX = 5000;
  private lastAbsY = 5000;
  private lastButtons = 0;

  constructor(
    private readonly hwnd: symbol,
    private readonly video: HTMLVideoElement,
    private readonly onStatus: (status: CloudStatus, message?: string) => void,
  ) {
    this.attachInput();
  }

  async connect(id: string, host?: string): Promise<void> {
    this.onStatus("connecting");
    try {
      const embed = await fetchEmbedData(id, host);
      if (this.destroyed) return;
      this.startSignaling(embed);
    } catch (e) {
      if (!this.destroyed) this.onStatus("ended", (e as Error).message);
    }
  }

  // for callers that already have ice_servers/signaling_ws from a session
  // they created themselves (e.g. via launchGameSession below), skipping
  // the embed-data lookup for an already-active session.
  connectWithEmbedData(embed: EmbedData): void {
    this.onStatus("connecting");
    this.startSignaling(embed);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.escapeTimer !== null) clearTimeout(this.escapeTimer);
    this.detachInput();
    try {
      this.dc?.close();
    } catch {
      // already closed
    }
    try {
      this.pc?.close();
    } catch {
      // already closed
    }
    try {
      this.ws?.close();
    } catch {
      // already closed
    }
    if (this.cursorObjectUrl) URL.revokeObjectURL(this.cursorObjectUrl);
    if (document.pointerLockElement === this.video) document.exitPointerLock();
    this.video.srcObject = null;
    this.video.style.cursor = "";
  }

  // ---- signaling ----

  private startSignaling(embed: EmbedData): void {
    const ws = new WebSocket(embed.signaling_ws);
    this.ws = ws;
    ws.addEventListener("message", (ev) => void this.handleSignal(embed, ev));
    ws.addEventListener("close", () => {
      if (!this.destroyed) this.onStatus("ended", "Session ended");
    });
    ws.addEventListener("error", () => {
      if (!this.destroyed) this.onStatus("ended", "Signaling connection failed");
    });
  }

  private send(type: string, data: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify({ type, ...data }));
  }

  private async handleSignal(embed: EmbedData, ev: MessageEvent): Promise<void> {
    let msg: { type?: string; sdp?: string; candidate?: unknown };
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "game_ready":
        await this.createPeerConnection(embed);
        break;
      case "rtc_answer":
        if (msg.sdp) await this.pc?.setRemoteDescription({ type: "answer", sdp: msg.sdp });
        break;
      case "rtc_candidate": {
        const candidate = normalizeCandidate(msg.candidate);
        if (candidate) {
          try {
            await this.pc?.addIceCandidate(candidate);
          } catch {
            // candidate arrived after the connection settled; safe to drop
          }
        }
        break;
      }
    }
  }

  // ---- webrtc ----

  private async createPeerConnection(embed: EmbedData): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: embed.ice_servers });
    this.pc = pc;
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });

    const dc = pc.createDataChannel("JYSDK", { id: 1, ordered: false, maxRetransmits: 0 });
    this.dc = dc;
    dc.binaryType = "arraybuffer";
    dc.addEventListener("message", (ev) => {
      if (ev.data instanceof ArrayBuffer) this.handleCursorPacket(ev.data);
    });

    pc.ontrack = (ev) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        this.video.srcObject = this.remoteStream;
        void this.video.play().catch(() => {});
      }
      this.remoteStream.addTrack(ev.track);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.send("rtc_candidate", { candidate: ev.candidate.toJSON() });
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        this.onStatus("live");
      } else if (state === "failed" || state === "disconnected" || state === "closed") {
        if (!this.destroyed) this.onStatus("ended", "Connection lost");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send("rtc_offer", { sdp: offer.sdp });
  }

  // ---- incoming cursor packets ----
  // [0]=163 [1]=6 identifies a cursor packet. len<=32 hides the cursor,
  // otherwise [2] is a mime index, [3]/[4] are the hotspot, and the rest is
  // raw image bytes for a css cursor.

  private handleCursorPacket(data: ArrayBuffer): void {
    const bytes = new Uint8Array(data);
    if (bytes.length < 2 || bytes[0] !== 163 || bytes[1] !== 6) return;
    if (bytes.length <= 32) {
      this.cursorHidden = true;
      this.video.style.cursor = "none";
      return;
    }
    const mime = CURSOR_MIME[bytes[2]] ?? "image/png";
    const hotspotX = bytes[3];
    const hotspotY = bytes[4];
    const blob = new Blob([bytes.slice(5)], { type: mime });
    const url = URL.createObjectURL(blob);
    if (this.cursorObjectUrl) URL.revokeObjectURL(this.cursorObjectUrl);
    this.cursorObjectUrl = url;
    this.cursorHidden = false;
    this.video.style.cursor = `url(${url}) ${hotspotX} ${hotspotY}, default`;
  }

  // ---- outgoing input ----

  private sendKeyboard(changedCode: number, down: boolean): void {
    if (this.dc?.readyState !== "open") return;
    const others = [...this.heldKeys].filter((c) => c !== changedCode).slice(0, 5);
    const size = 7 + others.length * 3 + 1;
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    bytes[0] = 1;
    bytes[2] = 1;
    bytes[3] = 1;
    view.setUint16(4, changedCode, true);
    bytes[6] = down ? 1 : 0;
    let offset = 7;
    for (const code of others) {
      view.setUint16(offset, code, true);
      bytes[offset + 2] = 1;
      offset += 3;
    }
    bytes[offset] = 0xff;
    bytes[1] = size;
    this.dc.send(buf);
  }

  private sendMouse(absX: number, absY: number, relX: number, relY: number, buttons: number, scroll: number): void {
    if (this.dc?.readyState !== "open") return;
    const buf = new ArrayBuffer(12);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    bytes[0] = 1;
    bytes[1] = 11;
    bytes[2] = 2;
    bytes[3] = 8;
    view.setUint16(4, clamp(absX, 0, 10000), true);
    view.setUint16(6, clamp(absY, 0, 10000), true);
    view.setInt8(8, clamp(relX, -127, 127));
    view.setInt8(9, clamp(relY, -127, 127));
    bytes[10] = buttons & 0xff;
    view.setInt8(11, clamp(scroll, -1, 1));
    this.dc.send(buf);
  }

  private sendGamepad(pad: Gamepad): void {
    if (this.dc?.readyState !== "open") return;
    const buf = new ArrayBuffer(17);
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    bytes[0] = 1;
    bytes[1] = 16;
    bytes[2] = 3;
    bytes[3] = 2;
    bytes[4] = pad.index;
    let mask = 0;
    for (let i = 0; i < GAMEPAD_BTN_MASK.length && i < pad.buttons.length; i++) {
      if (pad.buttons[i]?.pressed) mask |= GAMEPAD_BTN_MASK[i];
    }
    view.setUint16(5, mask, true);
    bytes[7] = Math.round((pad.buttons[6]?.value ?? 0) * 255);
    bytes[8] = Math.round((pad.buttons[7]?.value ?? 0) * 255);
    view.setInt16(9, Math.round((pad.axes[0] ?? 0) * 32767), true);
    view.setInt16(11, Math.round((pad.axes[1] ?? 0) * -32767), true);
    view.setInt16(13, Math.round((pad.axes[2] ?? 0) * 32767), true);
    view.setInt16(15, Math.round((pad.axes[3] ?? 0) * -32767), true);
    this.dc.send(buf);
  }

  // ---- input capture ----

  private readonly onVideoClick = () => {
    this.focused = true;
    this.video.classList.add("cloud-video-focused");
    const nav = navigator as Navigator & { keyboard?: { lock?: (codes?: string[]) => Promise<void> } };
    void nav.keyboard?.lock?.().catch(() => {});
  };

  private readonly onVideoMouseDown = (e: MouseEvent) => {
    if (this.cursorHidden && document.pointerLockElement !== this.video) {
      void this.video.requestPointerLock?.();
    }
    this.sendMouseFromEvent(e);
  };

  private readonly onVideoMouseMove = (e: MouseEvent) => {
    if (!this.focused) return;
    this.sendMouseFromEvent(e);
  };

  private readonly onVideoMouseUp = (e: MouseEvent) => {
    if (!this.focused) return;
    this.sendMouseFromEvent(e);
  };

  private readonly onVideoWheel = (e: WheelEvent) => {
    if (!this.focused) return;
    e.preventDefault();
    const scroll = e.deltaY > 0 ? -1 : e.deltaY < 0 ? 1 : 0;
    this.sendMouse(this.lastAbsX, this.lastAbsY, 0, 0, this.lastButtons, scroll);
  };

  private readonly onVideoContextMenu = (e: MouseEvent) => {
    if (this.focused) e.preventDefault();
  };

  private sendMouseFromEvent(e: MouseEvent): void {
    const rect = this.video.getBoundingClientRect();
    const absX = clamp(Math.round(((e.clientX - rect.left) / rect.width) * 10000), 0, 10000);
    const absY = clamp(Math.round(((e.clientY - rect.top) / rect.height) * 10000), 0, 10000);
    this.lastAbsX = absX;
    this.lastAbsY = absY;
    this.lastButtons = e.buttons;
    const relX = clamp(e.movementX ?? 0, -127, 127);
    const relY = clamp(e.movementY ?? 0, -127, 127);
    this.sendMouse(absX, absY, relX, relY, e.buttons, 0);
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.focused || !isActiveWindow(this.hwnd)) return;
    if (e.key === "Escape" && this.escapeTimer === null) {
      this.escapeTimer = window.setTimeout(() => this.exitFocus(), 1200);
    }
    const code = e.keyCode;
    if (!this.heldKeys.has(code)) {
      this.heldKeys.add(code);
      this.sendKeyboard(code, true);
    }
    e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.escapeTimer !== null) {
      clearTimeout(this.escapeTimer);
      this.escapeTimer = null;
    }
    if (!this.focused || !isActiveWindow(this.hwnd)) return;
    const code = e.keyCode;
    this.heldKeys.delete(code);
    this.sendKeyboard(code, false);
    e.preventDefault();
  };

  private readonly onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.focused) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  private exitFocus(): void {
    this.focused = false;
    this.escapeTimer = null;
    this.heldKeys.clear();
    this.video.classList.remove("cloud-video-focused");
    if (document.pointerLockElement === this.video) document.exitPointerLock();
    const nav = navigator as Navigator & { keyboard?: { unlock?: () => void } };
    nav.keyboard?.unlock?.();
  }

  private attachInput(): void {
    this.video.addEventListener("click", this.onVideoClick);
    this.video.addEventListener("mousedown", this.onVideoMouseDown);
    this.video.addEventListener("mousemove", this.onVideoMouseMove);
    this.video.addEventListener("mouseup", this.onVideoMouseUp);
    this.video.addEventListener("wheel", this.onVideoWheel, { passive: false });
    this.video.addEventListener("contextmenu", this.onVideoContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    const tick = () => {
      if (this.destroyed) return;
      if (!isActiveWindow(this.hwnd) && this.focused) this.exitFocus();
      if (this.focused) {
        for (const pad of navigator.getGamepads()) {
          if (pad) this.sendGamepad(pad);
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private detachInput(): void {
    this.video.removeEventListener("click", this.onVideoClick);
    this.video.removeEventListener("mousedown", this.onVideoMouseDown);
    this.video.removeEventListener("mousemove", this.onVideoMouseMove);
    this.video.removeEventListener("mouseup", this.onVideoMouseUp);
    this.video.removeEventListener("wheel", this.onVideoWheel);
    this.video.removeEventListener("contextmenu", this.onVideoContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
  }
}
