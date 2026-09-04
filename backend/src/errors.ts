// Контролируемые ошибки HTTP-слоя: маршрут/сервис бросает HttpError,
// единый хендлер (middleware/errors.ts) превращает его в Error-JSON (C7).
import type { ErrorCode } from './types.js';

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
