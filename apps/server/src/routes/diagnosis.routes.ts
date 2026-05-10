import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as diagnosisController from '../controllers/diagnosis.controller.js';

export const diagnosisRouter = Router();

diagnosisRouter.use(authMiddleware);
diagnosisRouter.post('/:id/diagnose', diagnosisController.diagnose);
diagnosisRouter.get('/:id/diagnosis', diagnosisController.getDiagnosis);