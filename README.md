# Календарь звонков (продолжение)


[![hexlet-check](https://github.com/ivbbest/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/ivbbest/ai-for-developers-project-387/actions)

Интегрируйте работу агентов в GitHub проект

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

Сервис бронирования календаря звонков: гость выбирает тип встречи, слот из
календаря и оставляет контакты; владелец видит предстоящие встречи и создаёт
новые типы событий. Контракт API (TypeSpec → OpenAPI) — единый источник правды
для фронтенда и бэкенда.

## Демо

https://ai-for-developers-project-387-670a.onrender.com — Render, бесплатный
тариф: после простоя первый запрос прогревается 30–60 с; диск эфемерный,
после рестарта база чистая с seed-типами.

## Стек

- Контракт: TypeSpec → OpenAPI (`contract/`) — единый источник правды для фронта и бэка
- Фронтенд: Vite, React, TypeScript, Tailwind, shadcn/ui, react-router
- Бэкенд: Node.js 24, Express 5, zod, SQLite (better-sqlite3)
- Тесты: smoke контракта (Prism) и стаба, юнит-тесты бэкенда (vitest),
  сквозные e2e (Playwright), сверка ответов с OpenAPI через prism-proxy
- Окружение разработки: все команды — в контейнере `node:24` (`./scripts/dev.sh`)

## Установка

Нужен Docker (или Node.js 24 и npm локально).

```bash
git clone https://github.com/ivbbest/ai-for-developers-project-387.git
cd ai-for-developers-project-387
npm install
```

## Запуск

В WSL-окружении без Linux-`node` все команды идут через dev-обёртку:
`./scripts/dev.sh <команда>`. Переменные окружения (`PORT`, `MOCK_PORT`,
`VITE_API_TARGET`, `NOW`) обёртка прокидывает из хоста.

**Фронтенд без бэкенда — на стабе контракта** (in-memory, с состоянием:
бронь → слот «Занято» → повтор даёт 409):

```bash
./scripts/dev.sh npm run start -w @cal-com/mock-server   # стаб на :4020
./scripts/dev.sh npm run dev -w frontend                 # :5173, /api → :4020
```

Открыть http://localhost:5173 — каталог, выбор слота, бронь, админка.

**Сборка контракта и проверки:**

```bash
./scripts/dev.sh npm run compile -w @cal-com/contract             # → contract/dist/openapi.yaml
./scripts/dev.sh npm run smoke -w @cal-com/contract               # Prism-smoke по контракту
./scripts/dev.sh npm run smoke -w @cal-com/mock-server            # сценарий на стабе
```

Юнит-тесты и проверки бэкенда:

```bash
./scripts/dev.sh npm test -w backend                       # хранилище, слоты, API (vitest)
./scripts/dev.sh npm run contract:check -w backend         # ответы бэкенда против OpenAPI (prism proxy)
./scripts/e2e.sh                                           # Playwright: полный сценарий (первый запуск
                                                           # сам поставит зависимости и соберёт образ)
```

**Прод-режим одним портом** (без Docker):

```bash
./scripts/dev.sh sh -c 'cd frontend && npm run build'   # сборка в frontend/dist
./scripts/dev.sh sh -c 'cd backend && npm run build'    # компиляция в backend/dist
PORT=3001 ./scripts/dev.sh node backend/dist/server.js  # :3001 — и UI, и API
```

Бэкенд сам раздаёт `frontend/dist` + SPA-fallback на не-`/api`-маршруты;
каталог сборки ищется по `STATIC_DIR` (Docker-переопределение) или рядом с собой.

**Docker** (то же приложение одним контейнером, `PORT` из env, по умолчанию 3000):

```bash
docker build -t cal-com .
docker run -p 3000:3000 -e PORT=3000 -v ./data:/app/backend/data cal-com
```

Контейнер работает от непривилегированного пользователя `node` (uid 1000) —
каталог `./data` на хосте должен принадлежать пользователю с таким uid
(в Linux/WSL это обычный пользователь; иначе `chown 1000:1000 ./data`).

## Как это работает

Гость: `/book` — каталог типов событий → `/book/:typeId` — календарь на 14 дней
и сетка слотов 09:00–18:00 МСК (шаг равен длительности типа, занятые помечены
«Занято») → форма Имя/Email/заметки → подтверждение. Конфликт слота при
бронировании возвращает 409, интерфейс показывает ошибку и обновляет сетку.

Владелец: `/admin` — предстоящие встречи, `/admin/new-type` — создание нового
типа события (читаемый id задаёт владелец). Авторизации нет по условию курса,
в демо используются только фиктивные данные.

## Воркфлоу агента

Репозиторий — учебный, и его предмет — процесс: ИИ-участник отвечает в issue,
разбирает задачи, правит свои PR после ревью и выходит по расписанию. Четыре
воркфлоу в `.github/workflows/`:

| Файл | Чем запускается | Модель | Назначение | Кто может вызвать | Где смотреть прогоны |
|---|---|---|---|---|---|
| `opencode.yml` | `issue_comment`, `pull_request_review_comment` (created) | `opencode/big-pickle` | Ответ по команде `/oc`/`/opencode` в треде issue или строке diff | владелец (`ivbbest`), только с командой | [run вызова из issue](https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33950008593) |
| `opencode-triage.yml` | `issues` (opened) | `opencode/big-pickle` | Автотриаж нового issue: причина · модули · путь, ответ комментарием | живой автор (`user.type == User`), аккаунт старше 30 дней | [run автотриажа](https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33951433854) |
| `opencode-review.yml` | `pull_request` (opened, synchronize, reopened, ready_for_review) | `opencode/big-pickle` | Авторевью человеческих PR по критериям (контракт, edge-кейсы, типы, стиль, тесты) | PR владельца; агентские PR ревьюит человек | [run ревью с APPROVED](https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33953894988) |
| `opencode-schedule.yml` | `schedule` (cron `0 3 * * *`, раз в сутки) + `workflow_dispatch` | `opencode/big-pickle` | Ночная проверка деплоя: Lighthouse → отчёт-артефакт → issue `perf-report` | расписание и владелец вручную | [run ручного запуска](https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33960207196) |

Модель одна на всех (big-pickle): задачи — разбор треда, ревью диффа, анализ
дайджеста замера — в неё укладываются, а вариативность моделей добавила бы
переменную там, где отлаживается процесс. `variant`/`agent` не используются.
Набор команд вызова задан явно (`mentions: /oc,/opencode`) в интерактиве;
в трёх остальных `mentions` не нужен — там нет комментария-триггера, роль
инструкции выполняет фиксированный `prompt`.

Права — по воркфлоу отдельно, запись только там, где агент сам создаёт
артефакты: интерактив и триаж — `id-token: write` + `contents: read`
(комментарии пишет GitHub App по OIDC); авторевью — плюс `pull-requests: write`
(ревью публикуется токеном раннера); расписание — `contents/pull-requests/issues:
write` (создаёт issue и комментарии по находкам). `actions/checkout` везде с
`persist-credentials: false`. Ключ провайдера — только в секрете
`OPENCODE_API_KEY`, в файлах репозитория его нет.

`share: false` во всех четырёх: репозиторий публичный, сессии агента с
контекстом проекта наружу не уходят.

Расход: по плану — один ночной прогон в сутки плюс интерактивы по вызову
(каждый — минуты модельного времени); страховка — лимит расходов с
уведомлением в кабинете провайдера. Анти-петля: комментарии ботов и
собственного приложения отсекаются условиями (`user.type`, автор), обычный
комментарий владельца без команды не запускает работу; после каждого ответа
агента новых прогонов на тот же тред нет (проверено списками прогонов).

Самооценка процесса: с первого прохода — установка App, интерактив и ответ в
issue, автотриаж, полный цикл «fix → ревью → релиз», тег v1.0.3. С итерацией —
фильтр команды в условии (экшен ошибается на комментарии без команды, а не
скипает), явный `GITHUB_TOKEN` в режимах App-токена, Conventional-заголовок PR
для релизного цикла, дайджест Lighthouse-JSON (полный файл не влезал в
таймаут). Детали — в `docs/agent-decisions.md`.

---
<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
