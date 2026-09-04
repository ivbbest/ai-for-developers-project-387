// Единственный источник текущего времени (план 3.1): env NOW (ISO-строка)
// фиксирует «сейчас» для тестов и e2e, иначе — системные часы.
// Сервисы принимают nowFn-параметр (инъекция) — unit-тесты не трогают env.
let warned = false;

export function now(): Date {
  const fixed = process.env.NOW;
  if (fixed === undefined || fixed === '') return new Date();
  // механизм тестирования не должен молча действовать в проде: замороженный
  // календарь при живом сервисе — худший класс инцидентов
  if (!warned && process.env.NODE_ENV === 'production') {
    warned = true;
    console.warn('WARNING: NOW зафиксирован в production — календарь заморожен на этой дате');
  }
  const d = new Date(fixed);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`NOW должен быть валидной ISO-датой, получено: ${fixed}`);
  }
  return d;
}

export type NowFn = () => Date;
