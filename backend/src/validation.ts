import { z } from 'zod';

// Валидация входа по контракту (E8: .strict() — неизвестные поля = 400;
// E10: trim, пустые после trim — 400; E11: email — простая regex-проверка,
// регистр сохраняется). Сообщения — RU: они уходят клиенту в Error.message.

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const bookingCreateSchema = z
  .object({
    // EventTypeId из контракта: без паттерна «MEET_15» доживал до поиска и
    // давал 404 not_found, тогда как контракт/Prism — 400 validation
    eventTypeId: z.string('Ожидается строка').regex(ID_PATTERN, 'только строчные a-z, цифры, дефис; 1–40 символов'),
    // формат/сетка — после проверки типа (E6: «тип раньше валидации start»),
    // поэтому здесь только строка; зону и сетку требует validateBookingStart
    start: z.string('Ожидается строка'),
    // max ДО trim: maxLength контракта ограничивает строку как она пришла в
    // JSON; после trim «124 символа с пробелами» пролезало в поле «до 120»
    name: z.string('Ожидается строка').max(120, 'максимум 120 символов').trim().min(1, 'нельзя пусто'),
    email: z
      .string('Ожидается строка')
      .max(254, 'максимум 254 символа')
      .trim()
      .min(1, 'нельзя пусто')
      .regex(EMAIL_PATTERN, { error: 'некорректный адрес' }),
    notes: z.string('Ожидается строка').max(2000, 'максимум 2000 символов').trim().min(1, 'пустые заметки не нужны').optional(),
  })
  .strict();

export const eventTypeCreateSchema = z
  .object({
    id: z.string('Ожидается строка').regex(ID_PATTERN, 'только строчные a-z, цифры, дефис; 1–40 символов'),
    // max ДО trim — та же трактовка maxLength, что в bookingCreateSchema
    title: z.string('Ожидается строка').max(80, 'максимум 80 символов').trim().min(1, 'нельзя пусто'),
    description: z.string('Ожидается строка').max(500, 'максимум 500 символов').trim().optional(),
    durationMinutes: z
      .number('Ожидается число')
      .int('целое число')
      .min(5, 'от 5 минут')
      .max(540, 'до 540 минут')
      .refine((v) => v % 5 === 0, { error: 'кратно 5 минут' }),
  })
  .strict();
