import type { Request, Response } from 'express';
import { getDb } from '../lib/db.js';
import { getOwnedFileById, updateFileStatus } from '../services/file-manager.js';
import { CleaningExecutor } from '../services/cleaning-engine.js';
import { parseExcel, parseCsv, exportToXlsx, exportToCsv, exportToPdf } from '../services/exporter.js';
import { eventBus } from '../lib/event-bus.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { logger } from '../lib/logger.js';
import fs from 'fs';
import { runDiagnosis } from '../services/diagnosis-engine.js';
import { deductQuota, checkQuota } from './billing.controller.js';

export function getPlan(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const db = getDb();
  const plan = db.prepare('SELECT * FROM cleaning_plans WHERE file_id = ?').get(fileId) as any;

  if (!plan) {
    // Auto-generate from diagnosis if no plan exists
    const report = db.prepare('SELECT * FROM diagnosis_reports WHERE file_id = ?').get(fileId) as any;
    if (!report) {
      res.status(404).json({ error: '请先完成诊断' });
      return;
    }
    const diagnosis = JSON.parse(report.report_json);
    const aiSuggestions = report.ai_suggestions_json ? JSON.parse(report.ai_suggestions_json) : [];

    const actions: any[] = [];
    // Add trim_whitespace
    actions.push({
      actionType: 'trim_whitespace',
      name: '去除所有文本列前后空格',
      affectedColumns: [],
      params: {},
      estimatedImpactRows: 0,
      confidence: 0.95,
      enabled: true,
    });

    // Add suggestions from AI or fallback to rule-based
    if (aiSuggestions.length > 0) {
      for (const insight of aiSuggestions) {
        for (const sug of insight.suggestions || []) {
          actions.push({
            actionType: sug.action,
            name: `${insight.columnName}: ${sug.reason}`,
            affectedColumns: [insight.columnName],
            params: sug.params,
            estimatedImpactRows: Math.round((diagnosis.columns?.[insight.columnName]?.nullRate || 0) * 1000),
            confidence: sug.confidence,
            enabled: true,
          });
        }
      }
    } else {
      // Rule-based fallback from diagnosis columns
      for (const [colName, profile] of Object.entries(diagnosis.columns || {}) as [string, any][]) {
        if (profile.nullRate > 0.05) {
          actions.push({
            actionType: 'fill_null',
            name: `填充「${colName}」缺失值`,
            affectedColumns: [colName],
            params: { column: colName, fillValue: '' },
            estimatedImpactRows: Math.round(profile.nullRate * 1000),
            confidence: 0.7,
            enabled: true,
          });
        }
        if (profile.formatConsistency !== undefined && profile.formatConsistency < 0.8) {
          actions.push({
            actionType: 'format_date',
            name: `统一「${colName}」日期格式为 yyyy-MM-dd`,
            affectedColumns: [colName],
            params: { column: colName, targetFormat: 'iso' },
            estimatedImpactRows: Math.round((1 - profile.formatConsistency) * 1000),
            confidence: 0.9,
            enabled: true,
          });
        }
        if (profile.inferredType === 'phone') {
          actions.push({
            actionType: 'clean_phone',
            name: `清理「${colName}」手机号格式`,
            affectedColumns: [colName],
            params: { column: colName },
            estimatedImpactRows: 0,
            confidence: 0.9,
            enabled: true,
          });
        }
        if (profile.inferredType === 'amount') {
          actions.push({
            actionType: 'format_number',
            name: `清理「${colName}」金额单位`,
            affectedColumns: [colName],
            params: { column: colName, pattern: '[¥$￥€元, ]' },
            estimatedImpactRows: 0,
            confidence: 0.8,
            enabled: true,
          });
        }
      }
    }

    const planId = uuid();
    const planJson = JSON.stringify({ actions });
    db.prepare(`
      INSERT INTO cleaning_plans (id, file_id, plan_json, status)
      VALUES (?, ?, ?, 'draft')
    `).run(planId, fileId, planJson);

    res.json({ id: planId, fileId, plan: { actions }, status: 'draft' });
    return;
  }

  res.json({
    id: plan.id,
    fileId: plan.file_id,
    plan: JSON.parse(plan.plan_json),
    status: plan.status,
  });
}

export async function generatePlan(req: Request, res: Response): Promise<void> {
  const fileId = req.params.id as string;
  const file = getOwnedFileById(fileId, req.user!.id) as any;
  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }

  const db = getDb();
  const report = db.prepare('SELECT * FROM diagnosis_reports WHERE file_id = ?').get(fileId) as any;
  if (!report) {
    res.status(400).json({ error: '请先完成诊断' });
    return;
  }

  const diagnosis = JSON.parse(report.report_json);
  const aiSuggestions = report.ai_suggestions_json ? JSON.parse(report.ai_suggestions_json) : [];

  // Check for existing draft plan and update it instead of creating a new one
  const existingPlan = db.prepare("SELECT * FROM cleaning_plans WHERE file_id = ? AND status = 'draft'").get(fileId) as any;
  if (existingPlan) {
    const existingData = JSON.parse(existingPlan.plan_json);
    if (existingData.actions && existingData.actions.length > 0) {
      res.json({ id: existingPlan.id, fileId, plan: existingData, status: 'draft' });
      return;
    }
  }

  const actions: any[] = [
    {
      actionType: 'trim_whitespace',
      name: '去除所有文本列前后空格',
      affectedColumns: [],
      params: {},
      estimatedImpactRows: 0,
      confidence: 0.95,
      enabled: true,
    },
  ];

  for (const insight of aiSuggestions) {
    for (const sug of insight.suggestions || []) {
      actions.push({
        actionType: sug.action,
        name: `${insight.columnName}: ${sug.reason}`,
        affectedColumns: [insight.columnName],
        params: sug.params,
        estimatedImpactRows: Math.round((diagnosis.columns?.[insight.columnName]?.nullRate || 0) * (file.row_count || 1000)),
        confidence: sug.confidence,
        enabled: true,
      });
    }
  }

  const planId = uuid();
  const planJson = JSON.stringify({ actions });
  db.prepare(`
    INSERT INTO cleaning_plans (id, file_id, plan_json, status)
    VALUES (?, ?, ?, 'draft')
  `).run(planId, fileId, planJson);

  res.json({ id: planId, fileId, plan: { actions }, status: 'draft' });
}

export function updatePlan(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM cleaning_plans WHERE file_id = ?').get(fileId) as any;

  if (!existing) {
    res.status(404).json({ error: '清洗方案不存在' });
    return;
  }

  const planJson = JSON.stringify({ actions: req.body.actions });
  db.prepare('UPDATE cleaning_plans SET plan_json = ?, status = ? WHERE id = ?')
    .run(planJson, 'confirmed', existing.id);

  res.json({ success: true });
}

export async function executeClean(req: Request, res: Response): Promise<void> {
  const fileId = req.params.id as string;
  const file = getOwnedFileById(fileId, req.user!.id) as any;

  if (!file) {
    res.status(404).json({ error: '文件不存在' });
    return;
  }

  const db = getDb();
  const plan = db.prepare('SELECT * FROM cleaning_plans WHERE file_id = ?').get(fileId) as any;

  if (!plan) {
    res.status(400).json({ error: '请先生成清洗方案' });
    return;
  }

  res.json({ status: 'cleaning', fileId });

  try {
    // Check quota before proceeding
    const quotaCheck = checkQuota(req.user!.id, file.row_count || 0);
    if (!quotaCheck.ok) {
      throw new Error(quotaCheck.message);
    }

    updateFileStatus(fileId, 'cleaning');
    db.prepare('UPDATE cleaning_plans SET status = ? WHERE id = ?').run('running', plan.id);
    eventBus.emitWs(fileId, { type: 'progress', stage: 'clean', data: { progress: 0, message: '开始清洗...' } });

    const ext = path.extname(file.original_name).toLowerCase();
    const parsed = ext === '.csv' || ext === '.tsv'
      ? parseCsv(file.stored_path)
      : parseExcel(file.stored_path);

    const planData = JSON.parse(plan.plan_json);
    const executor = new CleaningExecutor(parsed.rows, parsed.headers);
    const { rows: cleanedRows, history } = executor.executeActions(planData.actions);

    eventBus.emitWs(fileId, { type: 'progress', stage: 'clean', data: { progress: 0.7, message: '生成结果文件...' } });

    // Save result
    const resultId = uuid();
    const resultDir = path.dirname(file.stored_path);
    const resultFileName = path.basename(file.original_name, path.extname(file.original_name)) + '_cleaned.xlsx';
    const resultPath = path.join(resultDir, `${resultId}_${resultFileName}`);

    exportToXlsx(parsed.headers, cleanedRows, resultPath);

    // Calculate stats
    const beforeDiag = runDiagnosis(parsed);
    const afterDiag = runDiagnosis({ headers: parsed.headers, rows: cleanedRows, sheetName: 'Cleaned' });

    const stats = {
      originalRowCount: parsed.rows.length,
      resultRowCount: cleanedRows.length,
      healthScoreBefore: beforeDiag.overallScore,
      healthScoreAfter: afterDiag.overallScore,
      operations: history,
    };

    db.prepare(`
      INSERT INTO cleaning_results (id, plan_id, file_id, result_file_path, stats_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(resultId, plan.id, fileId, resultPath, JSON.stringify(stats));

    db.prepare('UPDATE cleaning_plans SET status = ? WHERE id = ?').run('done', plan.id);
    updateFileStatus(fileId, 'completed');

    // Deduct quota
    try {
      deductQuota(req.user!.id, parsed.rows.length, fileId);
    } catch (quotaErr) {
      logger.warn({ err: quotaErr }, 'Quota deduction failed');
    }

    eventBus.emitWs(fileId, {
      type: 'complete',
      stage: 'clean',
      data: { progress: 1, message: '清洗完成', resultId },
    });
  } catch (err: any) {
    logger.error({ err }, 'Cleaning failed');
    updateFileStatus(fileId, 'diagnosed');
    db.prepare('UPDATE cleaning_plans SET status = ? WHERE id = ?').run('draft', plan.id);
    eventBus.emitWs(fileId, { type: 'error', stage: 'clean', data: { error: err.message } });
  }
}

export function previewResult(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const db = getDb();
  const result = db.prepare('SELECT * FROM cleaning_results WHERE file_id = ? ORDER BY created_at DESC LIMIT 1').get(fileId) as any;

  if (!result) {
    res.status(404).json({ error: '清洗结果不存在' });
    return;
  }

  const stats = JSON.parse(result.stats_json || '{}');
  const file = getOwnedFileById(fileId, req.user!.id) as any;
  const ext = path.extname(file.original_name).toLowerCase();
  const parsed = ext === '.csv' || ext === '.tsv'
    ? parseCsv(file.stored_path)
    : parseExcel(file.stored_path);

  // Parse result file
  const resultParsed = result.result_file_path
    ? parseExcel(result.result_file_path)
    : { headers: parsed.headers, rows: [] };

  res.json({
    originalHeaders: parsed.headers,
    originalRows: parsed.rows.slice(0, 50),
    resultHeaders: resultParsed.headers,
    resultRows: resultParsed.rows.slice(0, 50),
    stats,
  });
}

export function downloadResult(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const db = getDb();
  const result = db.prepare('SELECT * FROM cleaning_results WHERE file_id = ? ORDER BY created_at DESC LIMIT 1').get(fileId) as any;

  if (!result || !result.result_file_path) {
    res.status(404).json({ error: '结果文件不存在' });
    return;
  }

  const file = getOwnedFileById(fileId, req.user!.id) as any;
  const format = req.query.format as string || 'xlsx';

  if (format === 'csv') {
    // Generate CSV on the fly from the xlsx result
    const parsed = parseExcel(result.result_file_path);
    const csvPath = result.result_file_path.replace('.xlsx', '.csv');
    exportToCsv(parsed.headers, parsed.rows, csvPath);
    res.download(csvPath, file.original_name.replace(/\.\w+$/, '_cleaned.csv'));
  } else {
    res.download(result.result_file_path, file.original_name.replace(/\.\w+$/, '_cleaned.xlsx'));
  }
}

export function downloadReport(req: Request, res: Response): void {
  const fileId = req.params.id as string;
  const db = getDb();
  const result = db.prepare('SELECT * FROM cleaning_results WHERE file_id = ? ORDER BY created_at DESC LIMIT 1').get(fileId) as any;

  if (!result) {
    res.status(404).json({ error: '清洗结果不存在' });
    return;
  }

  const stats = JSON.parse(result.stats_json || '{}');
  const file = getOwnedFileById(fileId, req.user!.id) as any;

  // pdfkit sync wrapper
  const pdfPath = result.result_file_path?.replace('.xlsx', '_report.pdf') || '/tmp/report.pdf';

  exportToPdf({
    originalFileName: file.original_name,
    originalRowCount: stats.originalRowCount || 0,
    resultRowCount: stats.resultRowCount || 0,
    healthScoreBefore: stats.healthScoreBefore || 0,
    healthScoreAfter: stats.healthScoreAfter || 0,
    operations: stats.operations || [],
    generatedAt: new Date().toISOString(),
  }, pdfPath).then(() => {
    res.download(pdfPath, file.original_name.replace(/\.\w+$/, '_报告.pdf'));
  });
}