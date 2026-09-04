# Как поднять сервис глобально (пошагово)

Статус: вариант A (Render) реализован — https://cal-com-97sr.onrender.com; вариант B (VPS) — запасной путь
Назначение: провести сервис от локальной сборки до публичного URL — с выбором
площадки, доменом и HTTPS. Минимальное требование проверки курса: Docker-образ,
автостарт, порт из `PORT`.

## Варианты площадки

| Критерий | A. PaaS (Render/Railway) | B. VPS + Docker + Caddy | C. PaaS с доменом (Fly.io/Railway paid) |
|---|---|---|---|
| Соответствие проверке курса (PORT) | ✅ | ✅ | ✅ |
| Цена | 0 (free tier) | ~300–600 ₽/мес | 0–5 $/мес |
| Данные после рестарта | ❌ эфемерный диск (seed пересоздаёт типы) | ✅ volume на диске VPS | зависит от тарифа |
| Свой домен + HTTPS | только на платном тарифе | ✅ Caddy, автоматический Let's Encrypt | ✅ |
| Время на поднятие | 15–30 мин | 1–2 ч (первый раз) | 30–60 мин |
| Лишний сервис в инфраструктуре | нет | нужен SSH-доступ к своей машине | нет |

**Рекомендация:** проверку курса закрывать вариантом A (быстро, бесплатно,
требование выполнено). Живое демо с сохранением броней и своим доменом —
вариант B: тот же Docker-образ, плюс volume решает проблему эфемерного диска.

## Вариант A — PaaS (Render; запасной Railway)

1. Аккаунт + репозиторий подключён (Read access).
2. New → Web Service → Build from repo (Dockerfile из корня).
3. Runtime default; **Port env: `PORT`** (Render сам выставит; совпадение с
   `ENV PORT=3000` в образе не обязательно — приложение читает env).
4. Deploy; ждать сборки; открыть `https://<service>.onrender.com`.
5. Проверка: `/` отдаёт UI, `GET /api/event-types` — JSON с seed-типами.
6. Особенности free tier: холодный старт после простоя (~30–60 с), диск эфемерный
   (после рестарта — чистая БД + seed; см. решение §11.10 плана).
7. Запасной Railway: тот же образ, `PORT`, URL вида `*.up.railway.com`.

## Вариант B — VPS (стабильное демо с доменом)

### 1. Купить VPS
- Любой провайдер с Ubuntu 24.04 LTS; минимальный тариф достаточен (1 vCPU, 1 ГБ, ~10 ГБ).
- Локация/оплата — по предпочтению; нужен root-доступ и проброс портов 80/443.

### 2. Первичная настройка (под root)
```bash
adduser deploy && usermod -aG docker deploy
# вход по ключу вместо пароля:
mkdir -p /home/deploy/.ssh && cp ~/.ssh/id_ed25519.pub /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
# файрвол:
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
# docker + compose plugin (официальный скрипт apt-репозитория docker.com)
```

### 3. Запуск приложения
```bash
# от пользователя deploy
git clone <репозиторий> ~/cal-com && cd ~/cal-com
# compose: образ из Dockerfile, PORT=3000 (канонический дефолт), volume для данных:
#   volumes: ["./data:/app/backend/data"]  ← брони переживают рестарты
#   (внутренний путь БД = backend/data/*.db, в образе — /app/backend/data)
docker compose up -d --build
curl -s localhost:3000/api/event-types   # seed-типы → ок
```

### 4. Домен
1. Регистрация у любого регистратора (для .ru/.rf — подтверждение данных, для .dev/.com — быстрее).
2. DNS: `A`-запись `cal.example.ru → <IP VPS>` (и `www CNAME`, если нужен).
3. Подождать распространение (`dig +short cal.example.ru`).

### 5. HTTPS (Caddy-реверс)
```
# Caddyfile
cal.example.ru {
    reverse_proxy localhost:3000
}
```
Caddy сам получает и продлевает сертификат Let's Encrypt. Проверка: `https://…`
открывает UI, в браузере замок; полное бронирование проходит вручную. Playwright-набор
на публичном URL «из коробки» не гоняется: `baseURL` в `e2e/playwright.config.ts` —
`localhost:5173`, прогон вовне требует правки конфига (baseURL + webServer).

### 6. Эксплуатация
- Обновление: `git pull && docker compose up -d --build`.
- Откат: релизы помечены тегами release-please (`v1.0.x`) —
  `git checkout v1.0.<prev> && docker compose up -d --build`; данные в volume
  не трогаются. На Render — через дашборд (выбор предыдущего commit/релиза,
  образ пересобирается из репозитория).
- Переменные образа (только имена; значения — на площадке): `PORT` — обязательна,
  без неё сервер падает с внятной ошибкой; `DATABASE_PATH` — путь БД (по умолчанию
  `backend/data/app.db`, на VPS попадает в volume); `STATIC_DIR` — каталог сборки
  фронта (по умолчанию `frontend/dist` рядом); `NODE_ENV` — в образе `production`;
  `NOW` — фиксация часов, только тесты/смоуки. `VITE_API_TARGET` — dev-прокси
  фронта, в прод-образе не участвует.
- Бэкап данных: cron `sqlite3 ~/cal-com/data/app.db ".backup /backup/app-$(date +%F).db"` +
  ротация; копия хотя бы вне машины (object storage/rsync).
- Логи: `docker compose logs -f app`; рестарт сервиса после перезагрузки VPS —
  `restart: unless-stopped` в compose.

## Чек-лист приёмки «глобального» запуска

- [ ] Публичный URL (https) открывает UI; `/api/event-types` отвечает JSON.
- [ ] Полное бронирование проходит в браузере по публичному адресу.
- [ ] Порт читается из `PORT` (A) или явно настроен и открыт (B).
- [ ] Данные: A — seed после рестарта (принято); B — брони сохраняются (volume) и есть бэкап.
- [ ] Ссылка добавлена в README репозитория.
