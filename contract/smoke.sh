#!/usr/bin/env bash
# Smoke контракта (шаг 1.6): сборка артефакта, Prism-мок по contract/dist/openapi.yaml
# + curl по всем 5 ручкам и кодам 200/201/400/404/409. 404/409 — через заголовок
# Prefer: code=NNN: Prism без состояния и отдаёт заготовленный пример по схеме
# (stateful-сценарий «бронь → Занято» — стаб этапа 2, 2.1b).
# Прогон: ./scripts/dev.sh npm run smoke -w @cal-com/contract
set -u
cd "$(dirname "$0")"

PORT="${PRISM_PORT:-4010}"
# Prism игнорирует относительный servers.url ("/api") и монтирует пути с корня;
# префикс — часть контракта, проверяется отдельно по openapi.yaml.
BASE="http://127.0.0.1:${PORT}"
BODY=$(mktemp)
PRISM_PID=""
# единый trap: любой выход чистит и тело ответа, и процесс Prism (перетирание
# trap'а двумя регистрациями допускало сироту-Prism при ошибке между шагами)
cleanup() {
  [ -n "$PRISM_PID" ] && kill "$PRISM_PID" 2>/dev/null
  rm -f "$BODY"
}
trap cleanup EXIT
FAILS=0

check() {
  local name="$1" want="$2"; shift 2
  local got
  got=$(curl -s -o "$BODY" -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then
    echo "PASS  $name → $got"
  else
    echo "FAIL  $name → want $want, got $got"
    head -c 300 "$BODY"; echo
    FAILS=$((FAILS + 1))
  fi
}

check_body() {
  local name="$1" pattern="$2"
  if grep -q "$pattern" "$BODY"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name (body lacks $pattern)"
    head -c 300 "$BODY"; echo
    FAILS=$((FAILS + 1))
  fi
}

# Артефакт всегда свежая: иначе smoke гоняется по устаревшему openapi.yaml.
npx --no-install tsp compile . --warn-as-error >/dev/null || {
  echo "FAIL  compile перед smoke"
  exit 1
}

npx --no-install prism mock dist/openapi.yaml --host 127.0.0.1 --port "$PORT" >/tmp/prism-smoke.log 2>&1 &
PRISM_PID=$!

ready=0
for _ in $(seq 1 60); do
  # порт мог занять чужой процесс: ждём живой Prism И его ответ по нашей схеме
  # (200 + JSON-массив), иначе проверки уйдут в чужой сервис
  if ! kill -0 "$PRISM_PID" 2>/dev/null; then break; fi
  if [ "$(curl -s -o "$BODY" -w '%{http_code}' "$BASE/event-types")" = "200" ] \
     && grep -q '^\[' "$BODY"; then ready=1; break; fi
  sleep 0.5
done
if [ "$ready" != 1 ]; then
  echo "FAIL  Prism не поднялся на :$PORT (свободен? PRISM_PORT=…)"
  cat /tmp/prism-smoke.log
  exit 1
fi

# C1: префикс /api зафиксирован в контракте
if grep -Eq '^ *- url: /api$' dist/openapi.yaml; then
  echo "PASS  servers.url = /api (C1)"
else
  echo "FAIL  servers.url /api not found in dist/openapi.yaml"
  FAILS=$((FAILS + 1))
fi

# GET /api/event-types — каталог
check "GET /event-types" 200 "$BASE/event-types"
check_body "GET /event-types — массив" '^\['

# GET /api/event-types/{id}/slots — сетка дня
check "GET /event-types/{id}/slots?date=…" 200 "$BASE/event-types/meet-15/slots?date=2026-09-10"
check_body "slots — массив" '^\['
check "slots без date → 400 (E20)" 400 "$BASE/event-types/meet-15/slots"
check "slots с кривой date → 400 (E4)" 400 "$BASE/event-types/meet-15/slots?date=29.02.2026"
check "slots Prefer code=404" 404 -H 'Prefer: code=404' "$BASE/event-types/meet-99/slots?date=2026-09-10"
check_body "404 — код not_found" '"not_found"'

# POST /api/bookings — бронь
BOOK='{"eventTypeId":"meet-15","start":"2026-09-10T06:15:00Z","name":"Иван Петров","email":"ivan@example.com","notes":"Перезвоните"}'
BAD_BOOK='{"eventTypeId":"meet-15","start":"2026-09-10T06:15:00Z","name":"Иван Петров","email":"не-почта"}'
EXTRA_BOOK='{"eventTypeId":"meet-15","start":"2026-09-10T06:15:00Z","name":"Иван Петров","email":"ivan@example.com","extraField":1}'
check "POST /bookings валидный → 201" 201 -H 'Content-Type: application/json' -d "$BOOK" "$BASE/bookings"
check_body "201 брони — id создан" '"id"'
check "POST /bookings невалидный email → 400" 400 -H 'Content-Type: application/json' -d "$BAD_BOOK" "$BASE/bookings"
check "POST /bookings с неизвестным полем → 400 (E8)" 400 -H 'Content-Type: application/json' -d "$EXTRA_BOOK" "$BASE/bookings"
check "POST /bookings Prefer code=409" 409 -H 'Prefer: code=409' -H 'Content-Type: application/json' -d "$BOOK" "$BASE/bookings"
check_body "409 — код slot_conflict" '"slot_conflict"'
check "POST /bookings Prefer code=404" 404 -H 'Prefer: code=404' -H 'Content-Type: application/json' -d "$BOOK" "$BASE/bookings"
check_body "404 брони — код not_found" '"not_found"'

# GET /api/bookings — предстоящие (админ)
check "GET /bookings" 200 "$BASE/bookings"
check_body "bookings — массив" '^\['

# POST /api/event-types — создание типа (админ)
TYPE='{"id":"hour-60","title":"Встреча 60 минут","description":"Часовой созвон","durationMinutes":60}'
BAD_TYPE_MIN='{"id":"hour-60","title":"Встреча 60 минут","durationMinutes":4}'
BAD_TYPE_MULT='{"id":"hour-13","title":"Тринадцать минут","durationMinutes":13}'
BAD_TYPE_ID='{"id":"ХУЖЕ-НЕЛЬЗЯ","title":"x","durationMinutes":30}'
check "POST /event-types валидный → 201" 201 -H 'Content-Type: application/json' -d "$TYPE" "$BASE/event-types"
check_body "201 типа — id/title/durationMinutes" '"id"'
check_body "201 типа — title" '"title"'
check_body "201 типа — durationMinutes" '"durationMinutes"'
check "POST /event-types duration=4 → 400 (E12)" 400 -H 'Content-Type: application/json' -d "$BAD_TYPE_MIN" "$BASE/event-types"
check "POST /event-types duration=13 → 400 (E12, multipleOf)" 400 -H 'Content-Type: application/json' -d "$BAD_TYPE_MULT" "$BASE/event-types"
check "POST /event-types id вне паттерна → 400 (C5)" 400 -H 'Content-Type: application/json' -d "$BAD_TYPE_ID" "$BASE/event-types"
check "POST /event-types Prefer code=409" 409 -H 'Prefer: code=409' -H 'Content-Type: application/json' -d "$TYPE" "$BASE/event-types"
check_body "409 типа — код duplicate_id" '"duplicate_id"'

if [ "$FAILS" = 0 ]; then
  echo "SMOKE OK: все проверки пройдены"
else
  echo "SMOKE FAILED: $FAILS провалов"
  exit 1
fi
