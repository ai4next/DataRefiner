import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as filesController from '../controllers/files.controller.js';

export const filesRouter = Router();

filesRouter.use(authMiddleware);
filesRouter.post('/upload', filesController.uploadFile);
filesRouter.get('/', filesController.listFiles);
filesRouter.get('/:id', filesController.getFile);
filesRouter.get('/:id/preview', filesController.previewFile);
filesRouter.delete('/:id', filesController.removeFile);