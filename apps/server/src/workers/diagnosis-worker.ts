import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export function runDiagnosisWorker(fileId: string): void {
  // Diagnosis is run inline in the controller for simplicity
  // In production, this would be a queue job
  logger.info({ fileId }, 'Diagnosis worker started');
}

export function runCleaningWorker(fileId: string): void {
  // Cleaning is run inline in the controller for simplicity
  logger.info({ fileId }, 'Cleaning worker started');
}