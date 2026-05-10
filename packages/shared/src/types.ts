// ── Basic Data Types ──

export type CellValue = string | number | null | undefined;
export type Row = CellValue[];
export type HeaderRow = string[];

export interface ParsedData {
  headers: HeaderRow;
  rows: Row[];
  sheetName: string;
}

// ── File / Upload ──

export type FileStatus = 'uploaded' | 'diagnosing' | 'diagnosed' | 'planning' | 'cleaning' | 'completed' | 'expired';

export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  storedPath: string;
  fileSize: number;
  rowCount: number | null;
  colCount: number | null;
  encoding: string | null;
  status: FileStatus;
  uploadedAt: string;
  expiresAt: string;
}

// ── Diagnosis ──

export type InferredType =
  | 'null'
  | 'phone'
  | 'date'
  | 'id_card'
  | 'email'
  | 'url'
  | 'number'
  | 'amount'
  | 'text';

export type Severity = 'critical' | 'warning' | 'info';

export interface ColumnIssue {
  type: string;
  severity: Severity;
  detail: string;
}

export interface ColumnProfile {
  inferredType: InferredType;
  nullRate: number;
  uniqueCount: number;
  sampleValues: (string | number)[];
  formatConsistency?: number;
  issues: ColumnIssue[];
}

export interface DiagnosisReport {
  overallScore: number;
  columns: Record<string, ColumnProfile>;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
}

export interface DiagnosisRecord {
  id: string;
  fileId: string;
  reportJson: string;
  aiSuggestionsJson?: string;
  createdAt: string;
}

// ── Cleaning ──

export type CleaningActionType =
  | 'remove_duplicates'
  | 'fill_null'
  | 'format_date'
  | 'format_number'
  | 'trim_whitespace'
  | 'clean_phone'
  | 'split_column'
  | 'merge_columns'
  | 'remove_outliers';

export interface CleaningAction {
  actionType: CleaningActionType;
  name: string;
  affectedColumns: string[];
  params: Record<string, unknown>;
  estimatedImpactRows: number;
  confidence: number;
  enabled: boolean;
}

export interface CleaningPlan {
  actions: CleaningAction[];
}

export type PlanStatus = 'draft' | 'confirmed' | 'running' | 'done';

export interface CleaningPlanRecord {
  id: string;
  fileId: string;
  planJson: string;
  status: PlanStatus;
  createdAt: string;
  confirmedAt: string | null;
}

export interface OperationLog {
  actionType: string;
  affectedColumns: string[];
  affectedRows: number;
  beforeSnapshot: Row[];
  afterSnapshot: Row[];
}

export interface CleaningResultRecord {
  id: string;
  planId: string;
  fileId: string;
  resultFilePath: string | null;
  statsJson: string | null;
  createdAt: string;
}

export interface CleaningTemplateRecord {
  id: string;
  userId: string;
  name: string;
  templateJson: string;
  sourceColumns: string | null;
  createdAt: string;
}

// ── Billing ──

export type PlanType = 'free' | 'basic' | 'pro' | 'enterprise';

export interface UserRecord {
  id: string;
  phone: string;
  companyName: string | null;
  planType: PlanType;
  monthlyQuota: number;
  usedQuota: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRecord {
  id: string;
  userId: string;
  fileId: string | null;
  rowsProcessed: number;
  deductedAt: string;
}

// ── WebSocket Events ──

export type WsStage = 'diagnose' | 'clean' | 'export';
export type WsEventType = 'progress' | 'complete' | 'error';

export interface WsEvent {
  sessionId: string;
  type: WsEventType;
  stage: WsStage;
  data: {
    progress?: number;
    message?: string;
    resultId?: string;
    error?: string;
  };
}

// ── Auth ──

export interface LoginRequest {
  phone: string;
  code: string;
}

export interface LoginResponse {
  token: string;
  user: UserRecord;
}

// ── AI Suggestions ──

export interface AiSuggestion {
  columnName: string;
  semanticType: string;
  description: string;
  suggestions: {
    action: CleaningActionType;
    params: Record<string, unknown>;
    reason: string;
    confidence: number;
  }[];
}

// ── Task Status ──

export interface TaskStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
}