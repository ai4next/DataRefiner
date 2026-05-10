import { Router } from 'express';
import { validate, loginSchema } from '../middleware/validate.js';
import { optionalAuth, authMiddleware } from '../middleware/auth.js';
import * as authController from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.get('/me', optionalAuth, authController.getMe);