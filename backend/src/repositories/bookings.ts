import { randomUUID } from 'node:crypto';
import type { Db } from '../db/connection.js';
import type { Booking } from '../types.js';
import { now, type NowFn } from '../services/now.js';

// Хранилище принимает только канон UTC ISO (вид ...T09:00:00.000Z):
// TEXT-колонки сравниваются лексикографически, «2026-09-10T09:30:00Z» или
// «+03:00» рядом с «.000Z» ломает и пересечения (E1), и сортировки.
// Ненулевые offset/форматы нормализуются здесь, мусор — InvalidDateError
// (типизирован: маршрут 3.3 отмаппит в 400 validation, не в 500).
export class InvalidDateError extends Error {}

export function toIsoUtc(value: string): string {
  const d = new Date(value);
  // RangeError от toISOString() доносит до вызывающего только «Invalid time value»;
  // явная ошибка называет вход, который её вызвал
  if (Number.isNaN(d.getTime())) {
    throw new InvalidDateError(`Некорректная дата: ${value}`);
  }
  return d.toISOString();
}

interface BookingRow {
  id: string;
  event_type_id: string;
  start: string;
  end: string;
  name: string;
  email: string;
  notes: string | null;
  created_at: string;
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    eventTypeId: row.event_type_id,
    start: row.start,
    end: row.end,
    name: row.name,
    email: row.email,
    ...(row.notes !== null ? { notes: row.notes } : {}),
    createdAt: row.created_at,
  };
}

// Правило занятости (спека, ядро 1): пересечение интервалов по ВСЕМ броням,
// тип не учитывается; стык end == next.start конфликтом не считается.
// часть WHERE-запроса; константа модуля, не пользовательский ввод
const OVERLAP_CLAUSE = 'start < @end AND end > @start';

export function findOverlaps(db: Db, start: string, end: string): Booking[] {
  const rows = db
    .prepare(
      `SELECT id, event_type_id, start, end, name, email, notes, created_at
       FROM bookings WHERE ${OVERLAP_CLAUSE} ORDER BY start`,
    )
    .all({ start: toIsoUtc(start), end: toIsoUtc(end) }) as BookingRow[];
  return rows.map(toBooking);
}

export function insertBooking(db: Db, b: Booking): void {
  db.prepare(
    `INSERT INTO bookings (id, event_type_id, start, end, name, email, notes, created_at)
     VALUES (@id, @eventTypeId, @start, @end, @name, @email, @notes, @createdAt)`,
  ).run({
    id: b.id,
    eventTypeId: b.eventTypeId,
    start: toIsoUtc(b.start),
    end: toIsoUtc(b.end),
    name: b.name,
    email: b.email,
    notes: b.notes ?? null,
    createdAt: toIsoUtc(b.createdAt),
  });
}

export type BookingCreate = Omit<Booking, 'id' | 'createdAt'>;

// Проверка пересечений и вставка — в одной транзакции (спека, ядро 2):
// better-sqlite3 синхронный, один процесс — гонка параллельных POST закрыта.
export function createBookingIfFree(
  db: Db,
  input: BookingCreate,
  nowFn: NowFn = now,
): { ok: true; booking: Booking } | { ok: false; conflicts: Booking[] } {
  // toIsoUtc идемпотентен, повторная нормализация внутри findOverlaps/insertBooking
  // безопасна: они вызываются и напрямую, их границы должны держать канон сами
  const canonical: BookingCreate = { ...input, start: toIsoUtc(input.start), end: toIsoUtc(input.end) };
  const tx = db.transaction((): { ok: true; booking: Booking } | { ok: false; conflicts: Booking[] } => {
    const conflicts = findOverlaps(db, canonical.start, canonical.end);
    if (conflicts.length > 0) return { ok: false, conflicts };
    const booking: Booking = { ...canonical, id: randomUUID(), createdAt: nowFn().toISOString() };
    insertBooking(db, booking);
    return { ok: true, booking };
  });
  return tx();
}

export function listUpcoming(db: Db, fromIso: string): Booking[] {
  const rows = db
    .prepare(
      `SELECT id, event_type_id, start, end, name, email, notes, created_at
       FROM bookings WHERE start >= ? ORDER BY start`,
    )
    .all(toIsoUtc(fromIso)) as BookingRow[];
  return rows.map(toBooking);
}
