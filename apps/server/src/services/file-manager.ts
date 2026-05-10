import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${uuid()}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.tsv'];
const MAGIC_BYTES: Record<string, Uint8Array> = {
  '.xlsx': new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  '.xls': new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]),
};

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      cb(new Error(`不支持的文件格式: ${ext}。支持: ${ALLOWED_EXTENSIONS.join(', ')}`));
      return;
    }
    cb(null, true);
  },
});

export function verifyMagicBytes(filePath: string, ext: string): boolean {
  const magic = MAGIC_BYTES[ext];
  if (!magic) return true; // text formats skip magic check
  try {
    const buffer = fs.readFileSync(filePath).subarray(0, 4);
    return buffer.equals(magic);
  } catch {
    return false;
  }
}

export function saveFileRecord(userId: string, originalName: string, storedPath: string, fileSize: number): string {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO files (id, user_id, original_name, stored_path, file_size, status)
    VALUES (?, ?, ?, ?, ?, 'uploaded')
  `).run(id, userId, originalName, storedPath, fileSize);
  return id;
}

export function getFileById(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

export function getOwnedFileById(id: string, userId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(id, userId);
}

export function getFilesByUser(userId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 20').all(userId);
}

export function updateFileStatus(id: string, status: string) {
  const db = getDb();
  db.prepare('UPDATE files SET status = ? WHERE id = ?').run(status, id);
}

export function deleteFile(id: string) {
  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as any;
  if (file && fs.existsSync(file.stored_path)) {
    fs.unlinkSync(file.stored_path);
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
}

export function getUserDir(userId: string): string {
  const dir = path.join(UPLOAD_DIR, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}