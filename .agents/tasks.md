# Реестр задач проекта «Календарь звонков (продолжение)»

Файл в git (`.agents/` — публичная курируемая память): без секретов и PII.
Источник шагов — `input/user-story.txt` (6 шагов курса). Проект: репо
`ivbbest/ai-for-developers-project-387`, продолжение проекта 386
(локально `/mnt/e/hexlet/cal-com`, v1.0.2).

Проверяется **процесс**: продукт не растёт, но после каждого шага остаются
видимые следы — прогоны Actions, ответы агента в issue, PR с правками после
ревью, отчёт регулярной проверки. «Тестом» слоя здесь является след в GitHub.

Реестр актуализирован 2026-09-04 по итогам пяти ревью каркаса
(архив — `.agents/archive/review-*.md`, вне git). Все находки внесены в
задачи; противоречия между ревью разрешены решениями D1–D16 ниже — повторное
их «переоткрытие» на шагах не требуется, только фактическая проверка.
Ревью реестра (`review-task-list.md`, R1–R10) сверено с фактами 386
(`git ls-files -s`, release-please-конфиг, e2e/.dockerignore, favicon):
R1–R9 приняты (R1 → D16), R10 отклонён — причина зафиксирована в P.2.

## Правила ведения

- **Git-workflow (обновлён владельцем 2026-09-04).** Ветка `<тип>/<тема>` от `main`
  на каждую существенную разработку; коммит-чекпоинт; **push и PR — локальный агент**
  (scoped-токен только на 387, разрешения в локальном конфиге opencode, вне git);
  **мерж агента — после зелёных проверок, разбора замечаний и `/oc review`**;
  force/удаление remote-веток/`hexlet-check.yml` — пользователь; зависимая работа —
  на паузе до мержа зависимости. Агент в GitHub Actions (шаги 2–5) — правами GitHub App.
- **Коммиты — Conventional Commits** (`feat:`/`fix:`/`docs:`/`ci:`/`chore:`):
  их собирает release-please; правило проверяется и на коммитах агента (шаг 4).
- **Публичная гигиена**: в коде/коммитах/PR/README/docs — без ИИ-формулировок
  и ссылок на `AGENTS.md`/`.agents`. Операционная проверка перед сдачей:
  `git log/diff` на слова «improved|enhanced|as an AI|refactored for better»
  и на `AGENTS.md|.agents` — пусто (исключения — эта память и planning-доки).
- **Секреты**: значения не читать/не писать/не логировать; ключ провайдера —
  только в GitHub Secrets (добавляет только пользователь).
- **Анти-петля**: каждый интерактивный воркфлоу проверять на запуск от
  комментариев ботов/App. **Операционный критерий**: после ответа агента нет
  нового прогона того же воркфлоу на тот же issue/PR в течение 2 минут
  (`gh run list --workflow=… --limit`). Доказательство — ссылкой на список
  прогонов, а не «прочитали условие».
- **След = ссылка, не чекбокс.** `[x]` ставится только с URL (run/issue/PR/
  comment) или SHA; ритуал конца шага: «все `[x]` шага имеют доказательство».
- **Статусы:** `[ ]` todo · `[~]` in_progress · `[x]` done (дата/SHA/ссылка).
  `[x]` — только когда PR слит в `main` и после мержа проект не упал (CI на
  `main` зелёный, «след» виден в GitHub); до мержа — `[~]`, даже с открытым PR
  (можно очищать контекст и возвращаться к реестру без «почти готово»).
- **Ритуал конца шага**: уроки — в конец `mem/learnings.md`; итоги (в т.ч.
  пометки «с первого прохода» vs «потребовала итерация» — данные для
  самооценки шага 6) — в `context.md`; обновить `mem/MEMORY.md`, `AGENTS.md`
  (если шаг изменил правила/команды) и этот реестр; перепроверить
  V-маршрут `docs/reading-guide.md`.
- **Откат при петле**: обнаружить → пользователя просит disable workflow в
  Actions (Settings → Actions → disable) → исправить условие → re-enable →
  повторный тест анти-петли; случай записать в learnings.

## Принятые решения (консолидация ревью 2026-09-04; не переоткрывать)

| # | Решение | Обоснование /source |
|---|---|---|
| D1 | `opencode*.yml` из 386 **не переносятся** на шаге 1; каждый создаётся в начале своего шага (2/3/4/5) по образцу 386 (файлы 386 — только текст-референс) | воркфлоу активен с момента мержа в main: триаж разбирал бы issue шага 2, ревью — PR переноса, schedule падал бы без ключа до 2.2; след шага 2 «воркфлоу в main» размывался |
| D2 | Интерактив: `permissions: id-token: write` + `contents: read` | checkout без contents:read падает (permissions по умолчанию → none); «минимальные» = без *write* кроме id-token; аудит 6.3 read-права не трогает |
| D3 | Таймаут — job-level `timeout-minutes` (интерактив 60, остальные 20); параметра `timeout` у экшена нет | конфиг экшена: model, agent, share, prompt, mentions, variant, oidc_base_url, use_github_token |
| D4 | Авторевью — режим курса: `use_github_token: true` + read-права + `id-token: write` (не App-режим 386); на 4.7 проверить фактом, что замечания появились; если read не даёт писать ревью — поднять `pull-requests: write` и записать причину | один механизм, а не «оба на всякий случай»; шаг 6 режет лишнее |
| D5 | Демо авторевью — на **человеческом** PR (фильтр `user.login == 'ivbbest'` остаётся); агентские PR (`opencode/*`) ревьюит человек | PR от App фильтр отсекает; расширять фильтр = двойной разбор агентских PR + расход токенов |
| D6 | Триаж: guard `github.event_name == 'issues' && !github.event.issue.pull_request && github.event.issue.user.type == 'User'` + возраст аккаунта ≥30 дней | PR — тоже issue (иначе триаж комментирует каждый PR); issue от schedule-агента не получает двойной разбор (боты: `user.type != 'User'`) |
| D7 | Schedule: права по тексту курса — `id-token: write`, `contents: write`, `pull-requests: write`, `issues: write`; runbook 386 по правам не считать истиной (расходится с собственным шаблоном) | курс требует 4 write; факт 386 (`contents: read`, без PR) шагу 5 не соответствует |
| D8 | Cron schedule: `0 3 * * *` (ежедневно, 06:00 МСК) + why-комментарий в файле | требование «не чаще раза в сутки»; баланс покрытия и расхода; cron 386 (`0 9 * * 1`) не переносится |
| D9 | Релизы: manifest остаётся `1.0.2`, `CHANGELOG.md` **не переносится** (ссылки на несуществующие теги 387); release-please соберёт новый с первого релиза; версия после первого `fix:` → 1.0.3 (демонстрирует SemVer fix→patch на 4.14); при непредсказуемом поведении первого release-PR — fallback: manifest `0.0.0` и фиксация в learnings | тегов в 387 нет; fresh-CHANGELOG даёт чистую демо-историю |
| D10 | Установка App — **вручную**: расширить доступ существующего opencode-agent (Configure → Add repository 387), сохранит права contents/PR/issues для `/oc fix`; мастер `opencode github install` не использовать (генерирует свой opencode.yml: `@latest`, без фильтра автора и `share: false`) | App аккаунт-варный, ставится не «новый», а расширение; решение зафиксировать в context.md |
| D11 | В триаже `workflow_dispatch` **нет** (у dispatch нет issue-контекста — prompt не к чему применять); ручной повтор = `/oc explain` в треде | доки: «output goes to logs and PRs» |
| D12 | Интерактив: `mentions: /oc,/opencode` задаётся параметром экшена (первичная фильтрация команды) + второй уровень `if:` по автору (не бот, `ivbbest`) | курс: набор задаётся mentions; ручной `if` 386 — отступление, не воспроизводим |
| D13 | Lighthouse меряет **деплой 387**: пользователь создаёт Render-сервис из репо 387 (задача 1.6); фолбэк (демо 386) — только с явной записью причины в README | след шага 5 должен относиться к перенесённому приложению, а не чужой инфраструктуре |
| D14 | Модель на всех воркфлоу — `opencode/big-pickle` (как в 386, практично и дёшево); единообразие **записано как осознанное решение** в README-таблицу с колонкой «почему эта модель»; фактические `model`/`variant` фиксируются при создании каждого воркфлоу | «модель под задачу» допустима объяснением; `variant`/`agent` не используем (YAGNI) — прочерк в таблице |
| D15 | Каждый opencode-воркфлоу содержит `concurrency: group: opencode-<workflow>[-<issue-context>], cancel-in-progress: false` | в 386 не было: параллельные вызовы/наложение ночного прогона |
| D16 | Коммиты переноса 1.5a–c — `chore:`/`docs:`, **без `feat:`/`fix:`**; гейт 1.5f: release-please зелёный **и без создания release-PR** | в 387 нет тегов — release-please считает версию по всей истории; один `feat:` открыл бы release-PR 1.1.0 на шаге 1 и обесценил демо D9 (`fix:` → 1.0.3 на шаге 4); fallback D9 от этого не защищает (он про отвалившийся манифест) |

---

## Настройка проекта (старт 2026-09-04)

- [x] Склонирован репозиторий 387 в `/mnt/e/hexlet/cal-com-continue`
      (main `6c8b049`: README-шаблон курса + `hexlet-check.yml`)
- [x] Изучен предшественник 386 (код, docs, память, воркфлоу, CI/CD, демо)
- [x] Созданы `AGENTS.md`, `.gitignore`, каркас `.agents/`
- [x] `input/` исключён локально (`.git/info/exclude`); скиллы `.opencode/`
      перенесены (локально, вне git)
- [x] Прогнаны 5 ревью каркаса (последнее — ревью самого реестра,
      `review-task-list.md` R1–R10, проверено фактами 386), находки
      консолидированы в этот реестр (R10 отклонён, причина в P.2),
      ревью-файлы — в `.agents/archive/` (вне git) — 2026-09-04
- [x] Коммит + пуш каркаса контекста в `main` — пользователь. Исключение из
      git-workflow (прямой пуш без ветки/PR), осознанное: каркас — не код,
      ревьюить нечего; прецедента на шаги 1–6 не создаёт — 2026-09-04,
      main `6da0890`, hexlet-check зелёный
      https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33887305457
- [x] После коммита каркаса: обновить ожидаемый статус в V1
      `docs/reading-guide.md` (там зафиксирован `git status` с untracked-файлами
      каркаса — после коммита разойдётся с фактом) — влито PR #1
      https://github.com/ivbbest/ai-for-developers-project-387/pull/1

---

## Пред-шаг (пользователь, до первого пуша) — настройки репозитория

Атомарные действия владельца; без них шаги 1 и 4 падают в самый неудобный
момент (урок 386: release-please умирает в конце последнего прогона).

- [x] P.1 Пользователь: секрет `HEXLET_ID` → Settings → Secrets and
      variables → Actions (нужен `hexlet-check.yml`) — подтверждён в репе
      2026-09-04 (`gh secret list`: HEXLET_ID от 2026-09-04T13:37Z)
- [x] P.2 Пользователь: Settings → Actions → General → **Allow GitHub Actions
      to create and approve pull requests** (нужен release-please на шаге 4) —
      включено, проверено API 2026-09-04 (`can_approve_pull_request_reviews: true`).
      Область действия — только PR, создаваемые GITHUB_TOKEN воркфлоу: PR
      агента идут через GitHub App и от переключателя не зависят,
      интерактив/триаж PR не создают вовсе (решение по замечанию R10 —
      «нужен до шага 2» отклонено)
- [x] P.3 Пользователь: секрет `OPENCODE_API_KEY` (значение — только руками;
      имя совпадает с env в будущих воркфлоу; в доках opencode пример с
      `ANTHROPIC_API_KEY` — не перепутать) + лимит расходов с уведомлением в
      кабинете провайдера — секрет подтверждён 2026-09-05 (`gh secret list`:
      OPENCODE_API_KEY от 2026-09-05T05:58Z); лимит расходов в кабинете
      провайдера — на владельце, проверка факта — при первом же расходе
      (шаг 2.9)
- [x] P.4 Пользователь: GitHub App opencode-agent → Configure → добавить
      репозиторий 387 (D10; заодно проверить, что 386 остаётся в доступе,
      пока нужен как референс) — подтверждено владельцем 2026-09-05
      («установлено»); 386 остаётся в доступе (`gh api`: push-права есть)

---

## Шаг 1 — Перенос кода + план развития — ветки `chore/migrate-app` и `docs/development-plan`

> Разбивка по правилу «ветка на каждую существенную разработку» (2026-09-04):
> перенос+актуализация (1.1–1.3, 1.5a–b) — `chore/migrate-app`; план развития
> (1.4, 1.5c) — `docs/development-plan`, **на паузе до мержа переноса**
> (баги плана воспроизводятся на перенесённом коде). Имя ветки `chore/…`, а не
> `feat/…`: коммиты переноса — `chore:`/`docs:` (D16), чтобы имя не расходилось
> с содержанием.

**Текущий статус (2026-09-05): шаг 1 закрыт, кроме деплоя 1.6.** `chore/migrate-app`
(`146507c` перенос + `e9a3fbb` актуализация) влита в main PR #2
https://github.com/ivbbest/ai-for-developers-project-387/pull/2 (main `459e8c2`).
1.5d: hexlet-check на PR зелёный
https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33906183569.
1.5f на main: contract-sync
https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33906806589 ·
E2E https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33906806590 ·
Docker https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33906806610 ·
hexlet-check https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33906806753 ·
Release please https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33906806712 —
все зелёные, **release-PR нет, тегов нет (гейт D16 ✓)**. P.2 включён
(`can_approve_pull_request_reviews: true`, проверено API). План развития (1.4,
1.5c) влит PR #7 → main `1a888ea`, hexlet-check/release-please на main зелёные
https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33950502413.
Остаётся в шаге 1: деплой 1.6 (пользователь).



> Из user-story: «Репозиторий предыдущего проекта берётся целиком: приложение,
> тесты, линтеры, прогон в GitHub Actions, release-please и AGENTS.md».
> Требования: ① код в новом репо, автотест зелёный; ② план развития: ≥1 фича
> и ≥1 баг, каждый понятен без пересказа; задачи плана — «жалоба пользователя,
> без готового решения внутри».

**Зависимости:** P.1 (hexlet-check на PR). P.2 — до первого мержа в main.

### 1.1 Что перенести (содержимое, без git-истории 386)

След: коммит `146507c` (PR #2, влито в main `459e8c2`).

Каждый пункт — атомарен: скопировал список файлов → проверил `git status`.

- [x] 1.1a Контракт: `contract/` — `main.tsp`, `models.tsp`, `routes.tsp`,
      `tspconfig.yaml`, `package.json`, `smoke.sh`, `dist/openapi.yaml`
      (артефакт коммитится — источник правды)
- [x] 1.1b Стаб: `contract/mock-server/` (server.js, package.json, smoke.sh)
- [x] 1.1c Фронт: `frontend/` (src, **`public/` — favicon.svg, ссылка из
      index.html; без него Vite теряет favicon при сборке**, index.html,
      vite.config.ts, components.json, tsconfig-ы, package.json; `dist/`
      не тащить — собирается)
- [x] 1.1d Бэк: `backend/` (src, test, scripts/contract-check.sh, package.json,
      tsconfig-и; `dist/` и `data/` не тащить — `data/` содержит PII гостей)
- [x] 1.1e E2E: **весь** `e2e/` — `playwright.config.ts`, `tests/booking.spec.ts`,
      `package.json`, `package-lock.json`, `Dockerfile`, `.dockerignore`,
      `env.ts`
      (e2e — НЕ workspace: отдельный `npm ci`; без Dockerfile/env.ts прогон
      1.3g невоспроизводим)
- [x] 1.1f Корень: `package.json` (workspaces), `package-lock.json`,
      `Dockerfile`, `.dockerignore`, `docker-compose.dev.yml`, `scripts/`
      (`dev.sh`, `e2e.sh`); `.gitignore` — взять за основу файл 386 и
      дополнить каркасным (не склеивать «как есть»: дубли/пропуски),
      проверить покрытие `node_modules/`, `*/dist/`, `backend/data/`, `.env`
- [x] 1.1g Релизы (D9): `release-please-config.json` и
      `.release-please-manifest.json` (версия 1.0.2) — перенести **как есть,
      без `tag-prefix`** (в 386 его нет; теги `cal-com-vX.Y.Z` образуются из
      имени пакета `cal-com` — в 387 будет тот же формат, ждать его в 4.14);
      `CHANGELOG.md` — **не переносить** (решено)
- [x] 1.1h Документация: `docs/` — `project-understanding.md`,
      `decision-guide.md`, `deploy-global.md`, `specs/api-contract.md`,
      `archive/` (work-plan, specs-TEMPLATE); НЕ переносить
      `docs/review-recommendations.md` 386 (продуктовое ревью старого кода);
      `docs/specs/TEMPLATE.md` — создать в 387 (из архивного шаблона) —
      нужен для SDD-цикла шага 3
- [x] 1.1i CI-workflow'ы: `contract-sync.yml`, `e2e.yml`, `docker.yml`,
      `release-please.yml` — перенести; `hexlet-check.yml` нового репо **не
      трогать и не заменять**; `.github/workflows/README.md` 386 — не
      перезатирать шаблонный файл 387 без сверки содержимого. **R5:** у
      `e2e.yml` why-комментарии ссылаются на инфраструктуру 386 (self-hosted
      runner, недоступный CDN релизов GitHub → node:24 + сборка better-sqlite3
      из исходников). При переносе сверить с фактическим runner'ом 387: если
      окружение другое — комментарии станут ложными, а красные прогоны 1.5f
      разбирать по реальному раннеру (gh-fix-ci), а не по тексту из 386
- [x] 1.1j `opencode*.yml` — **НЕ переносить** (D1); создавать на шагах 2–5
      по образцу 386
- [x] 1.1k НЕ переносить: `node_modules/`, `*/dist/`, `backend/data/`,
      `.env`, `input/`, `.agents/` 386, `docs/review-recommendations.md`,
      `e2e/test-results/` (локальный артефакт Playwright, в git 386 нет),
      `.opencode/`, `skills-lock.json` (локальная инструментальная обвязка —
      `cp -a` прихватывает их из рабочего дерева 386)

### 1.2 Актуализация под новый репозиторий

След: коммит `e9a3fbb` (PR #2, влито в main `459e8c2`).

- [x] 1.2a README.md: разделы «Стек / Установка / Запуск / Демо» из README
      386; клон-секция — URL репо 387; **обязательно** указать обёртку
      `./scripts/dev.sh` (без linux-node на хосте прямые `npm run` ломаются);
      бейдж hexlet-check уже 387
- [x] 1.2b Заменить ссылки на 386 во всех перенесённых файлах:
      `grep -rn "project-386\|cal-com-97sr\|github-integration" . --exclude-dir=node_modules`
      — известны: `docs/specs/api-contract.md:7` (живой issue-ссылка),
      ссылки на runbook 386 в docs/workflow (runbook в перенесённых файлах
      быть не должен — остаётся в 386)
- [x] 1.2c Обновить устаревшие числа в перенесённом `decision-guide.md`
      (§4.6/§8): smoke контракта 28→27, vitest 64→71, e2e 6→9 (факты
      подтверждены grep по 386: 27/46/71/9/9)
- [x] 1.2d `AGENTS.md` — реальные команды (агент в Actions читает его):
      полный CI-гейт, как в `e2e.yml` job checks: `npm ci`,
      `npm run compile -w @cal-com/contract`, smoke контракта и стаба,
      `npm test -w backend`, `npm run contract:check -w backend`,
      `npm run typecheck -w backend`, `npm run build -w backend`,
      `npm run lint -w frontend`, `./scripts/e2e.sh`, docker-сборка;
      путь монорепо и workspaces; формулировка про `opencode*.yml` —
      «создаются на шагах 2–5» (D1, уже приведена в согласованный вид)
- [x] 1.2e Секрет- и PII-проверка перенесённого:
      `grep -ri "api_key\|token\|password" --include='*.yml' --include='*.json' .`
      (только имена переменных) и `git ls-files | grep -i "backend/data/"`
      (пусто)

### 1.3 Локальная верификация перенесённого (все команды — `./scripts/dev.sh`)

След: прогоны локально 2026-09-04 (выводы в context.md); повторены CI на PR #2 и main — ссылки в статус-блоке.

- [x] 1.3a `npm ci` из корня (workspaces поднимаются)
- [x] 1.3b `npm run compile -w @cal-com/contract` — чистый, openapi.yaml
      не отличается от закоммиченного
- [x] 1.3c `npm run smoke -w @cal-com/contract` (27 проверок) и
      `npm run smoke -w @cal-com/mock-server` (46 проверок) — зелёные
- [x] 1.3d `npm test -w backend` (vitest **72** — не 71: цикл now.test.ts:35 генерирует 2 теста из 1 декларации) — зелёные
- [x] 1.3e `npm run contract:check -w backend` (prism-proxy, 9 проверок +
      гейт Violation) — зелёный
- [x] 1.3f typecheck/build/lint-гейты: `npm run typecheck -w backend`,
      `npm run build -w backend`, `npm run lint -w frontend` — зелёные
- [x] 1.3g Сборка фронта + прод-режим одним портом (build frontend/backend,
      `PORT=3001 node backend/dist/server.js`) — UI и API живут
- [x] 1.3h `./scripts/e2e.sh` — 9 сценариев Playwright зелёные
- [x] 1.3i `docker build -t cal-com .` + smoke запущенного контейнера
      (API/статика/404-JSON/healthy/`USER node`)
- [x] 1.3j Исполняемость скриптов в git: `git ls-files -s scripts/*.sh
      contract/smoke.sh` — **ожидать `scripts/dev.sh` и `scripts/e2e.sh`
      = 100755, а `contract/smoke.sh` = 100644** (в индексе 386 так;
      вызывается `bash smoke.sh` из package.json — exec-бит не нужен, CI 386
      это доказывает; не «chmod +x до коммита», а свериться с фактом — R2)

### 1.4 План развития (`docs/development-plan.md`)

- [x] 1.4a Состав финализирован: баг — длинный email (воспроизведён), фича —
      отмена брони; второй баг исключён (не воспроизводится, см. 1.4c);
      список зафиксирован в context.md — 2026-09-05, PR #7
- [x] 1.4b Воспроизведён локально на main-коде: POST 255-символьного email →
      `400` «слишком длинный», 254 → `201`; контракт лимита не объявляет —
      2026-09-05, факт зафиксирован в плане (main `1a888ea`, раздел «Баг 1»)
- [x] 1.4c Кандидат 2 проверен и НЕ воспроизведён как баг: параллельные POST
      одного слота → `201`+`409 slot_conflict` (транзакция), «протухание»
      через полночь → `400 slot_out_of_window`, фронт обрабатывает оба
      (confirm.tsx:126, баннер+перезапрос). В план не включён, причина —
      в разделе «Исключено»
- [x] 1.4d Фича-кандидат 1 подтверждён: DELETE в контракте/бэке/фронте
      отсутствует; лёг в план
- [x] 1.4e Фича-кандидат 2 (напоминания) — отложен без срока: потребность
      не подтверждена, минимум закрыт (записано в «Исключено» плана)
- [x] 1.4f План написан в требуемом формате, жалобы текстовые, данные
      вымышленные; PR #7 → main `1a888ea`
      https://github.com/ivbbest/ai-for-developers-project-387/pull/7
      (ревью `/oc review` в треде: 2 замечания приняты коммитом `46e7e96`)
- [x] 1.4g Шаг курса помечен в каждой записи плана (issue — шаг 3, PR — шаг 4)

### 1.5 Выход в GitHub

- [x] 1.5a (`146507c`) Коммит-чекпоинт «перенос» — тип **`chore:`** (не `feat:` — D16:
      `feat:` на первом пуше в main без тегов откроет release-PR 1.1.0 уже
      на шаге 1 и обесценит демо D9), hygiene-греп чист
- [x] 1.5b (`e9a3fbb`) Коммит-чекпоинт «актуализация» (1.2) — тип **`chore:`**/**`docs:`**
      (D16)
- [x] 1.5c Коммит-чекпоинт «план развития» (1.4) — тип **`docs:`** (D16):
      `c46e8c0` + фикс по ревью `46e7e96`, влиты squash в main `1a888ea` (PR #7)
- [x] 1.5d Проверить hexlet-check **на PR переноса** (крутится на всех
      ветках) — зелёный до запроса ревью
- [x] 1.5e Пуш + PR (пользователь) → ревью → мерж (пользователь)
- [x] 1.5f После мержа: прогоны hexlet-check + contract-sync + e2e +
       docker.yml + release-please в Actions 387 — зелёные; **release-please
       зелёный И БЕЗ создания release-PR** (гейт D16: первый release-PR
       обязан появиться только на шаге 4 после `fix:`); красный —
       скилл `gh-fix-ci`, сопровождение PR до зелёного (обязанность агента);
       каждая ссылка-доказательство — в этот реестр

### 1.6 Деплой 387 (для следа шага 5, D13)

- [x] 1.6a Пользователь: Render-сервис создан 2026-09-05 (Deploy succeeded,
      `cal-com API listening on :10000`, first deploy source `6207b39`), URL
      https://ai-for-developers-project-387-670a.onrender.com
- [x] 1.6b Repository variable `APP_URL` заведена пользователем
      (`gh variable list`: APP_URL, 2026-09-05T09:05Z; с завершающим слэшем —
      воркфлоу нормализует)
- [x] 1.6c Smoke: warm-up+API с раннера GitHub (dispatch 33960207196 —
      warm-up success, Lighthouse снял живые цифры); локальный curl к
      render.com не проходит из рабочего окружения (сетевая блокировка — не баг
      сервиса, зафиксировано в learnings). URL в README («Демо») — PR #21,
      main `d1a204d`

**След шага**: рабочее приложение в main 387 + зелёные прогоны (ссылки) +
план развития + задеплоенный 387.

---

## Шаг 2 — Установка и настройка агента в GitHub

> Из user-story: три части — GitHub App, файл воркфлоу, ключ в секретах.
> Требования: ① App установлен; ② воркфлоу замержен в main; ③ события
> ограничены `types: [created]`, запуск по команде в тексте; ④ `id-token: write`
> + `persist-credentials: false`; ⑤ ключ только в секретах; ⑥ есть issue с
> ответом агента и видимый прогон в Actions.

**Зависимости:** шаг 1 замержен (агенту нужен рабочий код + актуальный
AGENTS.md в main); P.3, P.4.

- [x] 2.1 App: opencode-agent установлен на 387 (подтверждено владельцем
      2026-09-05, P.4; факт работы — ответ `opencode-agent` в issue #6)
- [x] 2.2 Актуальный релиз `anomalyco/opencode/github`: **v1.18.29**,
      SHA `16747470f976aca3d362ad730bcd3fe82ecc2c9a` (пины 386 v1.4.9
      устарели — записан свежий)
- [x] 2.3 `.github/workflows/opencode.yml` написан по инвариантам, PR #5 →
      main `6c7f2d6` https://github.com/ivbbest/ai-for-developers-project-387/pull/5
      - [x] 2.3a `on:` — `issue_comment` + `pull_request_review_comment`,
            оба `types: [created]`
      - [x] 2.3b `mentions: /oc,/opencode` параметром экшена (D12)
      - [x] 2.3c `if:` автор `ivbbest` + не бот + **проверка команды**
            (поправка к D12 по факту: без неё обычный комментарий владельца
            даёт красный прогон — экшен ошибается, а не скипает; PR #8,
            main `d00b1f4`)
      - [x] 2.3d `permissions: id-token: write` + `contents: read` (D2)
      - [x] 2.3e checkout `persist-credentials: false`, `fetch-depth: 1`,
            пин actions/checkout `3d3c42e…` v7.0.1
      - [x] 2.3f `model: opencode/big-pickle`, `share: false`,
            `timeout-minutes: 60`, пин SHA из 2.2, `concurrency` по треду
- [x] 2.4 Валидация перед пушем: actionlint (docker `rhysd/actionlint`) —
      файл чист (единственное замечание — уже существующее в docker.yml),
      YAML парсится
- [x] 2.5 Секрет-греп `sk-[A-Za-z0-9]` по `.github/` — пусто; в файле только
      `${{ secrets.OPENCODE_API_KEY }}` по имени
- [x] 2.6 `ci/opencode-github` → PR #5 (hexlet-check зелёный
      https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33949958534)
      → мерж в main `6c7f2d6`; follow-up guard — PR #8 → main `d00b1f4`
- [x] 2.7 Разбор воркфлоу: событие — комментарий (created) к issue/PR;
      пропуск — автор ivbbest, не бот, текст начинается с/содержит `/oc`
      или `/opencode`; права — id-token:write + contents:read (комментарий
      пишет App по OIDC); модель — big-pickle. Записан здесь + в context.md
- [x] 2.8 Issue-разведка #6 «Как устроен выбор слотов» + комментарий
      `/oc explain this issue`
      https://github.com/ivbbest/ai-for-developers-project-387/issues/6#issuecomment-5549986594
- [x] 2.9 Ответ App в треде (1888 символов, разбор по файлам/строкам кода):
      https://github.com/ivbbest/ai-for-developers-project-387/issues/6#issuecomment-5549987934
- [x] 2.10 Прогон: run 33950008593, `issue_comment`, success, 38 с
      https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33950008593
      (в логах: MODEL opencode/big-pickle, SHARE false, MENTIONS /oc,/opencode,
      шаг `run_opencode` outcome=success)
- [x] 2.11 Анти-петля: после ответа агента — единственный новый прогон
      33950038397 **skipped** (фильтр автора), далее 2+ минут новых нет
      (`gh run list --workflow=opencode.yml` на 06:34:40Z, список из 2 прогонов);
      повторное подтверждение после PR #8: обычный комментарий без команды →
      skipped 33950716153 (1 с), не failure
- [x] 2.12 Пометка «первый проход/итерация» — в context.md (воркфлоу/ответ —
      с первого прохода; фильтр команды в `if:` — потребовал итерацию)

**След шага**: issue с ответом агента + прогон в Actions (ссылки);
воркфлоу в main.

---

## Шаг 3 — Работа с issue и triage

> Из user-story: два способа позвать — комментарий (агент читает весь тред;
> `/oc explain` → разбор, `/oc fix` → ветка `opencode/*` + PR) и автотриаж на
> событии `issues` (**prompt обязателен** — комментария нет). Разбор полезен
> ровно насколько нечётка задача.
> Требования: ① issue-жалоба без решения; ② команда + ответ с разбором
> (причина, затронутый код, путь); ③ воркфлоу автотриажа с prompt, отработал
> на новой задаче; ④ в issue записано, что считается исправлением.

**Зависимости:** шаг 2 замержен (интерактив в main, App отвечает); issue-жалоба
из плана 1.4.

- [x] 3.1 Issue А #10 «Длинный рабочий адрес записывается обрезанным…» —
      тело = жалоба из плана 1.4 без файлов/решений
      https://github.com/ivbbest/ai-for-developers-project-387/issues/10
- [x] 3.2 `/oc explain this issue` → разбор за 42 с (run 33951021411):
      причина (скрытый лимит 254 в трёх слоях, контракт молчит), затронутые
      файлы со строками, направление правки
      https://github.com/ivbbest/ai-for-developers-project-387/issues/10#issuecomment-5550099417
- [x] 3.3 Разбор оценён: все три части на месте, причина подтверждена кодом
      (сверено с нашим repro 1.4b); уточняющие вопросы не потребовались
- [x] 3.4 Свободный текст после `/oc` («составь план исправления… критерии
      приёмки») → план из 5 шагов с проверками по слоям (run 33951098350,
      1m28s):
      https://github.com/ivbbest/ai-for-developers-project-387/issues/10#issuecomment-5550107681
- [x] 3.5 `.github/workflows/opencode-triage.yml` написан по инвариантам:
      - [x] 3.5a `on: issues, [opened]` + guard D6 (issues/не-PR/User) +
            возраст ≥30 дней (github-script v9.0.0 `3a2844b…`)
      - [x] 3.5b prompt новый: «причина · затронутые модули · путь, ответь
            комментарием, код не менять»
      - [x] 3.5c `id-token: write` + `contents: read`, `concurrency` по issue,
            `timeout-minutes: 20`, пины v1.18.29/checkout v7.0.1
      - [x] 3.5d `workflow_dispatch` нет (D11)
- [x] 3.6 Ветка `ci/opencode-triage` → PR #11 (hexlet-check зелёный,
      `/oc review` в трееде подтвердил инварианты и анти-петлю) → мерж
      https://github.com/ivbbest/ai-for-developers-project-387/pull/11
- [x] 3.7 Issue Б #12 «Не могу отменить свою бронь» — без команд; автотриаж
      сам разобрал за 3m22s (run 33951433854, `issues:opened`):
      https://github.com/ivbbest/ai-for-developers-project-387/issues/12
- [x] 3.8 Сравнение разборов А/Б записано комментарием в issue А (рядом с
      постановкой): тред+команда глубже (план с приёмкой), автотриаж —
      первичная сортировка по payload
      https://github.com/ivbbest/ai-for-developers-project-387/issues/10#issuecomment-5550178310
- [x] 3.9 Критерии «исправлено, когда…» в issue А — из формулировки агента
      (комментарий 3.4, чек-лист из 8 пунктов + «не входит в скоуп»)
- [x] 3.10 Анти-петля триажа: после комментария App в #12 — единственный
      прогон 33951433854, новых нет (`gh run list --workflow=opencode-triage.yml`
      на 07:06Z); событие `issues` на комментарий физически не приходит
- [x] 3.11 Следы здесь + context.md; пометка «первый проход/итерация»:
      шаг 3 — с первого прохода (issue А/Б, explain, план, триаж, анти-петля)

**След шага**: два разобранных issue (команда + автотриаж), прогон
triage-воркфлоу, постановка «что считается исправлением» — все со ссылками.

---

## Шаг 4 — От issue к pull request и ревью

> Из user-story: полный путь issue → PR → ревью → правки в той же ветке.
> Два канала обратной связи: `issue_comment` (PR технически issue) и
> `pull_request_review_comment` (контекст файла/строки приходит сам).
> Третий сценарий — авторевью на `pull_request` (prompt задаёт критерии;
> `use_github_token: true`). Мержит/одобряет человек. После мержа —
> release-PR от release-please.
> Требования: ① PR агента связан с issue; ② оба вида замечаний; ③ правки в той
> же ветке видны по коммитам; ④ авторевью с prompt оставил замечания;
> ⑤ коммиты агента — Conventional, release-please создал/обновил release-PR.

**Зависимости:** шаг 3 (issue А с критериями приёмки, триаж в main); P.2
(переключатель создания PR Actions — без него release-please упадёт в конце).

- [x] 4.1 `/oc fix` в issue А → ветка `opencode/issue10-20260905071319`,
      PR #15 (run вызова 33951934279):
      https://github.com/ivbbest/ai-for-developers-project-387/pull/15
- [x] 4.2 PR проверен: описание «что/почему» есть, состав — 6 продуктовых
      файлов (мусор убран замечанием 4.4), `Closes #10` в теле, имя ветки
      верное. **fetch-depth: 1 хватило** — App создал ветку с нуля и открыл
      PR без увеличения фикса (обещанная проверка 2.3e закрыта)
- [x] 4.3 Коммиты агента Conventional (`fix:`×3 после reword-замечания),
      hygiene-греп текстов коммитов и тела PR — чисто; squash в main
      `2fea0ec`
- [x] 4.4 Общий комментарий `/oc` (issue_comment): убрать `.agents/*` из
      PR → App удалил коммит `0e515e4` force-with-lease, ответ в треде
      https://github.com/ivbbest/ai-for-developers-project-387/pull/15#issuecomment-5550279913
- [x] 4.5 Инлайн-комментарий `/oc` к строке diff (pull_request_review_comment):
      добавить `aria-describedby` → коммит `782a04d`
      https://github.com/ivbbest/ai-for-developers-project-387/pull/15#discussion_r3939865697
- [x] 4.6 Та же ветка обновлена дважды (4.4, 4.5) + третий цикл — reword
      не-Conventional коммита по comment `/oc` (87db0df → 782a04d); ответы
      в треде, прогоны 33952550739/33952563064/33952874631
- [x] 4.7 `.github/workflows/opencode-review.yml` — PR #14 → main `0cb1b9a`:
      - [x] 4.7a `on: pull_request` types opened/synchronize/reopened/ready_for_review
      - [x] 4.7b `if:` автор `ivbbest` + не-draft (D5); skip подтверждён на
            #17 (review skipped, run 33954068330). На #15 авторевью не
            запускался вовсе — workflow для `pull_request` берётся из head-ветки
            PR, а `opencode-review.yml` появился в main позже открытия #15
      - [x] 4.7c prompt с 5 критериями + «не ревьюй коммиты opencode-agent[bot]»
      - [x] 4.7d `use_github_token: true`; факт прогона 33951997871 потребовал
            явного `GITHUB_TOKEN` env и подъёма `pull-requests: write` —
            эскалация D4 задокументирована why-комментарием в файле
- [x] 4.8 Ветка `ci/opencode-review` → PR #14 → мерж main `0cb1b9a`
      (hexlet-check зелёный; `/oc review` в трееде до мержа)
- [x] 4.9 Факт-проверка D4: авторевью пишет — APPROVED от `github-actions[bot]`
      на PR #16 (review pass 3m4s/1m1s, runs 33953491976/33953894988); на
      read-правах не проверялось (эскалация сделана по факту первой же ошибки
      токена). Анти-петля: ревью пишет comment/review-события, не PR-события —
      повторных прогонов нет (run list чист после каждого ревью)
- [x] 4.10 Замечания отработаны: нит `cancel-in-progress` в ревью #14 —
      аргумент в треде (осознанный трейд-офф D15, повторяет интерактив);
      ревью #16 замечаний не имел
- [x] 4.11 Демо авторевью на человеческом PR: #16 (`fix:`+`test:` из
      `fix/email-limit-trim-edge`) — review APPROVED
      https://github.com/ivbbest/ai-for-developers-project-387/pull/16
- [x] 4.12 Issue Б в шаг 4 не брался (демо полного цикла закрыто issue А);
      критерии приёмки в Б дописать перед `/oc fix` — переносится в шаг 5+
- [x] 4.13 PR А влит (main `2fea0ec`); release-please открыл release-PR #17
      `chore(main): release cal-com 1.0.3` (от `github-actions` — P.2
      подтверждён в деле)
- [x] 4.14 Release-PR: версия **1.0.3** (fix:→patch, D9 ✓ без fallback),
      CHANGELOG собран заново; мерж #17 → main `5875ed8`, тег
      `cal-com-v1.0.3` (5875ed8) и GitHub Release опубликованы; прогоны на
      main зелёные (hexlet-check 33954606140, contract-sync, E2E, Docker,
      Release please). Итерация: первый release-PR не появился с #15 —
      squash-заголовок «Email limit fix done…» не Conventional (урок в learnings)
- [x] 4.15 Следы здесь; пометка: с первого прохода — ветка/PR от App, оба
      канала замечаний, авторевью, тег; итерации — конвенция squash-заголовка
      (релизный цикл), GITHUB_TOKEN/write в режиме D4, action_required для
      ботовых PR (одобрение только в UI)

**След шага**: PR с историей «ревью → правки в той же ветке», замечания
авторевью, release-PR и тег — со ссылками.

---

## Шаг 5 — Регулярные задачи по расписанию

> Из user-story: ночная проверка, утром команда читает отчёт. Cron — 5 полей,
> UTC; рядом `workflow_dispatch`. Обязательны prompt и права на запись.
> Результат — артефакт прогона и/или issue. Сырые данные собирает обычный шаг
> (Lighthouse CLI), агент превращает в выводы. Не чаще раза в сутки. Адрес —
> repository variable.
> Требования: ① `schedule` + `workflow_dispatch` с cron; ② prompt + четыре
> права; ③ не чаще раза в сутки; ④ успешный прогон, отчёт артефактом/в задаче;
> ⑤ ≥1 issue по находкам.

**Зависимости:** шаги 3 (триаж с guard D6 — иначе агентский issue получит
двойной разбор) и 1.6 (деплой 387 + `APP_URL`; фолбэк 386 — только с явной
записью причины); P.3.

- [x] 5.1 `.github/workflows/opencode-schedule.yml` написан (PR #20 → main,
      итерации #22/#24):
      - [x] 5.1a `on: schedule` cron `0 3 * * *` (06:00 МСК, why-комментарий)
            + `workflow_dispatch`
      - [x] 5.1b Права D7: `id-token/contents/pull-requests/issues: write`
      - [x] 5.1c `concurrency`, пин SHA (v1.18.29), `model` big-pickle,
            `share: false`; `timeout-minutes`: 20 → **30** по факту dispatch
            33958460867 (job убит на 20 мин при разборе полного report.json)
- [x] 5.2 Шаг сбора данных:
      - [x] 5.2a Guard `test -n vars.APP_URL` — пустая переменная даёт красный
            прогон с внятной ошибкой (проверено: до деплоя guard не давал
            мусора; после — success в run 33960207196)
      - [x] 5.2b Warm-up `curl -sL --retry 3 --retry-delay 30` + API-сэмпл
            best-effort (замечание ревью #20: жёсткий `-fsS` валил job до
            graceful-пути); нормализация завершающего слэша APP_URL (PR #20)
      - [x] 5.2c `npx lighthouse` json + digest-шаг (jq, score<0.9) — PR #22,
            полный файл остаётся в артефактах
- [x] 5.3 Prompt: анализ дайджеста, 3 проблемы «что замерено/почему болит/что
      делать», perf-report.md, issue с меткой `perf-report`, дедуп
      «открытый issue — комментарием, новый не создавать»; запрет коммитов/PR
      (факт PR #23 — закрыт без мержа) + явный `GITHUB_TOKEN` для gh (PR #24)
- [x] 5.4 Артефакты: upload-artifact **v7.0.1** (актуальный пин вместо v4 из
      плана), имя `lighthouse-report-{run_number}`, `if: always()`;
      скачаны локально: report.json 406K + digest 3.4K + perf-report.md
- [x] 5.5 Метка `perf-report` создана (`gh label create`, 2026-09-05)
- [x] 5.6 Ветка `ci/opencode-schedule` → PR #20 (ревью до мержа, warm-up
      best-effort по замечанию) → main после готовности деплоя; итерации
      PR #22 (digest) и PR #24 (GITHUB_TOKEN) — тоже с ревью
- [x] 5.7 Dispatch 33960207196 — success за 2m32s (после digest), артефакты
      скачиваются:
      https://github.com/ivbbest/ai-for-developers-project-387/actions/runs/33960207196
- [x] 5.8 D6-guard: issue #25 создан `github-actions` (bot) — триаж его НЕ
      разобрал: комментариев нет, новых прогонов opencode-triage нет
      (`gh run list --workflow=opencode-triage.yml` — только старый #12):
      https://github.com/ivbbest/ai-for-developers-project-387/issues/25
- [x] 5.9 Issue #25 по реальным находкам (Performance 0.77: TBT 1010 мс,
      main-thread 2.3 с, unused JS 64 KiB) с целью-критерием
      «Performance ≥ 0.9, TBT < 200 мс, повторный замер»
- [~] 5.10 Ночной cron: первый плановый запуск 2026-09-06 03:00 UTC —
      проверить утром `gh run list --workflow=opencode-schedule.yml
      --event schedule`; заодно подтвердит дедуп (issue #25 → комментарий,
      не новый issue)
- [x] 5.11 Следы здесь + context.md; итерации: timeout/digest (#22),
      gh-auth/PR-обход (#23 закрыт → #24); первый проход: guard, warm-up,
      Lighthouse, артефакты, метка, D6-guard

**След шага**: прогон с артефактом-отчётом + issue из находок +
подтверждённый ночной запуск (ссылки).

---

## Шаг 6 — Финальная проверка интеграции

> Из user-story: новых сценариев нет — убедиться, что процесс предсказуем, и
> записать решения. Три места поломки: триггеры, права, расходы. Отдельно:
> `share` и круг вызывающих.
> Требования: ① во всех интерактивных — условие против ботов/App; ② `mentions`
> явно или причина дефолта в README; ③ права по воркфлоу отдельно, write только
> где нужно; ④ README-таблица воркфлоу; ⑤ решение по `share` записано;
> ⑥ самооценка.

**Зависимости:** шаги 2–5 замержены и следуются ссылками; решения D2–D16
уже приняты — здесь только фиксация фактов и живой аудит.

- [x] 6.1 Аудит триггеров всех opencode-воркфлоу (grep условий — ниже, все
       четыре файла): `on:`/types/`if:` —
       события от `github-actions[bot]`, `opencode-agent[bot]` отсекаются.
       **R9 — разделение способа проверки** (комментарий от App-бота человеком
       не воспроизводится):
       - [x] 6.1a прогонно (2026-09-05 10:22–10:24Z): обычный комментарий
             человека без команды в #6 → единственный новый прогон
             **skipped** 33960490559, за 2 минуты выполненного нет;
             повторный тест после PR #8 (33950716153 skipped за 1 с).
             Для триажа: комментарии в #10/#12/#25 не порождали прогонов
             (`issues` на комментарий не приходит) — run list: единственный
             прогон триажа старый, #12
       - [x] 6.1b статически: `opencode.yml:22-23` (`login == 'ivbbest'` +
             `type != 'Bot'`), `opencode-review.yml:16` (автор PR `ivbbest`),
             `opencode-triage.yml:19` (`issue.user.type == 'User'`);
             бот-кейсы этими строками и закрыты
- [x] 6.1c Пины: `grep "uses: " opencode*.yml` — все на 40-символьные SHA
      (opencode v1.18.29, checkout v7.0.1, github-script v9.0.0,
      upload-artifact v7.0.1); `@latest`/тег-ссылок нет
- [x] 6.2 `mentions: /oc,/opencode` — `opencode.yml:54` (явно, D12); в
      triage/review/schedule нет комментария-триггера — причина записана в
      README («роль инструкции выполняет фиксированный prompt»)
- [x] 6.3 Права табличкой — в README: интерактив/триаж `id-token: write` +
      `contents: read` (D2, write нет вообще); review + `pull-requests: write`
      (фактический набор после 4.9, причина в why-комментарии файла);
      schedule — четыре write (D7, только там, где создаются issue/комментарии).
      «read для checkout — норма» учтено в формулировках D2
- [x] 6.4 Модели: `grep model:` — 4× `opencode/big-pickle`, `variant`/`agent`
      не заданы ни в одном файле; единообразие с причиной — в README (D14)
- [x] 6.5 README «Воркфлоу агента» — таблица файл/событие/модель+почему/
      назначение/круг вызывающих/живые ссылки на runs (33950008593,
      33951433854, 33953894988, 33960207196); PR #27 → main
- [x] 6.6 `share: false` во всех четырёх (grep подтвердил) + однострочное
      обоснование в README («публичный репо → сессии наружу не уходят»)
- [x] 6.7 Круг вызывающих в README: интерактив/review — только `ivbbest`
      (учебный репо), triage — живой автор (`user.type == User`) + аккаунт
      ≥30 дней; schedule — cron/владелец
- [x] 6.8 Самооценка в README (абзац «Самооценка процесса»): первый проход —
      App, интерактив, триаж, цикл fix→релиз, тег 1.0.3; итерации — guard
      команды, GITHUB_TOKEN (review и schedule), Conventional-заголовок,
      digest Lighthouse; данные — из context.md 2.12/4.15/5.11
- [x] 6.9 Расход в README: 1 cron/сутки + интерактивы по вызову; лимит
      провайдера (P.3) назван страховкой; анти-петля-абзац там же
- [ ] 6.10 Финальный проход по требованиям user-story: чек-бокс со ссылкой
      на каждое (28 пунктов шести шагов) — делается после 5.10 (ночной cron),
      т.к. требование шага 5 «прогон по расписанию» закроется только им
- [ ] 6.11 Финальный V-маршрут reading-guide + закрытие ритуала памяти —
      после 6.10

**След шага**: процесс устойчив: петель нет (доказано прогонами), права
минимальны (таблица), расходы и решения описаны в README; таблица воркфлоу
с живыми ссылками.

---

## Справочно: стек переносимого приложения (финализирован в 386)

- Контракт: TypeSpec 1.15 → OpenAPI (`contract/dist/openapi.yaml` коммитится);
  префикс `/api`; Prism — smoke (`Prefer: code=`) и proxy-сверка; стаб
  разработки — `contract/mock-server` (:4020).
- Фронт: Vite + React + TS + Tailwind + shadcn/ui; тонкий fetch-клиент;
  время — форматирование в Europe/Moscow; dev-прокси `VITE_API_TARGET`.
- Бэк: Node 24 + Express 5 + zod + SQLite (better-sqlite3), идемпотентный
  seed; один порт: API + статика + SPA-fallback; `NOW`-env для детерминизма.
- Тесты: smoke контракта (27) и стаба (46), vitest бэка (71), contract:check
  (prism-proxy, 9 проверок + Violation-гейт), Playwright e2e (9 сценариев).
- CI 386 (переносятся 4 файла, см. 1.1i): contract-sync, e2e (checks+e2e),
  docker-build-smoke, release-please. opencode-воркфлоу 386 — только
  текст-образец (D1); runbook 386 `.agents/mem/github-integration.md` —
  справочник намерений, не фактов: по правам расходится с собственными
  YAML (все утверждения сверять с файлами).
- Окружение: WSL2, linux-`node` на хосте нет — все dev-команды через
  `./scripts/dev.sh` (контейнер `node:24`); Docker нативный.
- Демо: 386 — https://cal-com-97sr.onrender.com (референс); рабочий URL для
  шага 5 — деплой 387 (D13, задача 1.6).

---

## Вне шагов курса (поручения владельца)

- [x] O.1 Подробное описание проекта 387 «по типу» docs предшественника:
      перенесённые `docs/project-understanding.md` и `docs/decision-guide.md`
      описывают 386 (продукт до v1.0.x) и не проясняют, что такое 387.
      Создать в `docs/` комплект: **понимание проекта** (зачем репо: перенос
      готового приложения + интеграция ИИ-агента в GitHub-процесс команды;
      предмет проверки — процесс, не продукт; входной сценарий 6 шагов;
      участники/роли; границы «что здесь лежит») и **гид по решениям**
      (архитектура агентской обвязки: интерактив/триаж/авторевью/расписание —
      события, права, модели, анти-петля; решения D1–D16 с контекстом и
      последующими поправками по фактам — D12→guard команды в `if:`,
      D4→эскалация write; релизный цикл и роль Conventional-заголовков PR;
      известные ограничения: approve ботовых прогонов только в UI, YAML
      `pull_request` из head-ветки). Стиль/структура — как в 386; публичная
      гигиена (без ссылок на `.agents`/внутреннюю память); ветка
      `docs/project-description` → PR → `/oc review` до мержа → мерж.
      Источник фактов — реестр (решения/следы), README-таблица воркфлоу
      (шаг 6), git-история main.
      **Выполнено 2026-09-05:** `docs/project-context.md` +
      `docs/agent-decisions.md`, шапки области действия в перенесённых доках —
      PR #21 → main `d1a204d` (ревью в трееде: замечание про преждевременные
      ссылки снято порядком мержей).
