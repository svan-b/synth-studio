// ============================================================================
// Minimal ZIP writer (stored, no compression - WAV barely compresses anyway).
// Entries are Blob parts with a precomputed CRC-32, so a multi-gigabyte set of
// stems is assembled without copying it into one buffer. No zip64: the archive
// must stay under 4 GB (callers fall back to separate files).
// ============================================================================

export interface ZipEntry {
  name: string;
  data: BlobPart[];
  size: number;
  crc: number;
}

export const ZIP_LIMIT = 0xffffffff;

export function zipSize(entries: ZipEntry[]): number {
  const enc = new TextEncoder();
  return entries.reduce((n, e) => n + 30 + 46 + 2 * enc.encode(e.name).length + e.size, 22);
}

export function makeZip(entries: ZipEntry[], date = new Date()): Blob {
  if (zipSize(entries) >= ZIP_LIMIT) throw new Error('Too big for a zip file (4 GB)');
  const enc = new TextEncoder();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  entries.forEach(e => {
    const name = new Uint8Array(enc.encode(e.name));
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // UTF-8 names
    h.setUint16(8, 0, true);      // stored
    h.setUint16(10, time, true);
    h.setUint16(12, day, true);
    h.setUint32(14, e.crc >>> 0, true);
    h.setUint32(18, e.size, true);
    h.setUint32(22, e.size, true);
    h.setUint16(26, name.length, true);
    h.setUint16(28, 0, true);
    parts.push(h.buffer, name, ...e.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, day, true);
    c.setUint32(16, e.crc >>> 0, true);
    c.setUint32(20, e.size, true);
    c.setUint32(24, e.size, true);
    c.setUint16(28, name.length, true);
    c.setUint16(30, 0, true);
    c.setUint16(32, 0, true);
    c.setUint16(34, 0, true);
    c.setUint16(36, 0, true);
    c.setUint32(38, 0, true);
    c.setUint32(42, offset, true);
    const rec = new Uint8Array(46 + name.length);
    rec.set(new Uint8Array(c.buffer), 0);
    rec.set(name, 46);
    central.push(rec);
    offset += 30 + name.length + e.size;
  });
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  end.setUint16(20, 0, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
