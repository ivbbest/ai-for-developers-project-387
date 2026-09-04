import type { Db } from '../db/connection.js';
import { findOverlaps } from '../repositories/bookings.js';
import { now, type NowFn } from './now.js';
import {
  MSK_OFFSET_MINUTES,
  SERVICE_TZ,
  WINDOW_DAYS,
  WORK_END_MINUTE,
  WORK_START_MINUTE,
} from '../config.js';
import type { EventType, Slot } from '../types.js';

// Ошибки слоя — типизированы; маппинг в HTTP (400 validation / 400
// slot_out_of_window) делает маршрут (3.4), чтобы сервис не знал про Express.
export class ValidationError extends Error {}
export class OutOfWindowError extends Error {}

// ISO-календарный день (YYYY-MM-DD) момента в TZ сервиса — через Intl,
// без ручной арифметики дат: «сегодня» считается по MSK, не по UTC/браузеру.
export function mskDay(moment: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SERVICE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(moment);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  const [y, m, d] = [get('year'), get('month'), get('day')];
  if (!y || !m || !d) {
    throw new Error(`Intl не вернул части даты для ${SERVICE_TZ}: ${moment.toISOString()}`);
  }
  return `${y}-${m}-${d}`;
}

function addDays(isoDay: string, days: number): string {
  const [y, m, d] = isoDay.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isDateInWindow(dateStr: string, nowFn: NowFn): boolean {
  const today = mskDay(nowFn());
  return dateStr >= today && dateStr <= addDays(today, WINDOW_DAYS - 1);
}

// Проверка формата и календарной реальности (E4: «2026-02-30», «2026-9-5» — 400).
export function assertValidDate(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ValidationError(`date должен быть YYYY-MM-DD, получено: ${dateStr}`);
  }
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== dateStr) {
    throw new ValidationError(`date не календарная дата: ${dateStr}`);
  }
}

// Единый пересчёт «UTC-момент → календарный день MSK + минута дня + полночь
// этого дня в UTC». Держится в одном месте: buildSlots и validateBookingStart
// обязаны сходиться на любой future правке пояса (см. MSK_OFFSET_MINUTES).
const MSK_OFFSET_MS = MSK_OFFSET_MINUTES * 60_000;
function mskDayParts(utcMs: number): { dayIso: string; minuteOfDay: number; dayStartUtcMs: number } {
  const shifted = utcMs + MSK_OFFSET_MS; // часовая стрелка MSK, считаем «как UTC»
  const dayStartPseudo = Math.floor(shifted / 86_400_000) * 86_400_000;
  return {
    dayIso: new Date(dayStartPseudo).toISOString().slice(0, 10),
    minuteOfDay: (shifted - dayStartPseudo) / 60_000,
    dayStartUtcMs: dayStartPseudo - MSK_OFFSET_MS,
  };
}

// Старт брони обязан совпадать со слотом сетки типа (E3/E5/E7):
// парсится, дата в окне, не в прошлом (сообщение «время слота уже прошло»
// отличается от оконного — фронт по нему рефрешит сетку), лежит на шаге
// от 09:00 MSK и заканчивается не позже 18:00.
export function validateBookingStart(type: EventType, startIso: string, nowFn: NowFn = now): void {
  const t = nowFn();
  // без зоны Date.parse трактует строку как локальное время — семантика слотов
  // поехала бы от часов сервера; контракт обещает utcDateTime
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(startIso)) {
    throw new ValidationError(`start должен быть с зоной (…Z или ±hh:mm): ${startIso}`);
  }
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) {
    throw new ValidationError(`start не парсится как дата: ${startIso}`);
  }
  // E3 раньше E5: «страница висела до полуночи» даёт старт вчера — дата формально
  // вне окна, но сообщение обязано быть «время слота уже прошло» (фронт по нему
  // рефрешит сетку, а не подсказывает про дату)
  if (startMs < t.getTime()) {
    throw new OutOfWindowError('время слота уже прошло');
  }
  const day = mskDayParts(startMs);
  const today = mskDay(t);
  if (day.dayIso < today || day.dayIso > addDays(today, WINDOW_DAYS - 1)) {
    throw new OutOfWindowError(`дата вне окна записи (${WINDOW_DAYS} дней, MSK): ${day.dayIso}`);
  }
  if (
    day.minuteOfDay < WORK_START_MINUTE ||
    day.minuteOfDay + type.durationMinutes > WORK_END_MINUTE ||
    (day.minuteOfDay - WORK_START_MINUTE) % type.durationMinutes !== 0
  ) {
    throw new ValidationError('start вне сетки слотов типа');
  }
}

// Сетка дня (спека «Доменные сущности», Slot): от 09:00 MSK с шагом
// durationMinutes, пока end <= 18:00 MSK; прошедшие слоты (start < now)
// исключены; занятые — со статусом booked (пересечение с ЛЮБОЙ бронью).
export function buildSlots(db: Db, type: EventType, dateStr: string, nowFn: NowFn = now): Slot[] {
  assertValidDate(dateStr);
  // Сервис может получить любую строку из БД; шаг вне E12 (5–540, кратно 5)
  // дал бы некорректную сетку или вечный цикл. Валидация форматов на границе
  // HTTP — задача маршрутов (3.4), здесь — инвариант расчёта.
  const d = type.durationMinutes;
  if (!Number.isInteger(d) || d < 5 || d > 540 || d % 5 !== 0) {
    throw new ValidationError(`durationMinutes должен быть целым 5–540 и кратным 5: ${d}`);
  }
  // Один момент «сейчас» на запрос: окно и отсечка прошедших сверяются
  // с одними и теми же часами.
  const t = nowFn();
  if (!isDateInWindow(dateStr, () => t)) {
    throw new OutOfWindowError(`дата вне окна записи (${WINDOW_DAYS} дней, MSK): ${dateStr}`);
  }

  const nowMs = t.getTime();
  // MSK-полночь календарного дня: полдень UTC гарантированно лежит внутри
  // того же дня MSK (12:00Z = 15:00 MSK), helper даёт точную полночь −3ч
  const { dayStartUtcMs } = mskDayParts(Date.parse(`${dateStr}T12:00:00Z`));
  const at = (minuteOfDay: number) => new Date(dayStartUtcMs + minuteOfDay * 60_000);

  // Брони дня — одним запросом, статус слота считается в памяти:
  // по запросу на слот (36 на день) превращалось в N+1
  const busy = findOverlaps(db, at(WORK_START_MINUTE).toISOString(), at(WORK_END_MINUTE).toISOString());

  const slots: Slot[] = [];
  // Инвариант: шаг цикла положителен и целой кратен 5 — его гарантирует
  // проверка durationMinutes выше (5–540, кратно 5). Без неё m += 0 зациклил бы сетку.
  for (let m = WORK_START_MINUTE; m + type.durationMinutes <= WORK_END_MINUTE; m += type.durationMinutes) {
    const start = at(m);
    const end = at(m + type.durationMinutes);
    if (start.getTime() < nowMs) continue;
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const status = busy.some((b) => startIso < b.end && endIso > b.start) ? 'booked' : 'available';
    slots.push({ start: startIso, end: endIso, status });
  }
  return slots;
}
