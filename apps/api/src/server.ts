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

// ─── CORS origin validation ───────────────────────────────────────────────────
// In production PORTAL_URL must be set and must use https://.
// In local dev (NODE_ENV !== 'production') we fall back to localhost.
const isProduction = process.env.NODE_ENV === 'production';
const portalUrl = process.env.PORTAL_URL;

if (isProduction && !portalUrl) {
  console.error('[Server] FATAL: PORTAL_URL env var is not set in production. Exiting.');
  process.exit(1);
}

if (isProduction && portalUrl && !portalUrl.startsWith('https://')) {
  console.error('[Server] FATAL: PORTAL_URL must use https:// in production. Exiting.');
  process.exit(1);
}

const corsOrigin = portalUrl || 'http://localhost:3000';

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());

// Trust the first proxy hop (AWS ALB/ELB) so req.ip reflects the real client IP
// rather than the load balancer address. Needed for per-user rate limiting.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: corsOrigin,
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
// Intentionally minimal — no timestamp or version info to limit recon surface.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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
