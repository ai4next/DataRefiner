import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}

export const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '无效的手机号'),
  code: z.string().length(6, '验证码为6位数字'),
});

export const generatePlanSchema = z.object({
  actionTypes: z.array(z.string()).optional(),
});

export const updatePlanSchema = z.object({
  actions: z.array(z.object({
    actionType: z.string(),
    name: z.string(),
    affectedColumns: z.array(z.string()),
    params: z.record(z.unknown()),
    estimatedImpactRows: z.number(),
    confidence: z.number().min(0).max(1),
    enabled: z.boolean(),
  })),
});

export const saveTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  templateJson: z.string(),
  sourceColumns: z.string().optional(),
});