import { logger, logFailure } from './lib/logger.js';
import { ZodError } from 'zod';
import { validationMessage } from '../shared/schemas.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_DIST, ROOT } from './config.js';
import { apiRouter } from './routes/api.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  // Security headers — defense-in-depth for single-user local mode
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Allow the Firebase popup helper and authentication endpoints alongside configured integrations.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.youtube.com; connect-src 'self' https://openrouter.ai https://integrate.api.nvidia.com http://127.0.0.1:11434 https://api.telegram.org https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src https://body-os-1b033.firebaseapp.com; font-src 'self'",
    );
    next();
  });

  app.use('/api', (req, res, next) => {
    const started = Date.now();
    res.on('finish', () => logger.info({ event: 'api.request', method: req.method, status: res.statusCode, durationMs: Date.now() - started }, 'Request completed'));
    next();
  }, apiRouter);

  const distIndex = path.join(CLIENT_DIST, 'index.html');


  if (fs.existsSync(distIndex)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(distIndex);
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('html').send(`<!doctype html><html><body style="font-family:system-ui;padding:2rem">
        <h1>Body OS 2.0</h1>
        <p>API is running. Build the client with <code>npm run build</code> or use <code>npm run dev</code>.</p>
        <p>Health: <a href="/api/health">/api/health</a></p>
      </body></html>`);
    });
  }

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logFailure('api.failure', error);
    if (error instanceof ZodError) { res.status(400).json({ error: validationMessage(error) }); return; }
    // Never leak secrets in error messages
    const message = error.message || 'Server error';
    const safe = /password|api.?key|secret|token/i.test(message) ? 'Request failed' : message;
    res.status(500).json({ error: safe });
  });

  return app;
}
