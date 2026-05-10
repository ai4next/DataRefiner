import type { Request, Response } from 'express';
import { upload, verifyMagicBytes, saveFileRecord, getOwnedFileById, getFilesByUser, deleteFile } from '../services/file-manager.js';
import { parseExcel, parseCsv } from '../services/exporter.js';
import path from 'path';
import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export function uploadFile(req: Request, res: Response): void {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const ext = path.extname(file.originalname).toLowerCase();

    // Verify magic bytes for binary formats
    if (!verifyMagicBytes(file.path, ext)) {
      return res.status(400).json({ error: '文件格式校验失败，文件可能已损坏' });
    }

    const fileId = saveFileRecord(req.user!.id, file.originalname, file.path, file.size);

    // Parse to get row/col count
    try {
      const parsed = ext === '.csv' || ext === '.tsv'
        ? parseCsv(file.path)
        : parseExcel(file.path);

      const db = getDb();
      db.prepare('UPDATE files SET row_count = ?, col_count = ? WHERE id = ?')
        .run(parsed.rows.length, parsed.headers.length, fileId);

      res.json({
        id: fileId,
        originalName: file.originalname,
        fileSize: file.size,
        rowCount: parsed.rows.length,
        colCount: parsed.headers.length,
        status: 'uploaded',
      });
    } catch (parseErr: any) {
      logger.error({ err: parseErr }, 'File parse failed');
      res.status(422).json({ error: `文件解析失败: ${parseErr.message}` });
    }
  });
}

export function listFiles(req: Request, res: Response): void {
  const files = getFilesByUser(req.user!.id);
  res.json(files);
}

export function getFile(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const file = getOwnedFileById(fileId, req.user!.id);
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  res.json(file);
}

export function previewFile(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const file = getOwnedFileById(fileId, req.user!.id) as any;
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }

  const ext = path.extname(file.original_name).toLowerCase();
  const parsed = ext === '.csv' || ext === '.tsv'
    ? parseCsv(file.stored_path)
    : parseExcel(file.stored_path);

  res.json({
    headers: parsed.headers,
    rows: parsed.rows.slice(0, 100),
    totalRows: parsed.rows.length,
  });
}

export function removeFile(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const file = getOwnedFileById(fileId, req.user!.id);
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }
  deleteFile(fileId);
  res.json({ success: true });
}