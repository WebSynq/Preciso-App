import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { errorHandler } from './middleware/error-handler';
import custodyRouter from './routes/custody';
import ordersRouter from './routes/orders';
import webhooksRouter from './routes/webhooks';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.PORTAL_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));

// Global rate limit: 100 req/min per IP on all public endpoints
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
  }),
);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/custody', custodyRouter);

// ─── Webhook routes (external system callbacks) ─────────────────────────────
app.use('/webhooks', webhooksRouter);

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.warn(`PRECISO API running on port ${PORT}`);
});

export default app;
