import type { Request, Response } from 'express';
import { getDb } from '../lib/db.js';
import { v4 as uuid } from 'uuid';

export function getUsage(req: Request, res: Response): void {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  res.json({
    planType: user.plan_type,
    monthlyQuota: user.monthly_quota,
    usedQuota: user.used_quota,
  });
}

export function getRecords(req: Request, res: Response): void {
  const db = getDb();
  const records = db.prepare('SELECT * FROM billing_records WHERE user_id = ? ORDER BY deducted_at DESC LIMIT 50').all(req.user!.id);
  res.json(records);
}

export function checkQuota(userId: string, rowsNeeded: number): { ok: boolean; message?: string } {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return { ok: false, message: '用户不存在' };
  }
  // Enterprise plan has unlimited quota
  if (user.plan_type === 'enterprise') {
    return { ok: true };
  }
  const remaining = user.monthly_quota - user.used_quota;
  if (remaining < rowsNeeded) {
    return {
      ok: false,
      message: `配额不足。本月剩余 ${remaining.toLocaleString()} 行，需要 ${rowsNeeded.toLocaleString()} 行。请升级套餐。`,
    };
  }
  return { ok: true };
}

export function deductQuota(userId: string, rowsProcessed: number, fileId: string): void {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO billing_records (id, user_id, file_id, rows_processed)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, fileId, rowsProcessed);
  db.prepare('UPDATE users SET used_quota = used_quota + ? WHERE id = ?').run(rowsProcessed, userId);
}