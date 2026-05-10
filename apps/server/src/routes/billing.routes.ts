import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as billingController from '../controllers/billing.controller.js';

export const billingRouter = Router();

billingRouter.use(authMiddleware);
billingRouter.get('/usage', billingController.getUsage);
billingRouter.get('/records', billingController.getRecords);