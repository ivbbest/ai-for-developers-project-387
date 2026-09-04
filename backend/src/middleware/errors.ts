import { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../errors.js';
import { InvalidDateError } from '../repositories/bookings.js';
import { OutOfWindowError, ValidationError } from '../services/slots.js';

// Единый JSON-хендлер ошибок (C7, E18–E19): любой сбой на /api/* отдаётся
// моделью Error {code,message}, а не дефолтным HTML Express. Ставится
// ПОСЛЕ всех маршрутов; необработанные исключения логируются на сервере,
// наружу уходит нейтральное сообщение (не протекают стеки/внутренности).

function send(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ code, message });
}

export function apiErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message);
  }
  if (err instanceof ZodError) {
    // E8: unknown fields приходят особым issue (keys, path=[]) — свой RU-текст,
    // иначе поле «» с англоязычным сообщением вместо человекочитаемого (C7)
    const unknown = err.issues.filter((i) => i.code === 'unrecognized_keys');
    if (unknown.length > 0) {
      const keys = [...new Set(unknown.flatMap((i) => (i as { keys?: string[] }).keys ?? []))];
      return send(res, 400, 'validation', `Неизвестные поля: ${keys.join(', ')}`);
    }
    const first = err.issues[0];
    // Root-issue (скаляр/массив вместо объекта): path пуст, join даёт ''
    // («Поле «»»), а сообщение zod — английское; отдельная ветка с RU-текстом (C7)
    if (!first || first.path.length === 0) {
      return send(res, 400, 'validation', 'Ожидался объект в теле запроса');
    }
    const field = first.path.join('.');
    return send(res, 400, 'validation', `Поле «${field}»: ${first.message}`);
  }
  if (err instanceof InvalidDateError) {
    return send(res, 400, 'validation', err.message);
  }
  if (err instanceof OutOfWindowError) {
    return send(res, 400, 'slot_out_of_window', err.message); // E5
  }
  if (err instanceof ValidationError) {
    return send(res, 400, 'validation', err.message); // E4/E7/E12
  }

  const type = (err as { type?: string })?.type;
  if (type === 'entity.too.large') {
    return send(res, 413, 'payload_too_large', 'Тело запроса слишком большое'); // E9/E18
  }
  if (type === 'entity.parse.failed') {
    return send(res, 400, 'validation', 'Ожидался валидный JSON'); // E9
  }
  // Ошибки самого Express/body-parser с клиентским status: URIError 400 на битый
  // percent-encoding в пути (router/lib/layer.js навешивает status=400, но НЕ
  // expose), SyntaxError 400 от qs, encoding.unsupported 415 от body-parser.
  // Без ветки проваливаются в generic-500, загрязняя мониторинг 5xx мусорным
  // трафиком (E19: 5xx — только сбои сервера)
  // и расходясь со стабом/Prism. HttpError и JSON-ошибки body-parser
  // (entity.*) перехвачены выше.
  // Сообщение фиксированное RU — текст ошибки (может содержать фрагмент пути) наружу не идёт.
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return send(res, 400, 'validation', 'Некорректный запрос'); // E18
  }

  console.error('Unhandled error:', err);
  return send(res, 500, 'server_error', 'Внутренняя ошибка сервера'); // E19 (5xx)
}
