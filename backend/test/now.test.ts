import { afterEach, describe, expect, it } from 'vitest';
import { now } from '../src/services/now.js';
import { MSK_OFFSET_MINUTES, SERVICE_TZ } from '../src/config.js';

describe('now(): единственный источник текущего времени', () => {
  const saved = process.env.NOW;
  afterEach(() => {
    if (saved === undefined) delete process.env.NOW;
    else process.env.NOW = saved;
  });

  it('env NOW фиксирует время', () => {
    process.env.NOW = '2026-09-10T06:15:00Z';
    expect(now().toISOString()).toBe('2026-09-10T06:15:00.000Z');
  });

  it('без NOW — системные часы', () => {
    delete process.env.NOW;
    const before = Date.now();
    const t = now().getTime();
    // допуск ±3 c: под нагрузкой CI секунда может не хватить (раунд 6 PR #10)
    expect(t).toBeGreaterThanOrEqual(before - 3000);
    expect(t).toBeLessThanOrEqual(Date.now() + 3000);
  });

  it('кривой NOW — явная ошибка, а не молчаливый системный час', () => {
    process.env.NOW = 'вчера-послезавтра';
    expect(() => now()).toThrow(/NOW/);
  });
});

describe('TZ сервиса Europe/Moscow', () => {
  // Константа +03:00 сверяется с Intl на зимней и летней датах:
  // если runtime-данные о поясе разойдутся — упадёт тест, а не поедет сетка слотов.
  for (const sample of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z']) {
    it(`смещение +03:00 на ${sample}`, () => {
      const label = new Intl.DateTimeFormat('en-US', {
        timeZone: SERVICE_TZ,
        timeZoneName: 'longOffset',
      }).formatToParts(new Date(sample)).find((p) => p.type === 'timeZoneName')?.value;
      expect(label).toBe('GMT+03:00');
      expect(MSK_OFFSET_MINUTES).toBe(180);
    });
  }
});
