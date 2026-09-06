// Стаб контракта (шаг 2.1b): in-memory реализация всех 6 ручек открытого
// контракта contract/dist/openapi.yaml. Вторичный источник правды — сверяется
// с контрактом; Prism для этого не годится (не хранит состояние — «бронь →
// Занято» не показать). Dev-инструмент этапа 2, в прод не попадает.
import crypto from 'node:crypto';
import express from 'express';

const MSK_OFFSET_MIN = 180; // Europe/Moscow фиксировано +03:00 (спека C2)
const WORK_START = 9 * 60;
const WORK_END = 18 * 60;
const WINDOW_DAYS = 14;
const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

const error = (res, status, code, message) => res.status(status).json({ code, message });

const state = {
  eventTypes: [
    { id: 'meet-15', title: 'Встреча 15 минут', description: 'Короткий созвон на 15 минут', durationMinutes: 15 },
    { id: 'meet-30', title: 'Встреча 30 минут', description: 'Созвон на полчаса', durationMinutes: 30 },
  ],
  bookings: [],
  // отменённые id: повторная отмена идемпотентна (204), как в бэкенде,
  // где бронь остаётся строкой со status='cancelled'
  cancelledIds: new Set(),
};

const overlaps = (start, end) =>
  state.bookings.filter((b) => start < b.end && end > b.start); // пересечение, стык не конфликт

function mskDay(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date);
}

function addDays(isoDay, days) {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Тело запроса — только известные поля контракта (E8: неизвестные → 400),
// строки нормализуются trim (E10/E11)
function readBody(req, res, allowed) {
  const b = req.body;
  if (b === null || typeof b !== 'object' || Array.isArray(b)) {
    error(res, 400, 'validation', 'Ожидался JSON-объект');
    return null;
  }
  const extra = Object.keys(b).filter((k) => !allowed.includes(k));
  if (extra.length > 0) {
    error(res, 400, 'validation', `Неизвестные поля: ${extra.join(', ')}`);
    return null;
  }
  const out = {};
  for (const [k, v] of Object.entries(b)) out[k] = typeof v === 'string' ? v.trim() : v;
  return out;
}

const app = express();
app.use(express.json({ limit: '64kb' }));
// Ошибки body-parser — тоже Error JSON (C7), не html-заглушка Express
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') return error(res, 413, 'payload_too_large', 'Тело запроса слишком большое');
  if (err?.type === 'entity.parse.failed') return error(res, 400, 'validation', 'Ожидался валидный JSON');
  // charset=utf-16 и пр.: бэкенд маппит клиентские 4xx Express в 400 validation —
  // без ветки стаб отдавал бы html-500 и расходился с бэком на том же входе
  if (err?.type === 'encoding.unsupported') return error(res, 400, 'validation', 'Некорректный запрос');
  return next(err);
});

app.get('/api/event-types', (_req, res) => res.json(state.eventTypes));

app.get('/api/event-types/:id/slots', (req, res) => {
  // как бэкенд: сначала наличие типа (404), формат id не отделяем — его путь
  // и так не существует в состоянии стаба
  const type = state.eventTypes.find((t) => t.id === req.params.id);
  if (!type) return error(res, 404, 'not_found', `Тип события не найден: ${req.params.id}`);
  const date = req.query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return error(res, 400, 'validation', 'date обязателен и должен быть YYYY-MM-DD');
  }
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return error(res, 400, 'validation', `date не календарная дата: ${date}`);
  }
  const today = mskDay(new Date());
  if (date < today || date > addDays(today, WINDOW_DAYS - 1)) {
    return error(res, 400, 'slot_out_of_window', `дата вне окна записи (${WINDOW_DAYS} дней, MSK): ${date}`);
  }
  const now = new Date();
  const dayStart = Date.parse(`${date}T00:00:00Z`) - MSK_OFFSET_MIN * 60_000;
  const slots = [];
  for (let m = WORK_START; m + type.durationMinutes <= WORK_END; m += type.durationMinutes) {
    const start = new Date(dayStart + m * 60_000).toISOString();
    const end = new Date(dayStart + (m + type.durationMinutes) * 60_000).toISOString();
    if (new Date(start) < now) continue;
    slots.push({ start, end, status: overlaps(start, end).length > 0 ? 'booked' : 'available' });
  }
  res.json(slots);
});

app.post('/api/bookings', (req, res) => {
  const b = readBody(req, res, ['eventTypeId', 'start', 'name', 'email', 'notes']);
  if (b === null) return undefined;
  // зеркало bookingCreateSchema: shape/pattern/длины — раньше поиска типа
  // (длины по сырой строке, maxLength контракта считается до trim, E10)
  const raw = req.body;
  if (
    typeof b.eventTypeId !== 'string' || !ID_PATTERN.test(raw.eventTypeId) ||
    typeof b.start !== 'string' ||
    typeof b.name !== 'string' || b.name === '' || raw.name.length > 120 ||
    typeof b.email !== 'string' || raw.email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) ||
    (b.notes !== undefined && (typeof b.notes !== 'string' || b.notes === '' || raw.notes.length > 2000))
  ) {
    return error(res, 400, 'validation', 'name/email/start/notes не проходят валидацию контракта');
  }
  const type = state.eventTypes.find((t) => t.id === b.eventTypeId);
  if (!type) return error(res, 404, 'not_found', `Тип события не найден: ${b.eventTypeId}`);
  const startMs = Date.parse(b.start);
  // зеркало backend validateBookingStart: зона обязательна, «в прошлом» (E3)
  // раньше «вне окна» (E5) с отдельным сообщением, сетка — validation
  if (
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(b.start) ||
    Number.isNaN(startMs)
  ) {
    return error(res, 400, 'validation', 'start должен быть ISO-моментом с зоной');
  }
  const mskMs = startMs + MSK_OFFSET_MIN * 60_000;
  const dayStartMs = Math.floor(mskMs / 86_400_000) * 86_400_000;
  const minuteOfDay = (mskMs - dayStartMs) / 60_000;
  const startDay = new Date(dayStartMs).toISOString().slice(0, 10);
  const today = mskDay(new Date());
  // стаб сверяет «прошло» по системным часам: NOW-env — фича бэкенда (nowFn),
  // в стабе сознательно не дублируем — мок всегда живёт на реальном времени
  if (startMs < Date.now()) {
    return error(res, 400, 'slot_out_of_window', 'время слота уже прошло');
  }
  if (startDay < today || startDay > addDays(today, WINDOW_DAYS - 1)) {
    return error(res, 400, 'slot_out_of_window', `дата вне окна записи (${WINDOW_DAYS} дней, MSK): ${startDay}`);
  }
  if (
    minuteOfDay < WORK_START ||
    minuteOfDay + type.durationMinutes > WORK_END ||
    (minuteOfDay - WORK_START) % type.durationMinutes !== 0
  ) {
    return error(res, 400, 'validation', 'start вне сетки слотов типа');
  }
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(startMs + type.durationMinutes * 60_000).toISOString();
  if (overlaps(startIso, endIso).length > 0) {
    return error(res, 409, 'slot_conflict', 'Слот уже занят (пересечение интервалов)');
  }
  const booking = {
    id: crypto.randomUUID(),
    eventTypeId: type.id,
    start: startIso,
    end: endIso,
    name: b.name,
    email: b.email,
    ...(b.notes ? { notes: b.notes } : {}),
    createdAt: new Date().toISOString(),
  };
  state.bookings.push(booking);
  res.status(201).json(booking);
});

app.get('/api/bookings', (_req, res) => {
  const nowIso = new Date().toISOString();
  res.json(state.bookings.filter((b) => b.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start)));
});

app.delete('/api/bookings/:id', (req, res) => {
  const id = req.params.id;
  const i = state.bookings.findIndex((b) => b.id === id);
  if (i >= 0) {
    state.bookings.splice(i, 1);
    state.cancelledIds.add(id);
    return res.status(204).end();
  }
  if (state.cancelledIds.has(id)) return res.status(204).end();
  return error(res, 404, 'not_found', `Бронь не найдена: ${id}`);
});

app.post('/api/event-types', (req, res) => {
  const t = readBody(req, res, ['id', 'title', 'description', 'durationMinutes']);
  if (t === null) return undefined;
  // как bookingCreateSchema: pattern и maxLength — по СЫРОЙ строке (бэкенд
  // считает max до trim), min/непустота — по trim'нутому
  const raw = req.body;
  if (
    typeof t.id !== 'string' || !ID_PATTERN.test(raw.id) ||
    typeof t.title !== 'string' || t.title === '' || raw.title.length > 80 ||
    (t.description !== undefined && (typeof t.description !== 'string' || raw.description.length > 500)) ||
    !Number.isInteger(t.durationMinutes) || t.durationMinutes < 5 || t.durationMinutes > 540 || t.durationMinutes % 5 !== 0
  ) {
    return error(res, 400, 'validation', 'id/title/description/durationMinutes не проходят валидацию контракта');
  }
  if (state.eventTypes.some((x) => x.id === t.id)) {
    return error(res, 409, 'duplicate_id', `id уже занят: ${t.id}`);
  }
  const type = {
    id: t.id,
    title: t.title,
    ...(t.description ? { description: t.description } : {}),
    durationMinutes: t.durationMinutes,
  };
  state.eventTypes.push(type);
  res.status(201).json(type);
});

// Неизвестный /api/* — тот же формат Error (E19), не html-заглушка Express
app.use('/api', (_req, res) => error(res, 404, 'not_found', 'Маршрут не найден'));

// `|| 4020`, а не `?? 4020`: compose.dev прокидывает MOCK_PORT пустой строкой,
// Number('') дал бы порт 0 (рандомный) вместо дефолта
const port = Number(process.env.MOCK_PORT) || 4020;
app.listen(port, () => console.log(`contract stub on :${port} (MOCK_PORT)`));
