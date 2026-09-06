import { expect, test, type Page } from '@playwright/test';

// Завтрашний день по поясу сервиса: сетка заведомо полная (ни отсечки
// «прошедших», ни границы вчерашнего дня), «сегодня» в браузере не влияет.
function mskTomorrow(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + 86_400_000));
}

const DAY = mskTomorrow();
const slotRow = (page: Page, index: number) =>
  page.getByRole('button', { name: /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/ }).nth(index);

async function openGrid(page: Page, typeId: string): Promise<void> {
  await page.goto(`/book/${typeId}?date=${DAY}`);
  await expect(page.getByText('Статус слотов')).toBeVisible();
  await expect(slotRow(page, 0)).toBeEnabled();
}

test.describe.serial('бронирование: полный путь гостя', () => {
  test('лендинг → каталог → тип → слот → форма → успех → админка; слот стал Занято', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await page.getByRole('main').getByRole('link', { name: 'Записаться' }).click();
    await expect(page.getByRole('heading', { name: 'Выберите тип события' })).toBeVisible();

    // путь через клик по карточке — как гость
    await page.getByText('Встреча 15 минут').first().click();
    await expect(page).toHaveURL(/\/book\/meet-15/);

    await openGrid(page, 'meet-15');
    // подпись выбранного слота берём из самой сетки, а не хардкодом:
    // сдвиг рабочих констант на бэке не должен ломать сценарий
    const chosen = (await slotRow(page, 3).locator('span').first().textContent())?.trim() ?? '';
    expect(chosen).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    await slotRow(page, 3).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page).toHaveURL(/\/confirm\?start=/);
    // инфо-панель: время выбранного слота (то же, что в сетке) и посчитанный
    // сервером счётчик свободных — не «…» из незагруженного состояния.
    // Локатор скоупнут к InfoBox: на странице перехода сетка и инфо-панель
    // могут сосуществовать кадр в кадр, и глобальный getByText по времени
    // падал strict-mode violation (факт CI-прогона 33953491965)
    const timeBox = page.getByText('Выбранное время').locator('..');
    await expect(timeBox.getByText(chosen, { exact: true })).toBeVisible();
    await expect(page.getByText('Свободно', { exact: true }).locator('..')).toContainText(/\d+/);

    await page.getByPlaceholder('Имя').fill('Э2Е Гость');
    await page.getByPlaceholder('Email').fill('e2e@example.com');
    await page.getByPlaceholder('Заметки (необязательно)').fill('проверка');
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible();

    await page.goto('/admin');
    await expect(page.getByText('Э2Е Гость')).toBeVisible();
    await expect(page.getByText('e2e@example.com')).toBeVisible();

    // сетка после брони: тот же слот — Занято и недоступен
    await openGrid(page, 'meet-15');
    await expect(slotRow(page, 3)).toContainText('Занято');
    await expect(slotRow(page, 3)).toBeDisabled();
  });
});

test.describe.serial('отмена брони (issue #12)', () => {
  test('запись → номер на успехе → отмена по ссылке → слот свободен и берётся снова', async ({ page }) => {
    // idx7 на meet-30 = 12:00–12:30 MSK: не пересекается с бронями других
    // сценариев (meet-15 idx0/3/12, meet-30 idx5)
    await openGrid(page, 'meet-30');
    await slotRow(page, 7).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByPlaceholder('Имя').fill('Э2Е Отмена');
    await page.getByPlaceholder('Email').fill('cancel@example.com');
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible();

    // номер брони — capability отмены: страница подтверждения обязана его
    // показать (критерий #12: «идентификатор, который гость получает при записи»)
    const bookingId = (await page.getByTestId('booking-id').textContent())?.trim() ?? '';
    expect(bookingId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    await page.getByRole('link', { name: 'Отменить бронь' }).click();
    await expect(page).toHaveURL(new RegExp(`/cancel/${bookingId}$`));
    await page.getByRole('button', { name: 'Да, отменить' }).click();
    await expect(page.getByText('Бронь отменена')).toBeVisible();

    // слот сразу свободен в сетке и реально берётся повторно
    await openGrid(page, 'meet-30');
    await expect(slotRow(page, 7)).toContainText('Свободно');
    await expect(slotRow(page, 7)).toBeEnabled();
    await slotRow(page, 7).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByPlaceholder('Имя').fill('Э2Е Повторно');
    await page.getByPlaceholder('Email').fill('again@example.com');
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible();
  });

  test('отмена по несуществующему номеру — «не найдена», не пустой экран и не 500', async ({ page }) => {
    await page.goto('/cancel/00000000-0000-4000-8000-000000000000');
    await page.getByRole('button', { name: 'Да, отменить' }).click();
    await expect(page.getByText('Бронь не найдена')).toBeVisible();
  });
});

test.describe.serial('конфликт при бронировании (E2)', () => {
  test('вторая вкладка, не видевшая бронь, получает 409 и ссылку на рефреш', async ({ browser }) => {
    // idx5 на сетке meet-30 = 11:30–12:00 MSK; бронь первого теста (meet-15
    // 09:45–10:00) сюда не наступает — занятость по всему календарю
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();
    await openGrid(pageA, 'meet-30');
    await openGrid(pageB, 'meet-30');

    await slotRow(pageA, 5).click();
    await pageA.getByRole('button', { name: 'Продолжить' }).click();
    await slotRow(pageB, 5).click();
    await pageB.getByRole('button', { name: 'Продолжить' }).click();
    // ждём перехода на confirm у обеих: на странице сетки слово «Свободно» —
    // в 18 кнопках-слотах, локатор счётчика не был бы уникален
    await expect(pageA).toHaveURL(/\/confirm\?start=/);
    await expect(pageB).toHaveURL(/\/confirm\?start=/);

    // счётчик «Свободно» на форме pageB загружен до брони pageA — снимок для
    // проверки авто-рефреша после 409 (без клика по ссылке)
    const freeBox = pageB.getByText('Свободно', { exact: true }).locator('..');
    await expect(freeBox).toContainText(/\d+/);
    const freeBefore = (await freeBox.textContent())!;

    await pageA.getByPlaceholder('Имя').fill('Первый');
    await pageA.getByPlaceholder('Email').fill('first@example.com');
    await pageA.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(pageA.getByText('Бронь подтверждена. До встречи!')).toBeVisible();

    await pageB.getByPlaceholder('Имя').fill('Второй');
    await pageB.getByPlaceholder('Email').fill('second@example.com');
    await pageB.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(pageB.getByText('Слот уже занят')).toBeVisible();
    await expect(pageB.getByRole('link', { name: 'Обновить слоты' })).toBeVisible();

    // P2-2: после 409 сетка перезапрашивается сама (без клика по ссылке) —
    // бронь pageA уменьшает счётчик; в dev-связке (StrictMode) до фикса
    // aliveRef этот рефреш молча отбрасывался
    await expect(freeBox).not.toHaveText(freeBefore);

    // рефреш по ссылке: сетка открывается, слот уже Занято
    await pageB.getByRole('link', { name: 'Обновить слоты' }).click();
    await expect(pageB).toHaveURL(/\/book\/meet-30/);
    await expect(slotRow(pageB, 5)).toContainText('Занято');

    await pageA.close();
    await pageB.close();
  });
});

test.describe.serial('владелец: создание типа', () => {
  test('новый тип появляется в каталоге и даёт свою сетку', async ({ page }) => {
    await page.goto('/admin/new-type');
    await page.getByLabel(/Id/).fill('e2e-20');
    await page.getByLabel('Название').fill('E2E тип');
    await page.getByLabel(/Длительность/).fill('20');
    await page.getByRole('button', { name: 'Создать тип' }).click();

    await expect(page).toHaveURL(/\/book$/);
    await expect(page.getByText('E2E тип')).toBeVisible();

    await openGrid(page, 'e2e-20');
    // шаг 20 мин по рабочему окну 09:00–18:00 (константы backend/src/config.ts)
    const dayMinutes = 18 * 60 - 9 * 60;
    await expect(page.getByRole('button', { name: /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/ })).toHaveCount(Math.floor(dayMinutes / 20));
  });

  test('занятый id — 409 с человекочитаемой ошибкой', async ({ page }) => {
    await page.goto('/admin/new-type');
    await page.getByLabel(/Id/).fill('e2e-20');
    await page.getByLabel('Название').fill('Дубль');
    await page.getByLabel(/Длительность/).fill('20');
    await page.getByRole('button', { name: 'Создать тип' }).click();
    await expect(page.getByText(/id уже занят/)).toBeVisible();
  });
});

test.describe.serial('краевые проверки интерфейса', () => {
  test('несуществующий тип — человекочитаемая ошибка, не пустой экран', async ({ page }) => {
    await page.goto('/book/no-such-type');
    await expect(page.getByText('Тип события не найден')).toBeVisible();
  });

  test('повторный клик по «Подтвердить запись» не создаёт вторую бронь (E2, UI-защита)', async ({ page }) => {
    // POST держим на детерминированном гейте до проверки disabled-состояния:
    // без паузы локальный ответ приходит раньше следующего кадра и защита
    // непроверяема; фиксированный setTimeout здесь — источник flaky
    let releasePost!: () => void;
    const postGate = new Promise<void>((r) => {
      releasePost = r;
    });
    await page.route('**/api/bookings', async (route) => {
      if (route.request().method() === 'POST') await postGate;
      await route.continue();
    });
    await openGrid(page, 'meet-15');
    // idx 12 = 09:00 + 12*15 мин = 12:00–12:15 MSK — стык с бронью E2-сценария
    // (11:30–12:00), стык не конфликт (строгие < / >)
    await slotRow(page, 12).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByPlaceholder('Имя').fill('Двойной');
    await page.getByPlaceholder('Email').fill('dbl@example.com');
    // локатор по типу кнопки: на время отправки текст меняется на «Отправка…»,
    // name-локатор в этот момент себя не находит
    const submit = page.locator('button[type=submit]');
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toContainText('Отправка');
    // второй клик по заблокированной кнопке не порождает отправку
    await submit.click({ force: true, noWaitAfter: true });
    releasePost();
    await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByText('Двойной')).toHaveCount(1);
  });

  test('ссылка на дату вне окна — человекочитаемая ошибка, не пустая сетка (E5)', async ({ page }) => {
    // дата дальше 14-дневного окна: calendar её блокирует, но прямая ссылка
    // минует выбор — loadSlots обязан показать slot_out_of_window, а не «Нет слотов»
    await page.goto('/book/meet-15?date=2030-01-01');
    await expect(page.getByText('Статус слотов')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/вне окна/);
    await expect(page.getByText('Нет слотов на этот день')).toBeHidden();
  });

  test('протухший через полночь слот: подтверждение даёт E3, а не 500', async ({ page }) => {
    // вкладка «зависла» с выбранным стартом; после полуночи MSK он в прошлом —
    // бэкенд отвечает slot_out_of_window/«время слота уже прошло» (E3 before E5)
    const pastStart = '2020-01-02T06:00:00.000Z';
    const pastEnd = '2020-01-02T06:15:00.000Z';
    await page.goto(`/book/meet-15/confirm?start=${pastStart}&end=${pastEnd}`);
    await page.getByPlaceholder('Имя').fill('Протухший');
    await page.getByPlaceholder('Email').fill('stale@example.com');
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByText('время слота уже прошло')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Обновить слоты' })).toBeVisible();
  });

  test('сбой счётчика «Свободно» не блокирует бронь: счётчик справочный, правда за POST', async ({ page }) => {
    // триаж ревью PR #25 (пункт про блокировку отправки): бэкенд в транзакции
    // перепроверяет прошлое/окно/конфликт — блокировка по неудачному fetch
    // счётчика мешала бы легитимной броне и пути E3; фиксируем контракт поведения
    await openGrid(page, 'meet-15');
    await slotRow(page, 0).click();
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await expect(page).toHaveURL(/\/confirm\?start=/);
    await page.route('**/api/event-types/*/slots**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"server_error","message":"x"}' }),
    );
    await page.reload();
    await expect(page.getByText('не загрузилось')).toBeVisible();
    await page.getByPlaceholder('Имя').fill('Сбой Сетки');
    await page.getByPlaceholder('Email').fill('slotsfail@example.com');
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByText('Бронь подтверждена. До встречи!')).toBeVisible();
  });

  test('длинный email не режется молча: предел виден, перебор блокирует отправку', async ({ page }) => {
    // регресс: HTML maxLength=254 молча обрезал вставленный адрес до подтверждения;
    // теперь поле без maxLength, лимит объявлен подсказкой, перебор — ошибкой.
    // На форму идём прямой ссылкой (как в тесте протухшего слота): серийные
    // сценарии выше оставляют занятыми слои 0/3/12, а сама бронь не создаётся —
    // забирать свободный слот из сетки незачем.
    const start = `${DAY}T06:30:00.000Z`; // 09:30 MSK
    const end = `${DAY}T06:45:00.000Z`;
    await page.goto(`/book/meet-15/confirm?start=${start}&end=${end}`);
    await expect(page.getByRole('button', { name: 'Подтвердить запись' })).toBeVisible();

    const emailField = page.getByPlaceholder('Email');
    // имя заполняем сразу: иначе кнопка disabled по пустому name и проверки
    // перебора были бы ложно-зелёными (disabled не из-за email)
    await page.getByPlaceholder('Имя').fill('Проверка Лимита');
    const submit = page.locator('button[type=submit]');

    const atLimit = `${'a'.repeat(248)}@x.com`; // ровно 254
    await emailField.fill(atLimit);
    await expect(emailField).toHaveValue(atLimit);
    await expect(page.getByText(/до 254 символов/)).toBeVisible();
    await expect(submit).toBeEnabled();

    const overLimit = `${'a'.repeat(249)}@x.com`; // 255
    await emailField.fill(overLimit);
    await expect(emailField).toHaveValue(overLimit); // вставка не обрезана молча
    await expect(page.getByText(/максимум 254 символа/)).toBeVisible();
    await expect(submit).toBeDisabled();

    // регресс trimmed-проверки: валидный адрес с обрамляющими пробелами
    // не должен блокироваться формой (на сервер уходит trim)
    await emailField.fill(`  ${atLimit}\n`);
    await expect(page.getByText(/до 254 символов/)).toBeVisible();
    await expect(submit).toBeEnabled();
  });
});
