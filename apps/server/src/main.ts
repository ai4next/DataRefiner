import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initDb } from './lib/db.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authRouter } from './routes/auth.routes.js';
import { filesRouter } from './routes/files.routes.js';
import { diagnosisRouter } from './routes/diagnosis.routes.js';
import { cleaningRouter } from './routes/cleaning.routes.js';
import { templatesRouter } from './routes/templates.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { initWsServer } from './websocket/ws-server.js';
import cron from 'node-cron';
import { getDb } from './lib/db.js';

// Load .env file if it exists (Node 21.7+)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
    logger.info('Loaded .env file');
  } catch (err) {
    logger.warn({ err }, 'Failed to load .env file');
  }
}
const PORT = Number(process.env.PORT) || 4001;

// Initialize database
initDb();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// CORS
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
app.options('*', (_req, res) => res.sendStatus(200));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/files', filesRouter);
app.use('/api/files', diagnosisRouter);    // /api/files/:id/diagnose etc.
app.use('/api/files', cleaningRouter);     // /api/files/:id/plan etc.
app.use('/api/templates', templatesRouter);
app.use('/api/billing', billingRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const staticDir = path.join(__dirname, '../../web/dist');
  app.use(express.static(staticDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use(errorHandler);

// 404 handler for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

const httpServer = createServer(app);

// Initialize WebSocket
initWsServer(httpServer);

// Schedule cleanup (daily at 2am)
cron.schedule('0 2 * * *', () => {
  logger.info('Running expired file cleanup');
  const db = getDb();
  const expired = db.prepare(
    `UPDATE files SET status = 'expired' WHERE expires_at < datetime('now') AND status != 'expired'`
  ).run();
  logger.info({ deletedCount: expired.changes }, 'Expired files cleaned up');
});

httpServer.listen(PORT, () => {
  logger.info(`DataRefiner server running on http://localhost:${PORT}/api`);
});