import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate, updatePlanSchema } from '../middleware/validate.js';
import * as cleaningController from '../controllers/cleaning.controller.js';

export const cleaningRouter = Router();

cleaningRouter.use(authMiddleware);
cleaningRouter.get('/:id/plan', cleaningController.getPlan);
cleaningRouter.post('/:id/plan/generate', cleaningController.generatePlan);
cleaningRouter.put('/:id/plan', validate(updatePlanSchema), cleaningController.updatePlan);
cleaningRouter.post('/:id/clean', cleaningController.executeClean);
cleaningRouter.get('/:id/result/preview', cleaningController.previewResult);
cleaningRouter.get('/:id/result/download', cleaningController.downloadResult);
cleaningRouter.get('/:id/result/report', cleaningController.downloadReport);