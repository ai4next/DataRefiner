import fs from 'fs';

/**
 * Detect text encoding by analyzing byte patterns.
 * Only used for CSV/TSV files where encoding may not be UTF-8.
 */
export function detectEncoding(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const len = Math.min(buf.length, 4096);

  // Check for UTF-8 BOM
  if (len >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    return 'utf-8';
  }

  // Check for UTF-16LE BOM
  if (len >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
    return 'utf-16le';
  }

  // Count null bytes to detect UTF-16
  let nullCount = 0;
  let asciiCount = 0;
  let nonAsciiCount = 0;

  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) nullCount++;
    else if (buf[i] < 0x80) asciiCount++;
    else nonAsciiCount++;
  }

  // High null byte count suggests UTF-16 or binary
  if (nullCount > len * 0.1) {
    return 'utf-16le';
  }

  // Check if valid UTF-8 (no invalid byte sequences)
  let isValidUtf8 = true;
  let i = 0;
  while (i < len) {
    const byte = buf[i];
    if (byte < 0x80) {
      i++;
    } else if (byte >= 0xC2 && byte <= 0xDF) {
      if (i + 1 >= len || !isContinuationByte(buf[i + 1])) { isValidUtf8 = false; break; }
      i += 2;
    } else if (byte === 0xE0) {
      if (i + 2 >= len || buf[i + 1] < 0xA0 || buf[i + 1] > 0xBF || !isContinuationByte(buf[i + 2])) { isValidUtf8 = false; break; }
      i += 3;
    } else if (byte >= 0xE1 && byte <= 0xEF && byte !== 0xE0) {
      if (i + 2 >= len || !isContinuationByte(buf[i + 1]) || !isContinuationByte(buf[i + 2])) { isValidUtf8 = false; break; }
      i += 3;
    } else if (byte === 0xF0) {
      if (i + 3 >= len || buf[i + 1] < 0x90 || buf[i + 1] > 0xBF || !isContinuationByte(buf[i + 2]) || !isContinuationByte(buf[i + 3])) { isValidUtf8 = false; break; }
      i += 4;
    } else if (byte >= 0xF1 && byte <= 0xF3) {
      if (i + 3 >= len || !isContinuationByte(buf[i + 1]) || !isContinuationByte(buf[i + 2]) || !isContinuationByte(buf[i + 3])) { isValidUtf8 = false; break; }
      i += 4;
    } else if (byte === 0xF4) {
      if (i + 3 >= len || buf[i + 1] < 0x80 || buf[i + 1] > 0x8F || !isContinuationByte(buf[i + 2]) || !isContinuationByte(buf[i + 3])) { isValidUtf8 = false; break; }
      i += 4;
    } else {
      // Invalid start byte — likely GBK or Shift-JIS
      isValidUtf8 = false;
      break;
    }
  }

  if (isValidUtf8 && nonAsciiCount > 0) {
    return 'utf-8';
  }

  // If non-ASCII bytes present and not valid UTF-8, likely GBK or Shift-JIS
  if (nonAsciiCount > 0) {
    // Shift-JIS has more high bytes in the 0x80-0xA0 range
    let sjisLike = 0;
    for (let i = 0; i < len; i++) {
      if (buf[i] >= 0x80 && buf[i] <= 0xA0) sjisLike++;
    }
    return sjisLike > nonAsciiCount * 0.3 ? 'shift-jis' : 'gbk';
  }

  return 'utf-8';
}

function isContinuationByte(byte: number): boolean {
  return byte >= 0x80 && byte <= 0xBF;
}