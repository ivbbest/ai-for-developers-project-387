#!/usr/bin/env bash
# Прогон команды разработки в контейнере node:24 (node:24-dev-обёртка, шаг 1.2 плана).
# Примеры:
#   ./scripts/dev.sh node --version
#   ./scripts/dev.sh npm run compile -w @cal-com/contract
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose -f docker-compose.dev.yml run --rm dev "$@"
