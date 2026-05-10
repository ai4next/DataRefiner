import { getDb } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export function runCleaningWorker(fileId: string): void {
  logger.info({ fileId }, 'Cleaning worker started');
}