import type { Row, HeaderRow, CleaningAction, OperationLog } from '@datarefiner/shared';
import { logger } from '../lib/logger.js';

// ── Individual Cleaning Actions ──

function executeRemoveDuplicates(rows: Row[], _headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const beforeCount = rows.length;
  const columnIndices = (params.columnIndices as number[]) || [];
  const seen = new Set<string>();
  const result: Row[] = [];

  for (const row of rows) {
    let key: string;
    if (columnIndices.length > 0) {
      key = columnIndices.map(i => String(row[i] ?? '')).join('|');
    } else {
      key = row.map(v => String(v ?? '')).join('|');
    }
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }

  return {
    rows: result,
    log: {
      actionType: 'remove_duplicates',
      affectedColumns: params.columnIndices as string[] || [],
      affectedRows: beforeCount - result.length,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeFillNull(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const fillValue = (params.fillValue as string) || '';
  const colName = params.column as string;
  const colIndex = headers.indexOf(colName);
  let affectedRows = 0;

  const result = rows.map(row => {
    if (colIndex >= 0 && (row[colIndex] === null || row[colIndex] === undefined || row[colIndex] === '')) {
      affectedRows++;
      const newRow = [...row];
      newRow[colIndex] = fillValue;
      return newRow;
    }
    return row;
  });

  return {
    rows: result,
    log: {
      actionType: 'fill_null',
      affectedColumns: [colName],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeFormatDate(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const colName = params.column as string;
  const colIndex = headers.indexOf(colName);
  const targetFormat = (params.targetFormat as string) || 'iso';
  let affectedRows = 0;

  const result = rows.map(row => {
    if (colIndex < 0) return row;
    const val = row[colIndex];
    if (val === null || val === undefined || val === '') return row;

    const s = String(val).trim();
    let formatted: string | null = null;

    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
      // Already ISO-like, normalize
      const [y, m, d] = s.split(/[-/]/);
      formatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) {
      const [y, m, d] = s.split('/');
      formatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    } else if (/^\d{4}年\d{1,2}月\d{1,2}日/.test(s)) {
      const match = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (match) {
        formatted = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      }
    } else if (/^\d{8}$/.test(s)) {
      formatted = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }

    if (formatted && formatted !== s) {
      affectedRows++;
      const newRow = [...row];
      newRow[colIndex] = formatted;
      return newRow;
    }
    return row;
  });

  return {
    rows: result,
    log: {
      actionType: 'format_date',
      affectedColumns: [colName],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeFormatNumber(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const colName = params.column as string;
  const colIndex = headers.indexOf(colName);
  const pattern = (params.pattern as string) || '[¥$￥€元, ]';
  let affectedRows = 0;

  const result = rows.map(row => {
    if (colIndex < 0) return row;
    const val = row[colIndex];
    if (val === null || val === undefined || val === '') return row;

    const cleaned = String(val).replace(new RegExp(pattern, 'g'), '');
    if (cleaned !== String(val)) {
      affectedRows++;
      const newRow = [...row];
      newRow[colIndex] = isNaN(Number(cleaned)) ? cleaned : Number(cleaned);
      return newRow;
    }
    return row;
  });

  return {
    rows: result,
    log: {
      actionType: 'format_number',
      affectedColumns: [colName],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeTrimWhitespace(rows: Row[], _headers: HeaderRow, _params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  let affectedRows = 0;
  const result = rows.map(row => {
    const newRow = row.map(v => {
      if (typeof v === 'string' && v !== v.trim()) {
        affectedRows++;
        return v.trim();
      }
      return v;
    });
    return newRow;
  });

  return {
    rows: result,
    log: {
      actionType: 'trim_whitespace',
      affectedColumns: [],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeCleanPhone(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const colName = params.column as string;
  const colIndex = headers.indexOf(colName);
  let affectedRows = 0;

  const result = rows.map(row => {
    if (colIndex < 0) return row;
    const val = row[colIndex];
    if (val === null || val === undefined || val === '') return row;

    const cleaned = String(val).replace(/[\s-]/g, '');
    if (cleaned !== String(val) && /^1[3-9]\d{9}$/.test(cleaned)) {
      affectedRows++;
      const newRow = [...row];
      newRow[colIndex] = cleaned;
      return newRow;
    }
    return row;
  });

  return {
    rows: result,
    log: {
      actionType: 'clean_phone',
      affectedColumns: [colName],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeSplitColumn(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const colName = params.column as string;
  const colIndex = headers.indexOf(colName);
  const separator = (params.separator as string) || ',';
  const newColNames = (params.newColumnNames as string[]) || [];
  let affectedRows = 0;

  if (colIndex < 0) return { rows, log: { actionType: 'split_column', affectedColumns: [], affectedRows: 0, beforeSnapshot: [], afterSnapshot: [] } };

  const newHeaders = [...headers];
  const insertAfter = colIndex + 1;
  for (let i = newColNames.length - 1; i >= 0; i--) {
    newHeaders.splice(insertAfter, 0, newColNames[i]);
  }

  const result = rows.map(row => {
    const val = String(row[colIndex] ?? '');
    const parts = val.split(separator);
    if (parts.length > 1) affectedRows++;

    const newRow = [...row];
    for (let i = parts.length - 1; i >= 0; i--) {
      newRow.splice(insertAfter, 0, parts[i] || null);
    }
    // Pad if fewer parts than expected
    while (newRow.length < newHeaders.length) {
      newRow.splice(insertAfter, 0, null);
    }
    return newRow;
  });

  return {
    rows: result,
    log: {
      actionType: 'split_column',
      affectedColumns: [colName, ...newColNames],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeMergeColumns(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const colNames = params.columns as string[] || [];
  const separator = (params.separator as string) || ' ';
  const newColName = (params.newColumnName as string) || 'merged';
  let affectedRows = 0;

  const colIndices = colNames.map(name => headers.indexOf(name)).filter(i => i >= 0);
  if (colIndices.length < 2) return { rows, log: { actionType: 'merge_columns', affectedColumns: [], affectedRows: 0, beforeSnapshot: [], afterSnapshot: [] } };

  const result = rows.map(row => {
    const values = colIndices.map(i => String(row[i] ?? '')).filter(v => v);
    if (values.length > 0) affectedRows++;
    const merged = values.join(separator);

    const newRow = [...row];
    // Remove merged columns from the end first
    const sortedIndices = [...colIndices].sort((a, b) => b - a);
    for (const i of sortedIndices) {
      newRow.splice(i, 1);
    }
    // Insert merged value at the position of the first column
    newRow.splice(Math.min(...colIndices), 0, merged);
    return newRow;
  });

  // Update headers
  const newHeaders = [...headers];
  const sortedIndices = [...colIndices].sort((a, b) => b - a);
  for (const i of sortedIndices) {
    newHeaders.splice(i, 1);
  }
  newHeaders.splice(Math.min(...colIndices), 0, newColName);

  // For logging we use the original headers reference
  return {
    rows: result,
    log: {
      actionType: 'merge_columns',
      affectedColumns: colNames,
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

function executeRemoveOutliers(rows: Row[], headers: HeaderRow, params: Record<string, unknown>): { rows: Row[]; log: OperationLog } {
  const colName = params.column as string;
  const colIndex = headers.indexOf(colName);
  const iqrMultiplier = (params.iqrMultiplier as number) || 1.5;
  let affectedRows = 0;

  if (colIndex < 0) return { rows, log: { actionType: 'remove_outliers', affectedColumns: [], affectedRows: 0, beforeSnapshot: [], afterSnapshot: [] } };

  // Extract numeric values
  const values = rows.map(row => {
    const v = row[colIndex];
    if (v === null || v === undefined || v === '') return NaN;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[¥$￥€元,]/g, ''));
    return isNaN(n) ? NaN : n;
  });

  const numericValues = values.filter(v => !isNaN(v)) as number[];
  if (numericValues.length === 0) {
    return { rows, log: { actionType: 'remove_outliers', affectedColumns: [colName], affectedRows: 0, beforeSnapshot: [], afterSnapshot: [] } };
  }

  // Calculate Q1, Q3, IQR
  const sorted = [...numericValues].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - iqrMultiplier * iqr;
  const upper = q3 + iqrMultiplier * iqr;

  // Filter out rows where the value is an outlier
  const result: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = values[i];
    if (isNaN(v) || (v >= lower && v <= upper)) {
      result.push(rows[i]);
    } else {
      affectedRows++;
    }
  }

  return {
    rows: result,
    log: {
      actionType: 'remove_outliers',
      affectedColumns: [colName],
      affectedRows,
      beforeSnapshot: rows.slice(0, 5),
      afterSnapshot: result.slice(0, 5),
    },
  };
}

// ── Action Registry ──

type ActionExecutor = (rows: Row[], headers: HeaderRow, params: Record<string, unknown>) => { rows: Row[]; log: OperationLog };

const actionRegistry: Record<string, ActionExecutor> = {
  remove_duplicates: executeRemoveDuplicates,
  fill_null: executeFillNull,
  format_date: executeFormatDate,
  format_number: executeFormatNumber,
  trim_whitespace: executeTrimWhitespace,
  clean_phone: executeCleanPhone,
  split_column: executeSplitColumn,
  merge_columns: executeMergeColumns,
  remove_outliers: executeRemoveOutliers,
};

// ── Executor ──

export class CleaningExecutor {
  private currentRows: Row[];

  constructor(
    private originalRows: Row[],
    private headers: HeaderRow,
  ) {
    this.currentRows = originalRows.map(r => [...r]);
  }

  executeActions(actions: CleaningAction[]): { rows: Row[]; history: OperationLog[] } {
    const history: OperationLog[] = [];

    for (const action of actions) {
      if (!action.enabled) continue;

      const executor = actionRegistry[action.actionType];
      if (!executor) {
        logger.warn({ actionType: action.actionType }, 'Unknown cleaning action');
        continue;
      }

      const result = executor(this.currentRows, this.headers, action.params);
      this.currentRows = result.rows;
      history.push(result.log);
      logger.info({ actionType: action.actionType, affectedRows: result.log.affectedRows }, 'Action executed');
    }

    return { rows: this.currentRows, history };
  }

  rollback(): Row[] {
    this.currentRows = this.originalRows.map(r => [...r]);
    return this.currentRows;
  }

  getCurrentRows(): Row[] {
    return this.currentRows;
  }
}