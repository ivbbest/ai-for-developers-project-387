import { fileURLToPath } from 'node:url';
import { openDb, migrate } from './db/connection.js';
import { seed } from './db/seed.js';
import { createApp } from './app.js';

// PORT — обязательная env (§11 решение 13): без неё внятная ошибка, а не молчаливый 0.
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('PORT не задан или некорректен (пример: PORT=3001)');
  process.exit(1);
}

// Каталог сборки фронта (3.5): STATIC_DIR (Docker), по умолчанию ../../frontend/dist.
// Отсутствует (dev без сборки) — сервер поднимется только API.
const staticDir =
  process.env.STATIC_DIR || fileURLToPath(new URL('../../frontend/dist', import.meta.url));

// Сбой ФС/прав при открытии БД — внятный выход, а не голый стек.
function initDb() {
  try {
    const opened = openDb();
    migrate(opened);
    seed(opened);
    return opened;
  } catch (err) {
    console.error('не удалось открыть/подготовить БД — проверьте DATABASE_PATH и права:', (err as Error).message);
    process.exit(1);
  }
}
const db = initDb();

const server = createApp(db, { staticDir }).listen(port, () => {
  console.log(`cal-com API listening on :${port}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`порт ${port} уже занят — укажите другой PORT`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

// SIGTERM/SIGINT (Docker/Render stopping a container): дождаться текущих
// запросов, закрыть БД (WAL чекпоинтится на close) и выйти детерминированно.
// Повторный сигнал игнорируется (double-fire гонки нет), зависший keep-alive
// коннект не держит процесс — через 5 с жёсткий выход.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`received ${signal}, shutting down`);
  // зависший keep-alive не должен держать процесс: жёсткий выход через 5 с;
  // снимается, когда server.close() дождался текущих запросов
  const forceExit = setTimeout(() => process.exit(1), 5_000).unref();
  server.close(() => {
    clearTimeout(forceExit);
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
