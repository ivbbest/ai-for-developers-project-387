import { Router } from 'express';
import { HttpError } from '../errors.js';
import type { Db } from '../db/connection.js';
import { getEventType, insertEventType, listEventTypes } from '../repositories/eventTypes.js';
import { buildSlots } from '../services/slots.js';
import { eventTypeCreateSchema } from '../validation.js';
import { now, type NowFn } from '../services/now.js';

export function eventTypesRouter(db: Db, nowFn: NowFn = now): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(listEventTypes(db));
  });

  // Сетка слотов дня. Порядок проверок по E6: тип (404) раньше валидации
  // даты; формат/окно/сетка — в сервисе (ValidationError/OutOfWindowError)
  router.get('/:id/slots', (req, res) => {
    const type = getEventType(db, req.params.id);
    if (!type) {
      throw new HttpError(404, 'not_found', `Тип события не найден: ${req.params.id}`);
    }
    const date = req.query.date;
    if (typeof date !== 'string' || date === '') {
      throw new HttpError(400, 'validation', 'date обязателен: ?date=YYYY-MM-DD');
    }
    res.json(buildSlots(db, type, date, nowFn));
  });

  // POST /api/event-types (3.4): id задаёт владелец (C5), занятый id — 409 (E13).
  // ON CONFLICT(id) DO NOTHING + changes==0 — детект дубля без гонки: проверка
  // и вставка одним оператором.
  router.post('/', (req, res) => {
    const body = eventTypeCreateSchema.parse(req.body);
    const changes = insertEventType(db, {
      id: body.id,
      title: body.title,
      ...(body.description !== undefined ? { description: body.description } : {}),
      durationMinutes: body.durationMinutes,
    });
    if (changes === 0) {
      throw new HttpError(409, 'duplicate_id', `id уже занят: ${body.id}`);
    }
    res.status(201).json(getEventType(db, body.id));
  });

  return router;
}
