# MEMORY.md — индекс фактов

1 строка на запись. Категории: `user` (пользователь) · `feedback` (коррекции)
· `project` (факты проекта) · `reference` (справочно). Детали — топиками (файлы
ряда), формат `YYYY-MM-DD | запись`.

## user

- 2026-09-04 | user | Унаследовано от предшественника: git-workflow — агент создаёт ветки и коммитит чекпоинты; **push, открытие PR, мерж в main, force, удаление веток — только пользователь** | AGENTS.md «Границы действий»
- 2026-09-04 | user | Секреты/.env — только пользователь; значения секретов никогда не читать/не выводить; наружу (код, коммиты, PR, README) — без ИИ-формулировок и ссылок на AGENTS.md/.agents | AGENTS.md
- 2026-09-04 | user | Тесты/проверки обязательны слоем; в этом курсе «тест» — видимый след в GitHub (прогон Actions, ответ в issue, коммиты PR, артефакт) | AGENTS.md

## feedback

- 2026-09-04 | feedback | Задача в tasks.md закрывается `[x]` только после мержа её PR в `main` и если после мержа проект не упал (CI зелёный, след виден); до мержа — `[~]`. Цель: очистка контекста и безопасный возврат к любой следующей задаче/разделу | указание пользователя, AGENTS.md «Границы действий», Правила ведения tasks.md
- 2026-09-04 | feedback | Напоминание пользователя (усиление AGENTS.md): ветка на каждую существенную разработку с говорящим именем; зависимые — на паузе до мержа; независимые — параллельно в свои PR; каждый существенный шаг — отдельный чистый коммит; перед сдачей перепроверять каждый коммит (не сломано ли) и наличие тестов; в публичном — без ИИ-формулировок и ссылок на AGENTS.md/.agents | указание пользователя 2026-09-04

## project

- 2026-09-04 | project | Проект: «Календарь звонков (продолжение)», репо ivbbest/ai-for-developers-project-387, папка `/mnt/e/hexlet/cal-com-continue`. Предмет — интеграция агента в GitHub-процесс (6 шагов), продуктовая функциональность не растёт | AGENTS.md, input/user-story.txt
- 2026-09-04 | project | Шаг 1 в работе: `chore/migrate-app` (146507c перенос + e9a3fbb актуализация) — перенесено и локально зелёно (1.3a–j), ждёт пуша/PR/мержа; факт: vitest 72 (не 71 — цикл генерирует тест); план развития — отдельная ветка `docs/development-plan` на паузе до мержа переноса; P.2 не включён | ветки, tasks.md статус шага 1
- 2026-09-04 | project | 5 ревью каркаса консолидированы в tasks.md: решения **D1–D16** обязательны (opencode*.yml не переносятся на шаге 1, создаются на 2–5; guard триажа: issues/не-PR/не-бот; timeout-minutes; авторевью демо на человеческом PR; manifest 1.0.2 без CHANGELOG; App расширением вручную; APP_URL = деплой 387; concurrency; big-pickle единообразно; **D16: коммиты переноса chore/docs + гейт «release-please без release-PR»**). Пред-шаг пользователя P.1–P.4. Пятое ревью (реестр, R1–R10) само проверено фактами 386: R1–R9 приняты, **R10 отклонён** (переключатель Actions-PR не нужен интерактиву — PR агента через App). Мелочи из 4 ревью, не закрытые ранее, внесены: пины SHA в аудит 6.1c, проверка fetch-depth в 4.2, тег формата cal-com-vX.Y.Z в 1.1g/4.14, V1 reading-guide | tasks.md «Принятые решения», `.agents/archive/review-*.md`
- 2026-09-04 | project | Предшественник завершён и стабилен: v1.0.2, все этапы 1–5, ревью-раунды отработаны, репозиторий зачищен (на remote main + ветка release-please). Остаток за владельцем 386: решение по длине email, подтверждение `USER node` на Render | mem в предшественнике

## reference

- 2026-09-04 | reference | Предшественник: `/mnt/e/hexlet/cal-com` (репо 386) — источник кода шага 1; его `AGENTS.md`, `docs/decision-guide.md`, `docs/project-understanding.md`, `.agents/mem/github-integration.md` (runbook 4 opencode-воркфлоу) — справочники решений | топик
- 2026-09-04 | reference | Демо предшественника: https://cal-com-97sr.onrender.com (нужно для шага 5 — Lighthouse по публичной ссылке; адрес — repository variable, не вписывать в воркфлоу) | input/user-story.txt
- 2026-09-04 | reference | OpenCode GitHub: https://opencode.ai/docs/github/ (установка, события и обязательный prompt, конфигурация model/variant/agent/mentions/share); приложение — https://github.com/apps/opencode-agent | ссылки курса
- 2026-09-04 | reference | Уроки предшественника по opencode-воркфлоу (пины экшенов на SHA, share:false, фильтр вызывающего, анти-спам триажа, права по воркфлоу) — в `.agents/mem/learnings.md` репо 386 и `mem/github-integration.md` | топик
- 2026-09-04 | reference | Стек переносимого приложения: TypeSpec→OpenAPI (contract), Vite+React+shadcn/ui (frontend), Node24+Express5+zod+SQLite (backend), Playwright (e2e), Docker multi-stage, release-please; dev-команды — только через `./scripts/dev.sh` (контейнер node:24) | README предшественника
