# Браузерный раннер e2e: тот же node:24, что dev-обёртка (нативные модули
# бэкенда в общем volume совпадают по ABI), плюс Chromium с системными
# зависимостями. Проект монтируется volume'ом — здесь только браузеры.
FROM node:24.20.0

# версия Playwright — один источник: devDependencies этого же package.json
COPY package.json /rp.json
RUN npx -y playwright@$(node -p "require('/rp.json').devDependencies['@playwright/test']") install --with-deps chromium
