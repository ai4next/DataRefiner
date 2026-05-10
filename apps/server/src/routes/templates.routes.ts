import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { getDb } from '../lib/db.js';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';

export const templatesRouter = Router();

templatesRouter.use(authMiddleware);

templatesRouter.get('/', (req, res) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM cleaning_templates WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.id);
  res.json(templates);
});

templatesRouter.post('/', (req, res) => {
  const { name, templateJson, sourceColumns } = req.body;
  if (!name || !templateJson) {
    res.status(400).json({ error: '名称和模板内容不能为空' });
    return;
  }
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO cleaning_templates (id, user_id, name, template_json, source_columns)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user!.id, name, templateJson, sourceColumns || null);
  res.json({ id });
});

templatesRouter.delete('/:id', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM cleaning_templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!template) {
    res.status(404).json({ error: '模板不存在' });
    return;
  }
  db.prepare('DELETE FROM cleaning_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});