// Схема SQLite. id Booking — uuid строка; время — TEXT в ISO UTC
// (лексикографически сортируется как хронология).
// CHECK-и — defense-in-depth: app-слой валидирует сам (E12, end>start),
// ограничения не дают ручным правкам/багам испортить данные молча.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS event_types (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT,
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 540 AND duration_minutes % 5 = 0)
);

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  event_type_id  TEXT NOT NULL REFERENCES event_types(id),
  start          TEXT NOT NULL,
  end            TEXT NOT NULL CHECK (end > start),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL,
  notes          TEXT,
  created_at     TEXT NOT NULL
);

-- пересечения ищутся по двум границам интервала: составной индекс даёт
-- index-only скан по предикату start < @end AND end > @start
CREATE INDEX IF NOT EXISTS bookings_start_end_idx ON bookings(start, end);
`;
