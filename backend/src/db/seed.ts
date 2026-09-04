import type { Db } from './connection.js';
import { insertEventType } from '../repositories/eventTypes.js';
import type { EventType } from '../types.js';

// Seed типов по спеке; идемпотентен через ON CONFLICT(id) DO NOTHING — диск Render
// эфемерен (§11 решение 10), файл может быть пуст/стёрт, seed пересоздаёт.
// Поля правок не меняются: если тип уже есть, оставляем как есть (владелец
// мог создать свой id; сид не перетирает данные).
export const SEED_EVENT_TYPES: EventType[] = [
  { id: 'meet-15', title: 'Встреча 15 минут', description: 'Короткий созвон на 15 минут', durationMinutes: 15 },
  { id: 'meet-30', title: 'Встреча 30 минут', description: 'Созвон на полчаса', durationMinutes: 30 },
];

export function seed(db: Db): void {
  for (const et of SEED_EVENT_TYPES) {
    insertEventType(db, et);
  }
}
