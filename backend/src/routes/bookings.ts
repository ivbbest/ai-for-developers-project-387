import { Router } from 'express';
import { HttpError } from '../errors.js';
import type { Db } from '../db/connection.js';
import { getEventType } from '../repositories/eventTypes.js';
import { createBookingIfFree, listUpcoming, toIsoUtc } from '../repositories/bookings.js';
import { validateBookingStart } from '../services/slots.js';
import { now, type NowFn } from '../services/now.js';
import { bookingCreateSchema } from '../validation.js';

export function bookingsRouter(db: Db, nowFn: NowFn = now): Router {
  const router = Router();

  // GET /api/bookings (3.4, E16): только start >= now, сортировка по start;
  // пагинации нет — объём окна мал (зафиксированное ограничение дизайна)
  router.get('/', (_req, res) => {
    res.json(listUpcoming(db, toIsoUtc(nowFn().toISOString())));
  });

  // POST /api/bookings (3.3). Порядок по спеке: shape/E8 (zod .strict) →
  // тип 404 (E6) → сетка/окно/прошлое (E3/E5/E7) → транзакция+409 (E1/E2/E15).
  router.post('/', (req, res) => {
    const body = bookingCreateSchema.parse(req.body);
    const type = getEventType(db, body.eventTypeId);
    if (!type) {
      throw new HttpError(404, 'not_found', `Тип события не найден: ${body.eventTypeId}`);
    }
    validateBookingStart(type, body.start, nowFn);
    const start = toIsoUtc(body.start);
    const end = new Date(Date.parse(start) + type.durationMinutes * 60_000).toISOString();
    const result = createBookingIfFree(
      db,
      {
        eventTypeId: type.id,
        start,
        end,
        name: body.name,
        email: body.email,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      nowFn,
    );
    if (!result.ok) {
      throw new HttpError(409, 'slot_conflict', 'Слот уже занят (пересечение интервалов)');
    }
    res.status(201).json(result.booking);
  });

  return router;
}
