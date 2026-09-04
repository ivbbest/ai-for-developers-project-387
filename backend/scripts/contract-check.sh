#!/usr/bin/env bash
# Сверка живого бэкенда с контрактом (план 3.4, §9 п. 8): за реальным сервером
# — prism proxy, который валидирует запросы и ОТВЕТЫ по contract/dist/openapi.yaml.
# Любой расхождение (лишнее поле в JSON, не-схема-ответ) prism превращает в 500 —
# проверка становится красной. Прогон: ./scripts/dev.sh npm run contract:check -w backend
set -u
cd "$(dirname "$0")/.."

SRV_PORT="${CHECK_SRV_PORT:-3010}"
PROXY_PORT="${CHECK_PROXY_PORT:-4110}"
DB=$(mktemp -d)/check.db
LOGDIR=$(mktemp -d)
FAILS=0

cleanup() {
  # setsid+kill -- -PID: npx порождает правнучатый node, убийство только
  # обёртки оставляло его сиротой на порту (следующий прогон падал на EADDRINUSE)
  [ -n "${SRV_PID:-}" ] && kill -- -"$SRV_PID" 2>/dev/null
  [ -n "${PRISM_PID:-}" ] && kill -- -"$PRISM_PID" 2>/dev/null
  rm -rf "$(dirname "$DB")" "$LOGDIR"
}
trap cleanup EXIT

# NOW зафиксирован: «сегодня» 2026-09-10 (MSK), слоты детерминированы
setsid env NOW=2026-09-10T05:00:00Z PORT="$SRV_PORT" DATABASE_PATH="$DB" npx --no-install tsx src/server.ts >"$LOGDIR/srv.log" 2>&1 &
SRV_PID=$!
PRISM_ROOT="$(cd .. && pwd)"
setsid npx --no-install prism proxy "$PRISM_ROOT/contract/dist/openapi.yaml" "http://localhost:${SRV_PORT}/api" --host 127.0.0.1 --port "$PROXY_PORT" >"$LOGDIR/prism.log" 2>&1 &
PRISM_PID=$!

BASE="http://127.0.0.1:${PROXY_PORT}"
ready=0
for _ in $(seq 1 80); do
  if ! kill -0 "$SRV_PID" 2>/dev/null || ! kill -0 "$PRISM_PID" 2>/dev/null; then break; fi
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/event-types")" = "200" ]; then ready=1; break; fi
  sleep 0.5
done
if [ "$ready" != 1 ]; then
  echo "FAIL  связка backend↔prism proxy не поднялась"
  tail -5 "$LOGDIR/srv.log" "$LOGDIR/prism.log"
  exit 1
fi

check() {
  local name="$1" want="$2"; shift 2
  local got
  got=$(curl -s -o "$LOGDIR/body" -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then
    echo "PASS  $name → $got"
  else
    echo "FAIL  $name → want $want, got $got"
    head -c 400 "$LOGDIR/body"; echo
    FAILS=$((FAILS + 1))
  fi
}

J='Content-Type: application/json'
B='{"eventTypeId":"meet-15","start":"2026-09-10T06:00:00.000Z","name":"Проверка","email":"check@example.com"}'

# все вызовы — ТОЛЬКО валидные по контракту (prism отбракует неверный запрос сам);
# невалидные сценарии E-таблицы покрыты интеграционными тестами приложения
check "GET  /event-types" 200 "$BASE/event-types"
check "GET  /event-types/{id}/slots?date=…" 200 "$BASE/event-types/meet-15/slots?date=2026-09-10"
check "POST /bookings → 201" 201 -H "$J" -d "$B" "$BASE/bookings"
check "POST /bookings повтор → 409" 409 -H "$J" -d "$B" "$BASE/bookings"
check "POST /bookings нет типа → 404" 404 -H "$J" -d '{"eventTypeId":"nope","start":"2026-09-10T07:00:00.000Z","name":"П","email":"p@example.com"}' "$BASE/bookings"
check "GET  /bookings" 200 "$BASE/bookings"
check "POST /event-types → 201" 201 -H "$J" -d '{"id":"check-60","title":"Часовой чек","durationMinutes":60}' "$BASE/event-types"
check "POST /event-types дубль → 409" 409 -H "$J" -d '{"id":"check-60","title":"Ещё","durationMinutes":60}' "$BASE/event-types"
check "GET  /bookings после брони" 200 "$BASE/bookings"

if [ "$FAILS" != 0 ]; then
  echo "CONTRACT CHECK FAILED: $FAILS провалов"
  exit 1
fi
# prism proxy не превращает нарушения схемы ОТВЕТОВ в 5xx — он только пишет
# Violation в свой лог (проверено canary-ответом). Без этого сверка сводилась
# к статус-кодам; смотрим лог явно.
if grep -q "Violation" "$LOGDIR/prism.log"; then
  echo "CONTRACT CHECK FAILED: prism зафиксировал нарушения схемы ответов:"
  grep -B2 -A6 "Violation" "$LOGDIR/prism.log" | head -40
  exit 1
fi
echo "CONTRACT CHECK OK: ответы бэкенда проходят валидацию openapi.yaml через prism proxy"
