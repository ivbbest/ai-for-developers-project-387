import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, migrate, type Db } from '../src/db/connection.js';
import { seed } from '../src/db/seed.js';
import { insertBooking } from '../src/repositories/bookings.js';
import { assertValidDate, buildSlots, isDateInWindow, OutOfWindowError, ValidationError } from '../src/services/slots.js';
import type { Booking } from '../src/types.js';

const MEET15 = { id: 'meet-15', title: '15', durationMinutes: 15 };
const MEET30 = { id: 'meet-30', title: '30', durationMinutes: 30 };

// 08:00 MSK — до начала рабочих часов, весь день 2026-09-10 доступен
const NOW_MORNING = () => new Date('2026-09-10T05:00:00Z');

function bk(start: string, end: string, eventTypeId = 'meet-15'): Booking {
  return {
    id: crypto.randomUUID(), eventTypeId, start, end,
    name: 'Т', email: 't@example.com', createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('сетка слотов (3.2)', () => {
  let db: Db;
  beforeEach(() => {
    db = openDb(':memory:');
    migrate(db);
    seed(db);
  });

  it('полный день 15-мин: 36 слотов 09:00–18:00 MSK, все available', () => {
    const slots = buildSlots(db, MEET15, '2026-09-10', NOW_MORNING);
    expect(slots).toHaveLength(36);
    expect(slots[0]).toEqual({ start: '2026-09-10T06:00:00.000Z', end: '2026-09-10T06:15:00.000Z', status: 'available' });
    expect(slots.at(-1)!.end).toBe('2026-09-10T15:00:00.000Z'); // 18:00 MSK
    expect(new Set(slots.map((s) => s.status))).toEqual(new Set(['available']));
  });

  it('полный день 30-мин: 18 слотов', () => {
    const slots = buildSlots(db, MEET30, '2026-09-10', NOW_MORNING);
    expect(slots).toHaveLength(18);
    expect(slots.at(-1)).toMatchObject({ start: '2026-09-10T14:30:00.000Z', end: '2026-09-10T15:00:00.000Z' });
  });

  it('длительность не делит день ровно: 50-мин — слотов столько, пока end <= 18:00', () => {
    const slots = buildSlots(db, { id: 'x', title: 'x', durationMinutes: 50 }, '2026-09-10', NOW_MORNING);
    expect(slots).toHaveLength(10); // 09:00..16:30 старты, последний 16:30–17:20
    expect(slots.at(-1)).toMatchObject({ start: '2026-09-10T13:30:00.000Z', end: '2026-09-10T14:20:00.000Z' });
  });

  it('прошедшие слоты текущего дня исключены; старт ровно в now — остаётся', () => {
    // 11:00 MSK = 08:00Z
    const slots = buildSlots(db, MEET15, '2026-09-10', () => new Date('2026-09-10T08:00:00Z'));
    expect(slots[0]!.start).toBe('2026-09-10T08:00:00.000Z');
    expect(slots).toHaveLength(28); // 11:00..17:45 старты
  });

  it('занятые — booked: 30-мин бронь помечает и 15-мин сетку (пересечение)', () => {
    insertBooking(db, bk('2026-09-10T06:00:00.000Z', '2026-09-10T06:30:00.000Z', 'meet-30'));
    const s15 = buildSlots(db, MEET15, '2026-09-10', NOW_MORNING);
    expect(s15.slice(0, 2).map((s) => s.status)).toEqual(['booked', 'booked']);
    expect(s15[2]!.status).toBe('available');
    const s30 = buildSlots(db, MEET30, '2026-09-10', NOW_MORNING);
    expect(s30[0]!.status).toBe('booked');
    expect(s30[1]!.status).toBe('available');
  });

  it('занятость — по календарю целиком: бронь meet-15 блокирует слот meet-30', () => {
    insertBooking(db, bk('2026-09-10T06:00:00.000Z', '2026-09-10T06:15:00.000Z', 'meet-15'));
    const s30 = buildSlots(db, MEET30, '2026-09-10', NOW_MORNING);
    expect(s30[0]!.status).toBe('booked');
  });

  it('бронь через границу рабочего дня: straddle 09:00 и стык 18:00', () => {
    // 08:30–09:30 MSK = 05:30–06:30Z — накладывается на слот 09:00–09:15
    insertBooking(db, bk('2026-09-10T05:30:00.000Z', '2026-09-10T06:30:00.000Z'));
    const s = buildSlots(db, MEET15, '2026-09-10', NOW_MORNING);
    expect(s[0]?.status).toBe('booked'); // 09:00–09:15
    expect(s[3]?.status).toBe('available'); // 09:45 — после 09:30
    // бронь 17:45–18:30 MSK (14:45–15:30Z) стредит конец дня: последний слот 17:45 занят
    const s2 = buildSlots(db, MEET15, '2026-09-10', () => new Date('2026-09-09T05:00:00Z'));
    insertBooking(db, bk('2026-09-10T14:45:00.000Z', '2026-09-10T15:30:00.000Z'));
    const s3 = buildSlots(db, MEET15, '2026-09-10', () => new Date('2026-09-09T05:00:00Z'));
    expect(s3.at(-1)?.status).toBe('booked');
    expect(s3.at(-2)?.status).toBe('available');
    expect(s2).toHaveLength(36);
  });

  it('окно: сегодня и сегодня+13 — валидны; вчера и +14 — вне', () => {
    expect(isDateInWindow('2026-09-10', NOW_MORNING)).toBe(true);
    expect(isDateInWindow('2026-09-23', NOW_MORNING)).toBe(true);
    expect(isDateInWindow('2026-09-09', NOW_MORNING)).toBe(false);
    expect(isDateInWindow('2026-09-24', NOW_MORNING)).toBe(false);
    expect(() => buildSlots(db, MEET15, '2026-09-24', NOW_MORNING)).toThrow(OutOfWindowError);
  });

  it('«сегодня» — по MSK: 22:00Z — уже следующие сутки для пояса', () => {
    // 2026-09-10T22:00Z = 2026-09-11 01:00 MSK → сегодня 11-е, день 10-е вне окна
    const late = () => new Date('2026-09-10T22:00:00Z');
    expect(() => buildSlots(db, MEET15, '2026-09-10', late)).toThrow(OutOfWindowError);
    expect(isDateInWindow('2026-09-11', late)).toBe(true);
    expect(isDateInWindow('2026-09-24', late)).toBe(true); // 11+13
    expect(isDateInWindow('2026-09-25', late)).toBe(false);
  });

  it('длительность вне E12 в строке БД — ValidationError, не вечный цикл и не кривая сетка', () => {
    const bad = (durationMinutes: number) =>
      expect(() => buildSlots(db, { id: 'x', title: 'x', durationMinutes }, '2026-09-10', NOW_MORNING)).toThrow(ValidationError);
    bad(0);
    bad(7.5);
    bad(7); // целое, но не кратно 5
    bad(545); // за границей диапазона
    expect(() => buildSlots(db, { id: 'x', title: 'x', durationMinutes: 5 }, '2026-09-10', NOW_MORNING)).not.toThrow();
    expect(() => buildSlots(db, { id: 'x', title: 'x', durationMinutes: 540 }, '2026-09-10', NOW_MORNING)).not.toThrow();
  });

  it('кривые даты — ValidationError (E4)', () => {
    expect(() => assertValidDate('2026-02-30')).toThrow(ValidationError); // не календарная
    expect(() => assertValidDate('2026-02-29')).toThrow(ValidationError); // 2026 не високосный
    expect(() => assertValidDate('2028-02-29')).not.toThrow(); // 2028 високосный
    expect(() => assertValidDate('2026-9-5')).toThrow(ValidationError); // формат
    expect(() => assertValidDate('29.09.2026')).toThrow(ValidationError);
    expect(() => assertValidDate('2026-09-10')).not.toThrow();
  });
});
