import type { Db } from '../db/connection.js';
import type { EventType } from '../types.js';

interface EventTypeRow {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
}

function toEventType(row: EventTypeRow): EventType {
  return {
    id: row.id,
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    durationMinutes: row.duration_minutes,
  };
}

export function listEventTypes(db: Db): EventType[] {
  const rows = db
    .prepare('SELECT id, title, description, duration_minutes FROM event_types ORDER BY id')
    .all() as EventTypeRow[];
  return rows.map(toEventType);
}

export function getEventType(db: Db, id: string): EventType | undefined {
  const row = db
    .prepare('SELECT id, title, description, duration_minutes FROM event_types WHERE id = ?')
    .get(id) as EventTypeRow | undefined;
  return row ? toEventType(row) : undefined;
}

// Всегда ON CONFLICT(id) DO NOTHING: и идемпотентный seed, и 409 duplicate_id
// в POST используют один механизм — changes===0 при коллизии PK. Отдельная
// plain-ветка без DO NOTHING в проде не вызывалась никогда (мёртвый код удалён
// по ревью); другие нарушения (NOT NULL, CHECK) бросаются одинаково в обоих
// вызывающих путях — seed и POST.
const INSERT_SQL = `INSERT INTO event_types (id, title, description, duration_minutes)
     VALUES (@id, @title, @description, @durationMinutes) ON CONFLICT(id) DO NOTHING`;

export function insertEventType(db: Db, et: EventType): number {
  const info = db.prepare(INSERT_SQL).run({
    id: et.id,
    title: et.title,
    description: et.description ?? null,
    durationMinutes: et.durationMinutes,
  });
  return info.changes;
}
