import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { Row, HeaderRow, OperationLog } from '@datarefiner/shared';
import { logger } from '../lib/logger.js';
import { detectEncoding } from '../lib/encoding-detector.js';

// ── Import ──

export function parseExcel(filePath: string): { headers: HeaderRow; rows: Row[]; sheetName: string } {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(worksheet, { header: 1, defval: null });

  if (data.length === 0) {
    return { headers: [], rows: [], sheetName };
  }

  const headers = data[0].map((h, i) => h != null ? String(h).trim() : `Column_${i + 1}`);
  const rows = data.slice(1).filter((r: Row) => r.some(v => v !== null && v !== undefined && v !== ''));

  return { headers, rows, sheetName };
}

export function parseCsv(filePath: string, encoding?: string): { headers: HeaderRow; rows: Row[]; sheetName: string } {
  let content: string;
  const enc = encoding || detectEncoding(filePath);
  if (enc === 'gbk' || enc === 'shift-jis') {
    // For non-UTF-8 encodings, read as buffer and decode
    const buf = fs.readFileSync(filePath);
    content = decodeBuffer(buf, enc);
  } else {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Normalize line endings
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detect delimiter: tab for .tsv, comma for .csv
  const ext = path.extname(filePath).toLowerCase();
  const delimiter = ext === '.tsv' ? '\t' : ',';

  const lines = content.split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [], sheetName: 'Sheet1' };
  }

  const headers = parseCsvLine(lines[0], delimiter).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line, delimiter);
    return values.map(v => {
      const trimmed = v.trim();
      if (trimmed === '') return null;
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    });
  }).filter(r => r.some(v => v !== null));

  return { headers, rows, sheetName: 'Sheet1' };
}

/**
 * Parse a single CSV/TSV line, respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  // Unescape double-quotes and strip outer quotes
  return result.map(v => {
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1);
    }
    return v.replace(/""/g, '"');
  });
}

/**
 * Decode a buffer using common Chinese/Japanese encodings.
 */
function decodeBuffer(buf: Buffer, enc: string): string {
  try {
    // Use TextDecoder if available (Node 16+)
    const decoder = new TextDecoder(enc === 'shift-jis' ? 'shift-jis' : 'gbk');
    return decoder.decode(buf);
  } catch {
    // Fallback: strip non-UTF-8 bytes and return best-effort
    logger.warn({ encoding: enc }, 'Encoding decode failed, stripping non-UTF-8 bytes');
    return buf.toString('utf-8');
  }
}

// ── Export ──

export function exportToXlsx(headers: HeaderRow, rows: Row[], filePath: string): void {
  const data = [headers, ...rows.map(r => [...r])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cleaned');
  XLSX.writeFile(wb, filePath);
}

export function exportToCsv(headers: HeaderRow, rows: Row[], filePath: string): void {
  const lines = [
    headers.join(','),
    ...rows.map(r => r.map(v => {
      if (v === null || v === undefined || v === '') return '';
      const s = String(v);
      return s.includes(',') ? `"${s}"` : s;
    }).join(',')),
  ];
  // Write with UTF-8 BOM for Excel compatibility
  const bom = '﻿';
  fs.writeFileSync(filePath, bom + lines.join('\n'), 'utf-8');
}

export interface ReportData {
  originalFileName: string;
  originalRowCount: number;
  resultRowCount: number;
  healthScoreBefore: number;
  healthScoreAfter: number;
  operations: OperationLog[];
  generatedAt: string;
}

export function exportToPdf(report: ReportData, filePath: string): Promise<void> {
  // Simple PDF generation with pdfkit
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Title
  doc.fontSize(20).text('数据清洗报告', { align: 'center' });
  doc.moveDown();

  // Basic info
  doc.fontSize(12).text(`原始文件: ${report.originalFileName}`);
  doc.text(`生成时间: ${report.generatedAt}`);
  doc.moveDown();

  // Stats
  doc.fontSize(14).text('清洗统计');
  doc.fontSize(11);
  doc.text(`原始行数: ${report.originalRowCount}`);
  doc.text(`结果行数: ${report.resultRowCount}`);
  doc.text(`清洗前行数据健康分: ${report.healthScoreBefore}`);
  doc.text(`清洗后数据健康分: ${report.healthScoreAfter}`);
  doc.moveDown();

  // Operations
  doc.fontSize(14).text('执行操作');
  for (const op of report.operations) {
    doc.fontSize(11).text(`• ${op.actionType}: 影响 ${op.affectedRows} 行 (列: ${op.affectedColumns.join(', ') || '全部'})`);
  }

  doc.end();

  return new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}