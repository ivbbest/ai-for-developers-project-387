import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';

export type Db = Database.Database;

// Путь к файлу БД: DATABASE_PATH (прод/Docker), по умолчанию backend/data/app.db.
// ':memory:' — для юнит-тестов.
export function defaultDbPath(): string {
  // fileURLToPath, а не URL.pathname: pathname даёт /E:/… и %20-спейсы на Windows
  // `||`, а не `??`: dev-обёртка прокидывает переменную пустой строкой,
  // путь не должен превращаться в ''
  return process.env.DATABASE_PATH || fileURLToPath(new URL('../../data/app.db', import.meta.url));
}

export function openDb(path: string = defaultDbPath()): Db {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  // WAL — штатный режим для файла-БД (на :memory: silently no-op); FK включаем явно:
  // SQLite по умолчанию их не проверяет
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function migrate(db: Db): void {
  db.exec(SCHEMA_SQL);
}
