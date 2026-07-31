// Builds a .spa package (a zip with a manifest.json + code files) from a
// source directory. A .spa is just a zip, so this only needs node:zlib.
//
// usage: node scripts/build-spa.mjs [srcDir] [outFile]
//   defaults: srcDir = testapp, outFile = testapp.spa

/* global process, Buffer, console */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

const srcDir = resolve(process.argv[2] ?? "testapp");
const outFile = resolve(process.argv[3] ?? "testapp.spa");

function walk(dir, base = dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full, base));
    } else {
      files.push(full);
    }
  }
  return files;
}

function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

function u16(v) {
  return Buffer.from([v & 0xff, (v >>> 8) & 0xff]);
}
function u32(v) {
  return Buffer.from([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

const files = walk(srcDir).sort();
const { time, date } = dosDateTime();

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = relative(srcDir, file).split("\\").join("/");
  const data = readFileSync(file);
  const compressed = deflateRawSync(data);
  const crc = crc32(data) >>> 0;
  const nameBuf = Buffer.from(name);

  const local = Buffer.concat([
    u32(0x04034b50), // signature
    u16(20), // version needed
    u16(0), // flags
    u16(8), // method: deflate
    u16(time),
    u16(date),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0), // extra len
    nameBuf,
    compressed,
  ]);
  localParts.push(local);

  const central = Buffer.concat([
    u32(0x02014b50), // signature
    u16(20), // version made by
    u16(20), // version needed
    u16(0), // flags
    u16(8), // method
    u16(time),
    u16(date),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0), // extra len
    u16(0), // comment len
    u16(0), // disk start
    u16(0), // internal attrs
    u32(0), // external attrs
    u32(offset), // local header offset
    nameBuf,
  ]);
  centralParts.push(central);

  offset += local.length;
}

const cd = Buffer.concat(centralParts);
const cdOffset = offset;

const eocd = Buffer.concat([
  u32(0x06054b50), // signature
  u16(0),
  u16(0),
  u16(centralParts.length),
  u16(centralParts.length),
  u32(cd.length),
  u32(cdOffset),
  u16(0), // comment len
]);

const zip = Buffer.concat([...localParts, cd, eocd]);
writeFileSync(outFile, zip);

console.log(`wrote ${outFile} (${zip.length} bytes, ${centralParts.length} files)`);
console.log(files.map((f) => "  " + relative(srcDir, f)).join("\n"));
