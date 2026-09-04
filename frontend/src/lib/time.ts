// Время в UI форматируется в фиксированной TZ сервиса (MSK), а не в поясе
// браузера (§11 решение 11): иначе гость из другого пояса увидит сетку
// «06:00–15:00» вместо 09:00–18:00.

const MSK_FMT_TIME = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
});

const MSK_FMT_DATE = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function formatTimeMsk(iso: string): string {
  return MSK_FMT_TIME.format(new Date(iso));
}

export function formatDateTimeMsk(iso: string): string {
  return `${MSK_FMT_DATE.format(new Date(iso))}, ${formatTimeMsk(iso)} МСК`;
}

// Календарный день (YYYY-MM-DD) момента в MSK — для запросов slots?date=
export function mskDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

// «вторник, 31 марта» — подписи выбранной даты в UI (та же маска, что у MSK_FMT_DATE)
export function formatDayLongMsk(iso: string): string {
  return MSK_FMT_DATE.format(new Date(iso));
}

// «2026-03-28-09:00» — формат слота как в референсной админке
export function formatSlotMsk(iso: string): string {
  const day = mskDay(iso);
  return `${day}-${formatTimeMsk(iso)}`;
}

// «27.03.2026, 14:40» — момент создания
export function formatCreatedMsk(iso: string): string {
  const date = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
  return `${date}, ${formatTimeMsk(iso)}`;
}
