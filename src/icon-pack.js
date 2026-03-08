import { rasterize } from './rasterizer.js';

const IOS_SIZES = [
  { size: 1024, name: 'AppIcon-1024x1024.png', label: 'App Store' },
  { size: 180, name: 'AppIcon-180x180.png', label: 'iPhone @3x' },
  { size: 167, name: 'AppIcon-167x167.png', label: 'iPad Pro @2x' },
  { size: 152, name: 'AppIcon-152x152.png', label: 'iPad @2x' },
  { size: 120, name: 'AppIcon-120x120.png', label: 'iPhone @2x' },
  { size: 87, name: 'AppIcon-87x87.png', label: 'Settings @3x' },
  { size: 80, name: 'AppIcon-80x80.png', label: 'Spotlight @2x' },
  { size: 76, name: 'AppIcon-76x76.png', label: 'iPad @1x' },
  { size: 60, name: 'AppIcon-60x60.png', label: 'iPhone @1x' },
  { size: 40, name: 'AppIcon-40x40.png', label: 'Spotlight @1x' },
];

const ANDROID_SIZES = [
  { size: 512, name: 'play-store-512x512.png', label: 'Play Store' },
  { size: 192, name: 'mipmap-xxxhdpi/ic_launcher.png', label: 'xxxhdpi' },
  { size: 144, name: 'mipmap-xxhdpi/ic_launcher.png', label: 'xxhdpi' },
  { size: 96, name: 'mipmap-xhdpi/ic_launcher.png', label: 'xhdpi' },
  { size: 72, name: 'mipmap-hdpi/ic_launcher.png', label: 'hdpi' },
  { size: 48, name: 'mipmap-mdpi/ic_launcher.png', label: 'mdpi' },
];

/**
 * Generate a ZIP containing all iOS and Android app icon sizes.
 * @param {string} svgStr - Serialized SVG string
 * @param {function} onProgress - Called with (completed, total) counts
 * @returns {Promise<Blob>} ZIP file blob
 */
export async function generateIconPack(svgStr, onProgress) {
  const allIcons = [
    ...IOS_SIZES.map(s => ({ ...s, path: `ios/${s.name}` })),
    ...ANDROID_SIZES.map(s => ({ ...s, path: `android/${s.name}` })),
  ];
  const total = allIcons.length;
  let completed = 0;

  // Rasterize all icons in parallel (each uses its own canvas)
  const entries = await Promise.all(
    allIcons.map(async (icon) => {
      const blob = await rasterize(svgStr, icon.size, icon.size, 'png', false, false);
      const data = new Uint8Array(await blob.arrayBuffer());
      completed++;
      if (onProgress) onProgress(completed, total);
      return { path: icon.path, data };
    })
  );

  return buildZip(entries);
}

/**
 * Build a ZIP file from an array of {path, data} entries.
 * Uses store method (no compression) since PNGs are already compressed.
 */
function buildZip(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const { path, data } of entries) {
    const pathBytes = new TextEncoder().encode(path);
    const crc = crc32(data);

    // Local file header (30 + pathLen + dataLen)
    const local = new Uint8Array(30 + pathBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);   // signature
    lv.setUint16(4, 20, true);            // version needed
    lv.setUint16(6, 0, true);             // flags
    lv.setUint16(8, 0, true);             // compression: store
    lv.setUint16(10, 0, true);            // mod time
    lv.setUint16(12, 0, true);            // mod date
    lv.setUint32(14, crc, true);          // crc32
    lv.setUint32(18, data.length, true);  // compressed size
    lv.setUint32(22, data.length, true);  // uncompressed size
    lv.setUint16(26, pathBytes.length, true); // filename length
    lv.setUint16(28, 0, true);            // extra field length
    local.set(pathBytes, 30);
    local.set(data, 30 + pathBytes.length);
    localHeaders.push(local);

    // Central directory header (46 + pathLen)
    const central = new Uint8Array(46 + pathBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);    // signature
    cv.setUint16(4, 20, true);            // version made by
    cv.setUint16(6, 20, true);            // version needed
    cv.setUint16(8, 0, true);             // flags
    cv.setUint16(10, 0, true);            // compression: store
    cv.setUint16(12, 0, true);            // mod time
    cv.setUint16(14, 0, true);            // mod date
    cv.setUint32(16, crc, true);          // crc32
    cv.setUint32(20, data.length, true);  // compressed size
    cv.setUint32(24, data.length, true);  // uncompressed size
    cv.setUint16(28, pathBytes.length, true); // filename length
    cv.setUint16(30, 0, true);            // extra field length
    cv.setUint16(32, 0, true);            // comment length
    cv.setUint16(34, 0, true);            // disk number start
    cv.setUint16(36, 0, true);            // internal attrs
    cv.setUint32(38, 0, true);            // external attrs
    cv.setUint32(42, offset, true);       // local header offset
    central.set(pathBytes, 46);
    centralHeaders.push(central);

    offset += local.length;
  }

  const centralSize = centralHeaders.reduce((s, c) => s + c.length, 0);

  // End of central directory (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);           // signature
  ev.setUint16(4, 0, true);                     // disk number
  ev.setUint16(6, 0, true);                     // central dir disk
  ev.setUint16(8, entries.length, true);         // entries on disk
  ev.setUint16(10, entries.length, true);        // total entries
  ev.setUint32(12, centralSize, true);           // central dir size
  ev.setUint32(16, offset, true);               // central dir offset
  ev.setUint16(20, 0, true);                     // comment length

  return new Blob([...localHeaders, ...centralHeaders, eocd], { type: 'application/zip' });
}

/** Compute CRC-32 for a Uint8Array. */
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
