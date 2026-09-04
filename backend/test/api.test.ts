import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb, migrate, type Db } from '../src/db/connection.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { insertBooking } from '../src/repositories/bookings.js';
import type { Booking } from '../src/types.js';

// Фиксированное «сейчас»: 2026-09-10 08:00 MSK — день 10-е в окне,
// рабочие слоты ещё не начались
const NOW = () => new Date('2026-09-10T05:00:00Z');

function makeDb(): Db {
  const db = openDb(':memory:');
  migrate(db);
  seed(db);
  return db;
}


function slotDate(offsetDays = 0): string {
  // «завтра» от NOW в MSK
  const base = Date.parse('2026-09-10T00:00:00Z') + offsetDays * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

describe('GET /api/event-types/:id/slots', () => {
  let db: Db;
  let api: ReturnType<typeof createApp>;
  beforeEach(() => {
    db = makeDb();
    api = createApp(db, { nowFn: NOW });
  });

  it('сетка дня: 36 слотов 15-мин, все available', async () => {
    const res = await request(api).get(`/api/event-types/meet-15/slots?date=${slotDate()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(36);
    expect(res.body[0]).toEqual({
      start: '2026-09-10T06:00:00.000Z',
      end: '2026-09-10T06:15:00.000Z',
      status: 'available',
    });
  });

  it('E20: без date → 400 validation', async () => {
    const res = await request(api).get('/api/event-types/meet-15/slots');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
  });

  it('E4: 2026-02-30 → 400 validation', async () => {
    const res = await request(api).get('/api/event-types/meet-15/slots?date=2026-02-30');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
  });

  it('E5: вчера/+14 → 400 slot_out_of_window; +13 → 200', async () => {
    const y = await request(api).get(`/api/event-types/meet-15/slots?date=${slotDate(-1)}`);
    expect(y.status).toBe(400);
    expect(y.body.code).toBe('slot_out_of_window');
    const last = await request(api).get(`/api/event-types/meet-15/slots?date=${slotDate(13)}`);
    expect(last.status).toBe(200);
    const over = await request(api).get(`/api/event-types/meet-15/slots?date=${slotDate(14)}`);
    expect(over.status).toBe(400);
    expect(over.body.code).toBe('slot_out_of_window');
  });

  it('E6: неизвестный тип — 404 раньше валидации даты', async () => {
    const res = await request(api).get('/api/event-types/nope/slots');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('занятый слот возвращается со статусом booked', async () => {
    insertBooking(db, {
      id: 'b1', eventTypeId: 'meet-30', name: 'Г', email: 'g@example.com',
      start: '2026-09-10T06:00:00.000Z', end: '2026-09-10T06:30:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    const res = await request(api).get(`/api/event-types/meet-15/slots?date=${slotDate()}`);
    expect(res.body.slice(0, 3).map((s: { status: string }) => s.status)).toEqual(['booked', 'booked', 'available']);
  });
});

describe('POST /api/bookings (3.3)', () => {
  let db: Db;
  let api: ReturnType<typeof createApp>;
  beforeEach(() => {
    db = makeDb();
    api = createApp(db, { nowFn: NOW });
  });

  const booking = (over: Record<string, unknown> = {}) => ({
    eventTypeId: 'meet-15',
    start: '2026-09-10T06:00:00.000Z',
    name: 'Иван Петров',
    email: 'ivan@example.com',
    ...over,
  });

  it('201: серверный end=start+duration, uuid id, createdAt из now()', async () => {
    const res = await request(api).post('/api/bookings').send(booking());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      eventTypeId: 'meet-15',
      start: '2026-09-10T06:00:00.000Z',
      end: '2026-09-10T06:15:00.000Z',
      name: 'Иван Петров',
      email: 'ivan@example.com',
      createdAt: '2026-09-10T05:00:00.000Z',
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('критерий 3.3: 30-мин броня блокирует 15-мин запрос на 09:15; стык 09:30 свободен (E1)', async () => {
    const wide = await request(api).post('/api/bookings').send(booking({ eventTypeId: 'meet-30', start: '2026-09-10T06:00:00.000Z' }));
    expect(wide.status).toBe(201);
    const clash = await request(api).post('/api/bookings').send(booking({ start: '2026-09-10T06:15:00.000Z' }));
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('slot_conflict');
    const edge = await request(api).post('/api/bookings').send(booking({ start: '2026-09-10T06:30:00.000Z' }));
    expect(edge.status).toBe(201);
  });

  it('E2: повтор того же start → 409', async () => {
    expect((await request(api).post('/api/bookings').send(booking())).status).toBe(201);
    const again = await request(api).post('/api/bookings').send(booking());
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('slot_conflict');
  });

  it('E15: три пересекающиеся POST одной очередью — ровно один 201 (исходы, не interleaving)', async () => {
    const results = await Promise.all([
      request(api).post('/api/bookings').send(booking({ eventTypeId: 'meet-30' })), // 06:00–06:30
      request(api).post('/api/bookings').send(booking({ eventTypeId: 'meet-30' })), // тот же интервал
      request(api).post('/api/bookings').send(booking({ eventTypeId: 'meet-15', start: '2026-09-10T06:15:00.000Z' })), // 06:15–06:30
    ]);
    const ok = results.filter((r) => r.status === 201);
    expect(ok).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it('E3: start в прошлом (дата в окне) → 400 slot_out_of_window с отдельным сообщением', async () => {
    const res = await request(api).post('/api/bookings').send(booking({ start: '2026-09-10T04:00:00.000Z' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('slot_out_of_window');
    expect(res.body.message).toBe('время слота уже прошло');
  });

  it('E7: start вне сетки (09:07) и до начала рабочего дня → 400 validation', async () => {
    const off = await request(api).post('/api/bookings').send(booking({ start: '2026-09-10T06:07:00.000Z' }));
    expect(off.status).toBe(400);
    expect(off.body.code).toBe('validation');
    const early = await request(api).post('/api/bookings').send(booking({ start: '2026-09-10T05:30:00.000Z' }));
    expect(early.status).toBe(400);
  });

  it('E8: неизвестное поле (включая end от клиента) → 400 validation', async () => {
    const res = await request(api).post('/api/bookings').send(booking({ end: '2026-09-10T07:00:00.000Z' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
  });

  it('E9: не-JSON → 400 validation; >64 КБ → 413 payload_too_large (E18)', async () => {
    const bad = await request(api).post('/api/bookings').set('Content-Type', 'application/json').send('{"oops');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('validation');
    const big = await request(api)
      .post('/api/bookings')
      .send(booking({ notes: 'x'.repeat(70_000) }));
    expect(big.status).toBe(413);
    expect(big.body.code).toBe('payload_too_large');
  });

  it('E10: name trim; пустой после trim — 400; кириллица/эмодзи проходят', async () => {
    const blank = await request(api).post('/api/bookings').send(booking({ name: '   ' }));
    expect(blank.status).toBe(400);
    const ok = await request(api).post('/api/bookings').send(booking({ name: '  Пётр 😊  ' }));
    expect(ok.status).toBe(201);
    expect(ok.body.name).toBe('Пётр 😊');
    const emptyNotes = await request(api).post('/api/bookings').send(booking({ notes: '   ' }));
    expect(emptyNotes.status).toBe(400);
  });

  it('E11: email — простой regex, регистр сохраняется', async () => {
    const ok = await request(api).post('/api/bookings').send(booking({ email: '  IVAN@Mail.RU ' }));
    expect(ok.status).toBe(201);
    expect(ok.body.email).toBe('IVAN@Mail.RU');
    const bad = await request(api).post('/api/bookings').send(booking({ email: 'не-почта' }));
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('validation');
  });

  it('E6: неизвестный тип — 404 раньше валидации start', async () => {
    const res = await request(api).post('/api/bookings').send(booking({ eventTypeId: 'nope', start: 'не-дата' }));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });

  it('P3: eventTypeId вне паттерна контракта — 400 validation, а не 404', async () => {
    // «MEET_15»: контракт (EventTypeId pattern) и Prism дают 400; бэк до
    // фикса пропускал строку к поиску и отвечал 404 not_found
    const res = await request(api).post('/api/bookings').send(booking({ eventTypeId: 'MEET_15' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
  });

  it('P3: maxLength считается по сырой строке (до trim)', async () => {
    // 120 букв + 4 пробела: после trim ровно 120, но контракт ограничивает
    // строку как она пришла в JSON — 400 (подтверждено пробой на zod 4.5.4)
    const res = await request(api).post('/api/bookings').send(booking({ name: `${'а'.repeat(120)}    ` }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
  });

  it('кривой start (не парсится) → 400 validation', async () => {
    const res = await request(api).post('/api/bookings').send(booking({ start: 'вчера' }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
  });

  it('start без зоны → 400 validation (контракт обещает utcDateTime)', async () => {
    const res = await request(api).post('/api/bookings').send(booking({ start: '2026-09-10T06:00:00' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/зоной/);
  });

  it('T2: ровно 00:00 MSK — «сегодня» уже новый день (21:00Z предыдущего)', async () => {
    // NOW = 2026-09-10T21:00:00Z = 2026-09-11 00:00 MSK ровно
    const midnight = createApp(makeDb(), { nowFn: () => new Date('2026-09-10T21:00:00Z') });
    const y = await request(midnight).get('/api/event-types/meet-15/slots?date=2026-09-10');
    expect(y.status).toBe(400);
    expect(y.body.code).toBe('slot_out_of_window'); // вчера относительно MSK
    const ok = await request(midnight).get('/api/event-types/meet-15/slots?date=2026-09-11');
    expect(ok.status).toBe(200);
  });

  it('E8: неизвестные поля — RU-список, не «Поле ""» с англ. текстом', async () => {
    const res = await request(api).post('/api/bookings').send(booking({ owner: 'x', end: 'y' }));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Неизвестные поля: owner, end');
  });

  it('E3 после полуночи: вчерашний старт — «время слота уже прошло», не «вне окна»', async () => {
    const afterMidnight = createApp(makeDb(), { nowFn: () => new Date('2026-09-10T21:30:00Z') }); // 00:30 MSK 11-го
    const res = await request(afterMidnight).post('/api/bookings').send({
      eventTypeId: 'meet-15',
      start: '2026-09-10T06:00:00.000Z', // 09:00 MSK 10-го — вчера и прошлое
      name: 'Г', email: 'g@example.com',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('slot_out_of_window');
    expect(res.body.message).toBe('время слота уже прошло');
  });
});

describe('POST /api/event-types (3.4)', () => {
  let db: Db;
  let api: ReturnType<typeof createApp>;
  beforeEach(() => {
    db = makeDb();
    api = createApp(db, { nowFn: NOW });
  });

  const type = (over: Record<string, unknown> = {}) => ({
    id: 'call-45', title: 'Созвон 45 минут', durationMinutes: 45, ...over,
  });

  it('201: новый тип появляется в каталоге и в сетке по своей длительности', async () => {
    const created = await request(api).post('/api/event-types').send(type());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: 'call-45', durationMinutes: 45 });
    const catalog = await request(api).get('/api/event-types');
    expect(catalog.body.map((t: { id: string }) => t.id)).toContain('call-45');
    const slots = await request(api).get(`/api/event-types/call-45/slots?date=${slotDate()}`);
    // 09:00–18:00 / 45 мин = 12 слотов
    expect(slots.body).toHaveLength(12);
  });

  it('E13: повтор seed-id (meet-15) → 409 duplicate_id', async () => {
    const res = await request(api).post('/api/event-types').send(type({ id: 'meet-15', title: 'Дубль' }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('duplicate_id');
  });

  it('P3: title/description maxLength по сырой строке (до trim) — как name в броне', async () => {
    const title = await request(api).post('/api/event-types').send(type({ title: `${'а'.repeat(80)}   ` }));
    expect(title.status).toBe(400);
    expect(title.body.code).toBe('validation');
    const desc = await request(api).post('/api/event-types').send(type({ description: `${'б'.repeat(500)}   ` }));
    expect(desc.status).toBe(400);
    expect(desc.body.code).toBe('validation');
  });

  it('E12: duration 545/0/13 → 400; 540 → 201 и один слот в день', async () => {
    for (const bad of [545, 0, 13]) {
      const res = await request(api).post('/api/event-types').send(type({ id: `x-${bad}`, durationMinutes: bad }));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('validation');
    }
    const edge = await request(api).post('/api/event-types').send(type({ id: 'x-540', durationMinutes: 540 }));
    expect(edge.status).toBe(201);
    const slots = await request(api).get(`/api/event-types/x-540/slots?date=${slotDate()}`);
    expect(slots.body).toHaveLength(1);
  });

  it('C5: id вне паттерна → 400; E8: лишние поля → 400; title >80 → 400', async () => {
    expect((await request(api).post('/api/event-types').send(type({ id: 'MEET_X' }))).status).toBe(400);
    expect((await request(api).post('/api/event-types').send(type({ owner: 'tota' }))).status).toBe(400);
    expect((await request(api).post('/api/event-types').send(type({ title: 'д'.repeat(81) }))).status).toBe(400);
  });

  it('T1-края: id="", title только пробелы, description >500 → 400; 5 и 540 → 201', async () => {
    expect((await request(api).post('/api/event-types').send(type({ id: '' }))).status).toBe(400);
    expect((await request(api).post('/api/event-types').send(type({ title: '   ' }))).status).toBe(400);
    expect((await request(api).post('/api/event-types').send(type({ description: 'о'.repeat(501) }))).status).toBe(400);
    expect((await request(api).post('/api/event-types').send(type({ id: 'min-5', durationMinutes: 5 }))).status).toBe(201);
    expect((await request(api).post('/api/event-types').send(type({ id: 'max-540', durationMinutes: 540 }))).status).toBe(201);
  });
});

describe('GET /api/bookings (3.4, E16)', () => {
  let db: Db;
  let api: ReturnType<typeof createApp>;
  beforeEach(() => {
    db = makeDb();
    api = createApp(db, { nowFn: NOW });
  });

  it('только start >= now, сортировка по start', async () => {
    const rows: Array<[string, string]> = [
      ['2026-09-12T06:00:00.000Z', 'b3'],
      ['2026-09-10T04:00:00.000Z', 'b1'], // прошлое (до NOW 05:00Z)
      ['2026-09-11T06:00:00.000Z', 'b2'],
    ];
    for (const [start, id] of rows) {
      insertBooking(db, {
        id, eventTypeId: 'meet-15', name: 'Г', email: 'g@example.com',
        start, end: start.replace('06:00', '06:15').replace('04:00', '04:15'),
        createdAt: '2026-09-01T00:00:00.000Z',
      });
    }
    const res = await request(api).get('/api/bookings');
    expect(res.status).toBe(200);
    expect(res.body.map((b: Booking) => b.id)).toEqual(['b2', 'b3']);
  });

  it('пустой список — 200 []', async () => {
    const res = await request(api).get('/api/bookings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('E14: рестарт сервера на существующей БД', () => {
  let dir: string;
  let path: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cal-com-'));
    path = join(dir, 'app.db');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('seed не дублирует, брони остаются', async () => {
    const first = openDb(path);
    migrate(first);
    seed(first);
    void createApp(first, { nowFn: NOW }); // приложение пересоздаётся как при рестарте процесса
    const res = await request(createApp(first, { nowFn: NOW })).post('/api/bookings').send({
      eventTypeId: 'meet-15',
      start: '2026-09-10T06:00:00.000Z',
      name: 'Г',
      email: 'g@example.com',
    });
    expect(res.status).toBe(201);
    first.close();

    const second = openDb(path);
    migrate(second);
    seed(second);
    const types = await request(createApp(second, { nowFn: NOW })).get('/api/event-types');
    expect(types.body).toHaveLength(2);
    const bookings = await request(createApp(second, { nowFn: NOW })).get('/api/bookings');
    expect(bookings.body).toHaveLength(1);
    expect(bookings.body[0].name).toBe('Г');
    second.close();
  });
});


describe('3.5: раздача сборки фронта одним портом', () => {
  let dir: string;
  let api: ReturnType<typeof createApp>;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cal-dist-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>cal-com</title>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
    api = createApp(makeDb(), { nowFn: NOW, staticDir: dir });
  });

  it('GET / и статика отдаются файлами', async () => {
    const root = await request(api).get('/');
    expect(root.status).toBe(200);
    expect(root.text).toContain('cal-com');
    const asset = await request(api).get('/assets/app.js');
    expect(asset.status).toBe(200);
    expect(asset.text).toContain('console.log');
  });

  it('SPA-fallback: несуществующий не-api путь отдаёт index.html', async () => {
    const res = await request(api).get('/book/meet-15/confirm');
    expect(res.status).toBe(200);
    expect(res.text).toContain('cal-com');
  });

  it('отсутствующий файл-ассет — 404 и не index.html (ловушка SPA-fallback)', async () => {
    const res = await request(api).get('/assets/missing.js');
    // браузер не должен получить код приложения с 200 на место скрипта;
    // дефолтный 404 Express — тоже html, но статус и тело не от index
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('cal-com');
  });

  it('E19: /api/* в fallback не проваливается — JSON 404', async () => {
    const res = await request(api).get('/api/whatever');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
    const post = await request(api).post('/api/whatever').send({});
    expect(post.status).toBe(404);
    expect(post.body.code).toBe('not_found');
  });

  it('P3: /apixyz — не api-сегмент, получает index.html (предикат fallback = сегментный)', async () => {
    // startsWith('/api') вырезал и этот путь: не было ни API-404, ни SPA-роутинга
    const res = await request(api).get('/apixyz');
    expect(res.status).toBe(200);
    expect(res.text).toContain('cal-com');
  });

  it('без каталога сборки (dev) — API-only, / не отдаётся', async () => {
    const only = createApp(makeDb(), { nowFn: NOW, staticDir: false });
    const res = await request(only).get('/');
    expect(res.status).toBe(404);
  });
});

describe('error handler: необработанное исключение', () => {
  it('500 в формате Error server_error, не html (E19)', async () => {
    const boom = createApp(makeDb(), {
      nowFn: () => {
        throw new Error('проверка 500-ветки');
      },
    });
    const res = await request(boom).get('/api/bookings');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ code: 'server_error', message: 'Внутренняя ошибка сервера' });
  });

  it('P2-1: URIError Express (битый percent-encoding в пути) → 400 validation, не 500', async () => {
    // %E0%A4%A — неполная UTF-8-последовательность, decodeURIComponent бросает
    // URIError { status: 400, expose: true }; до фикса проваливался в generic-500
    const api = createApp(makeDb(), { nowFn: NOW });
    const res = await request(api).get('/api/event-types/%E0%A4%A/slots?date=2026-09-10');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('P3 (C7): не-объектный JSON body — RU-текст, не «Поле «»» с англ. сообщением', async () => {
    const api = createApp(makeDb(), { nowFn: NOW });
    // scalar root отсекает strict-режим body-parser (entity.parse.failed),
    // array root доходит до zod как root-issue с пустым path
    const scalar = await request(api).post('/api/bookings').set('Content-Type', 'application/json').send('"строка"');
    expect(scalar.status).toBe(400);
    expect(scalar.body.code).toBe('validation');
    expect(scalar.body.message).toBe('Ожидался валидный JSON');
    const array = await request(api).post('/api/bookings').set('Content-Type', 'application/json').send('[1,2]');
    expect(array.status).toBe(400);
    expect(array.body.message).toBe('Ожидался объект в теле запроса');
  });

  it('P3 (E18): 413 на любом POST, не только application/json', async () => {
    const api = createApp(makeDb(), { nowFn: NOW });
    const res = await request(api)
      .post('/api/bookings')
      .set('Content-Type', 'text/plain')
      .send('x'.repeat(100_000));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('payload_too_large');
  });

  it('P3: x-powered-by не выдаётся (гигиена публичного прода)', async () => {
    const api = createApp(makeDb(), { nowFn: NOW });
    const res = await request(api).get('/api/event-types');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
