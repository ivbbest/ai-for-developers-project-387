import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { openDb, migrate, type Db } from '../src/db/connection.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

describe('GET /api/event-types', () => {
  let db: Db;
  beforeEach(() => {
    db = openDb(':memory:'); // пустая БД — как первый старт на эфемерном диске
    migrate(db);
    seed(db);
  });

  it('отдаёт seed каталога полем в camelCase по контракту', async () => {
    const res = await request(createApp(db)).get('/api/event-types');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: 'meet-15', title: 'Встреча 15 минут', description: 'Короткий созвон на 15 минут', durationMinutes: 15 },
      { id: 'meet-30', title: 'Встреча 30 минут', description: 'Созвон на полчаса', durationMinutes: 30 },
    ]);
  });
});
