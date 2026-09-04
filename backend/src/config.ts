// Константы сервиса из контракта (docs/specs/api-contract.md, решения C2–C4).
// Europe/Moscow — фиксированный пояс: с 2014 года без перехода на летнее время,
// смещение +03:00 постоянно. Тест now.test.ts сверяет константу с Intl —
// если данные runtime разойдутся, упадёт тест, а не молча поедет сетка.
export const SERVICE_TZ = 'Europe/Moscow';
export const MSK_OFFSET_MINUTES = 180;

// Рабочие часы: 09:00–18:00 MSK, все 7 дней (C3)
export const WORK_START_MINUTE = 9 * 60;
export const WORK_END_MINUTE = 18 * 60;

// Окно записи: сегодня … сегодня+13 календарных дней MSK (C4)
export const WINDOW_DAYS = 14;
