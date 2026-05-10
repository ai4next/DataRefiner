import type { Request, Response } from 'express';
import { getDb } from '../lib/db.js';
import { runDiagnosis } from '../services/diagnosis-engine.js';
import { generateSuggestions } from '../services/ai-analyzer.js';
import { parseExcel, parseCsv } from '../services/exporter.js';
import { updateFileStatus, getOwnedFileById } from '../services/file-manager.js';
import { eventBus } from '../lib/event-bus.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { logger } from '../lib/logger.js';

export async function diagnose(req: Request, res: Response): Promise<void> {
  const fileId = req.params.id as string;
  const file = getOwnedFileById(fileId, req.user!.id) as any;

  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }

  // Start async diagnosis
  res.json({ status: 'diagnosing', fileId });

  try {
    updateFileStatus(fileId, 'diagnosing');
    eventBus.emitWs(fileId, { type: 'progress', stage: 'diagnose', data: { progress: 0, message: '开始诊断...' } });

    const ext = path.extname(file.original_name).toLowerCase();
    const parsed = ext === '.csv' || ext === '.tsv'
      ? parseCsv(file.stored_path)
      : parseExcel(file.stored_path);

    eventBus.emitWs(fileId, { type: 'progress', stage: 'diagnose', data: { progress: 0.3, message: `分析 ${parsed.headers.length} 列、${parsed.rows.length.toLocaleString()} 行...` } });

    const diagnosis = runDiagnosis(parsed);

    // Emit duplicate detection info
    if (diagnosis.duplicateRows && diagnosis.duplicateRows > 0) {
      eventBus.emitWs(fileId, { type: 'progress', stage: 'diagnose', data: { progress: 0.45, message: `检测到 ${diagnosis.duplicateRows} 行重复数据...` } });
    }

    eventBus.emitWs(fileId, { type: 'progress', stage: 'diagnose', data: { progress: 0.6, message: 'AI 增强分析...' } });

    // AI suggestions
    let aiSuggestions = null;
    try {
      aiSuggestions = await generateSuggestions(diagnosis, parsed.rows);
    } catch (err) {
      logger.warn({ err }, 'AI suggestions failed');
    }

    eventBus.emitWs(fileId, { type: 'progress', stage: 'diagnose', data: { progress: 0.9, message: '生成报告...' } });

    const db = getDb();
    const reportId = uuid();
    db.prepare(`
      INSERT INTO diagnosis_reports (id, file_id, report_json, ai_suggestions_json)
      VALUES (?, ?, ?, ?)
    `).run(
      reportId,
      fileId,
      JSON.stringify(diagnosis),
      aiSuggestions ? JSON.stringify(aiSuggestions) : null,
    );

    updateFileStatus(fileId, 'diagnosed');
    eventBus.emitWs(fileId, { type: 'complete', stage: 'diagnose', data: { progress: 1, message: '诊断完成', resultId: reportId } });
  } catch (err: any) {
    logger.error({ err }, 'Diagnosis failed');
    updateFileStatus(fileId, 'uploaded');
    eventBus.emitWs(fileId, { type: 'error', stage: 'diagnose', data: { error: err.message } });
  }
}

export function getDiagnosis(req: Request, res: Response): void {
  const fileId = req.params.id as string;

  // Verify file ownership
  const file = getOwnedFileById(fileId, req.user!.id);
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }

  const db = getDb();
  const report = db.prepare('SELECT * FROM diagnosis_reports WHERE file_id = ?').get(fileId) as any;

  if (!report) {
    res.status(404).json({ error: '诊断报告不存在' });
    return;
  }

  res.json({
    id: report.id,
    fileId: report.file_id,
    report: JSON.parse(report.report_json),
    aiSuggestions: report.ai_suggestions_json ? JSON.parse(report.ai_suggestions_json) : null,
    createdAt: report.created_at,
  });
}