// minimal client-side zip reader for .spa archives
// relies on the built-in DecompressionStream("deflate-raw"), so it only needs
// to find entry offsets in the central directory + local headers.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function readU16(b: Uint8Array, off: number): number {
  return b[off] | (b[off + 1] << 8);
}

function readU32(b: Uint8Array, off: number): number {
  return (
    (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | ((b[off + 3] << 24) >>> 0)) >>>
    0
  );
}

function normalizeZipName(name: string): string {
  return name.split("\\").join("/").replace(/^\/+/, "");
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not supported in this browser");
  }
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

interface Eocd {
  cdOffset: number;
  cdSize: number;
  totalEntries: number;
}

function findEocd(bytes: Uint8Array): Eocd {
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (readU32(bytes, i) === EOCD_SIG) {
      return {
        cdOffset: readU32(bytes, i + 16),
        cdSize: readU32(bytes, i + 12),
        totalEntries: readU16(bytes, i + 10),
      };
    }
  }
  throw new Error("not a valid zip archive (no end of central directory)");
}

interface CentralEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function parseCentralDirectory(bytes: Uint8Array, eocd: Eocd): CentralEntry[] {
  const entries: CentralEntry[] = [];
  let offset = eocd.cdOffset;
  const end = offset + eocd.cdSize;

  while (offset + 46 <= end) {
    if (readU32(bytes, offset) !== CEN_SIG) {
      throw new Error("corrupt zip central directory");
    }
    const nameLen = readU16(bytes, offset + 28);
    const extraLen = readU16(bytes, offset + 30);
    const commentLen = readU16(bytes, offset + 32);

    entries.push({
      name: normalizeZipName(
        new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen)),
      ),
      method: readU16(bytes, offset + 10),
      compressedSize: readU32(bytes, offset + 20),
      localOffset: readU32(bytes, offset + 42),
    });

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

function readLocalData(bytes: Uint8Array, entry: CentralEntry): Uint8Array {
  const off = entry.localOffset;
  if (readU32(bytes, off) !== LOC_SIG) {
    throw new Error(`corrupt local header for "${entry.name}"`);
  }
  const nameLen = readU16(bytes, off + 26);
  const extraLen = readU16(bytes, off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  return bytes.subarray(dataStart, dataStart + entry.compressedSize);
}

export async function unzip(bytes: ArrayBuffer): Promise<ZipEntry[]> {
  const buf = new Uint8Array(bytes);
  const eocd = findEocd(buf);
  const central = parseCentralDirectory(buf, eocd);
  const out: ZipEntry[] = [];

  for (const entry of central) {
    if (entry.name.endsWith("/")) continue;
    const raw = readLocalData(buf, entry);
    let data: Uint8Array;
    if (entry.method === 0) {
      data = raw;
    } else if (entry.method === 8) {
      data = await inflateRaw(raw);
    } else {
      throw new Error(
        `unsupported zip compression method ${entry.method} for "${entry.name}"`,
      );
    }
    out.push({ name: entry.name, data });
  }

  return out;
}
