import type { Request, Response } from 'express';
import { getDb } from '../lib/db.js';
import { signToken } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

export function login(req: Request, res: Response): void {
  const { phone } = req.body;
  const db = getDb();

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as any;

  if (!user) {
    // Auto-register for MVP
    const id = uuid();
    db.prepare(`
      INSERT INTO users (id, phone, plan_type, monthly_quota)
      VALUES (?, ?, 'free', 1000)
    `).run(id, phone);
    user = { id, phone, plan_type: 'free', monthly_quota: 1000, used_quota: 0 };
  }

  const token = signToken({ id: user.id, phone: user.phone });

  res.json({
    token,
    user: {
      id: user.id,
      phone: user.phone,
      companyName: user.company_name,
      planType: user.plan_type,
      monthlyQuota: user.monthly_quota,
      usedQuota: user.used_quota,
    },
  });
}

export function getMe(req: Request, res: Response): void {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    phone: user.phone,
    companyName: user.company_name,
    planType: user.plan_type,
    monthlyQuota: user.monthly_quota,
    usedQuota: user.used_quota,
  });
}