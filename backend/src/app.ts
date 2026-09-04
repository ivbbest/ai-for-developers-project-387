import express, { type Express } from 'express';
import type { Db } from './db/connection.js';
import { apiErrorHandler } from './middleware/errors.js';
import { HttpError } from './errors.js';
import { eventTypesRouter } from './routes/eventTypes.js';
import { bookingsRouter } from './routes/bookings.js';
import { mountStatic } from './static.js';
import { now, type NowFn } from './services/now.js';

export interface AppOptions {
  nowFn?: NowFn;
  // каталог сборки фронта (frontend/dist); undefined/false — API-only (dev)
  staticDir?: string | false;
}

export function createApp(db: Db, opts: AppOptions = {}): Express {
  const nowFn = opts.nowFn ?? now;
  const app = express();
  // гигиена публичного прода: не выдавать фреймворк в заголовке
  app.disable('x-powered-by');
  // E18: «413 на любом POST» — limit у express.json работает только для
  // application/json, остальные content-type тело не парсят вовсе; гейтим
  // по Content-Length до роутеров (HttpError даёт JSON, а не html-413).
  // Известное ограничение: chunked без Content-Length не гейтится (заголовок
  // отсутствует → NaN > limit === false); не-JSON тело Express не буферизует
  // вовсе, поэтому риск только в коде ответа (400 вместо 413), не в памяти.
  const BODY_LIMIT_BYTES = 64 * 1024;
  app.use((req, _res, next) => {
    if (req.method === 'POST' && Number(req.headers['content-length']) > BODY_LIMIT_BYTES) {
      return next(new HttpError(413, 'payload_too_large', 'Тело запроса слишком большое'));
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.use('/api/event-types', eventTypesRouter(db, nowFn));
  app.use('/api/bookings', bookingsRouter(db, nowFn));
  // E19: неизвестный /api/* → 404 Error (не html, не провал в SPA-fallback).
  // Ставится после всех api-маршрутов.
  app.use('/api', (_req, _res, next) =>
    next(new HttpError(404, 'not_found', 'Маршрут не найден')),
  );
  // статика — после API-маршрутов; GET /api/… сюда не доходит
  if (opts.staticDir) mountStatic(app, opts.staticDir);
  // единый JSON-хендлер ошибок — последним (C7, E18–E19)
  app.use(apiErrorHandler);
  return app;
}
