import type { Row, HeaderRow, ColumnProfile, InferredType, DiagnosisReport, ColumnIssue } from '@datarefiner/shared';
import { logger } from '../lib/logger.js';

export interface ParsedData {
  headers: HeaderRow;
  rows: Row[];
  sheetName: string;
}

// ── Type Inference ──

function inferType(values: (string | number | null | undefined)[]): InferredType {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '') as (string | number)[];

  if (nonNull.length === 0) return 'null';

  // Check if mostly numbers
  const numberLike = nonNull.filter(v => {
    const s = String(v).trim();
    return /^[+-]?\d+(\.\d+)?$/.test(s);
  }).length;

  const phoneLike = nonNull.filter(v => {
    const s = String(v).replace(/[\s-]/g, '');
    return /^1[3-9]\d{9}$/.test(s);
  }).length;

  const dateLike = nonNull.filter(v => {
    const s = String(v).trim();
    return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) ||
           /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(s) ||
           /^\d{4}年\d{1,2}月\d{1,2}日/.test(s) ||
           /^\d{8}$/.test(s);
  }).length;

  const idCardLike = nonNull.filter(v => /^\d{17}[\dXx]$/.test(String(v).trim())).length;

  const emailLike = nonNull.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim())).length;

  const urlLike = nonNull.filter(v => /^https?:\/\/\S+/.test(String(v).trim())).length;

  const amountLike = nonNull.filter(v => /^[¥$￥€]/.test(String(v).trim()) || /[元$]$/.test(String(v).trim())).length;

  const ratio = (count: number) => count / nonNull.length;

  if (ratio(phoneLike) > 0.5) return 'phone';
  if (ratio(dateLike) > 0.5) return 'date';
  if (ratio(idCardLike) > 0.5) return 'id_card';
  if (ratio(emailLike) > 0.5) return 'email';
  if (ratio(urlLike) > 0.5) return 'url';
  if (ratio(numberLike) > 0.8) return 'number';
  if (ratio(amountLike) > 0.5) return 'amount';

  return 'text';
}

function detectIssues(values: (string | number | null | undefined)[], inferredType: InferredType): ColumnIssue[] {
  const issues: ColumnIssue[] = [];
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '') as (string | number)[];

  // Format consistency for date/phone
  if (inferredType === 'date') {
    const formats = new Set(nonNull.map(v => {
      const s = String(v).trim();
      if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return 'iso';
      if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) return 'slash';
      if (/^\d{4}年/.test(s)) return 'cn';
      if (/^\d{8}$/.test(s)) return 'compact';
      return 'other';
    }));
    if (formats.size > 1) {
      issues.push({ type: 'inconsistent_format', severity: 'warning', detail: `${formats.size}种日期格式混合` });
    }
  }

  if (inferredType === 'phone') {
    const hasSep = nonNull.some(v => /[\s-]/.test(String(v)));
    if (hasSep) {
      issues.push({ type: 'inconsistent_format', severity: 'warning', detail: '手机号含空格或横杠分隔符' });
    }
  }

  if (inferredType === 'amount') {
    const hasSymbol = nonNull.some(v => /[¥$￥€元]/.test(String(v)));
    if (hasSymbol) {
      issues.push({ type: 'contains_symbol', severity: 'warning', detail: '金额列包含货币符号或单位文字' });
    }
  }

  // Outlier detection for numbers
  if (inferredType === 'number' || inferredType === 'amount') {
    const nums = nonNull
      .map(v => parseFloat(String(v).replace(/[¥$￥€元,]/g, '')))
      .filter(n => !isNaN(n));
    if (nums.length > 0) {
      nums.sort((a, b) => a - b);
      const q1 = nums[Math.floor(nums.length * 0.25)];
      const q3 = nums[Math.floor(nums.length * 0.75)];
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      const outliers = nums.filter(n => n < lower || n > upper).length;
      if (outliers > 0) {
        issues.push({ type: 'outliers', severity: 'info', detail: `检测到${outliers}个异常值` });
      }
    }
  }

  return issues;
}

// ── Main Profile Function ──

export function profileColumns(data: ParsedData): Record<string, ColumnProfile> {
  const { headers, rows } = data;
  const columnCount = headers.length;
  const profiles: Record<string, ColumnProfile> = {};

  for (let colIdx = 0; colIdx < columnCount; colIdx++) {
    const colValues = rows.map(r => r[colIdx]);
    const nonNullValues = colValues.filter(v => v !== null && v !== undefined && v !== '') as (string | number)[];
    const nullCount = colValues.length - nonNullValues.length;
    const inferredType = inferType(colValues);
    const uniqueValues = new Set(nonNullValues.map(v => String(v).trim()));

    const sampleValues = nonNullValues.slice(0, 10);

    const issues = detectIssues(colValues, inferredType);

    // Format consistency for dates
    let formatConsistency: number | undefined;
    if (inferredType === 'date' && nonNullValues.length > 0) {
      const mostCommonFormat = getMostCommonFormat(nonNullValues);
      const consistent = nonNullValues.filter(v => matchesFormat(v, mostCommonFormat)).length;
      formatConsistency = consistent / nonNullValues.length;
    }

    profiles[headers[colIdx]] = {
      inferredType,
      nullRate: colValues.length > 0 ? nullCount / colValues.length : 0,
      uniqueCount: uniqueValues.size,
      sampleValues,
      formatConsistency,
      issues,
    };
  }

  return profiles;
}

/**
 * Detect fully duplicate rows in the dataset.
 */
export function detectDuplicateRows(rows: Row[]): { duplicateCount: number; duplicateIndices: Set<number> } {
  const seen = new Set<string>();
  const duplicateIndices = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    const key = rows[i].map(v => String(v ?? '')).join('|');
    if (seen.has(key)) {
      duplicateIndices.add(i);
    } else {
      seen.add(key);
    }
  }

  return { duplicateCount: duplicateIndices.size, duplicateIndices };
}

function getMostCommonFormat(values: (string | number)[]): string {
  const counts: Record<string, number> = {};
  for (const v of values) {
    const s = String(v).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) counts['iso'] = (counts['iso'] || 0) + 1;
    else if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) counts['slash'] = (counts['slash'] || 0) + 1;
    else if (/^\d{4}年/.test(s)) counts['cn'] = (counts['cn'] || 0) + 1;
    else if (/^\d{8}$/.test(s)) counts['compact'] = (counts['compact'] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'iso';
}

function matchesFormat(value: string | number, format: string): boolean {
  const s = String(value).trim();
  switch (format) {
    case 'iso': return /^\d{4}-\d{1,2}-\d{1,2}/.test(s);
    case 'slash': return /^\d{4}\/\d{1,2}\/\d{1,2}/.test(s);
    case 'cn': return /^\d{4}年/.test(s);
    case 'compact': return /^\d{8}$/.test(s);
    default: return true;
  }
}

// ── Health Score ──

export function calculateHealthScore(profiles: Record<string, ColumnProfile>, duplicateCount: number = 0): number {
  let score = 100;
  for (const col of Object.values(profiles)) {
    if (col.nullRate > 0.05) score -= 5;
    if (col.formatConsistency !== undefined && col.formatConsistency < 0.8) score -= 5;
    if (col.issues.some(i => i.type === 'outliers')) score -= 3;
  }
  // Duplicate rows penalty
  if (duplicateCount > 0) score -= 10;
  // Cap at 0
  return Math.max(0, score);
}

// ── Main Diagnosis ──

export interface DiagnosisResult {
  overallScore: number;
  columns: Record<string, ColumnProfile>;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  duplicateRows?: number;
}

export function runDiagnosis(data: ParsedData): DiagnosisResult {
  logger.info({ rows: data.rows.length, cols: data.headers.length }, 'Running diagnosis');
  const columns = profileColumns(data);

  // Detect duplicate rows
  const { duplicateCount } = detectDuplicateRows(data.rows);
  if (duplicateCount > 0) {
    logger.info({ duplicateCount }, 'Duplicate rows detected');
  }

  const overallScore = calculateHealthScore(columns, duplicateCount);

  let totalIssues = 0;
  let criticalIssues = 0;
  let warningIssues = 0;
  let infoIssues = 0;

  for (const col of Object.values(columns)) {
    for (const issue of col.issues) {
      totalIssues++;
      if (issue.severity === 'critical') criticalIssues++;
      else if (issue.severity === 'warning') warningIssues++;
      else infoIssues++;
    }
  }

  // Add duplicate rows as an info-level issue
  if (duplicateCount > 0) {
    totalIssues++;
    infoIssues++;
  }

  return {
    overallScore,
    columns,
    summary: { totalIssues, criticalIssues, warningIssues, infoIssues },
    duplicateRows: duplicateCount,
  };
}