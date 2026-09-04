// Типы зеркалят contract/dist/openapi.yaml (Design First: контракт — источник
// правды). Держим вручную и тонко: TanStack/openapi-генератор намеренно не
// брали (§5); расхождение поймает сверка бэка через prism-proxy (3.4).

export interface EventType {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
}

export type SlotStatus = 'available' | 'booked';

export interface Slot {
  start: string; // ISO UTC
  end: string;   // ISO UTC
  status: SlotStatus;
}

export interface Booking {
  id: string;
  eventTypeId: string;
  start: string;
  end: string;
  name: string;
  email: string;
  notes?: string;
  createdAt: string;
}

export interface BookingCreate {
  eventTypeId: string;
  start: string;
  name: string;
  email: string;
  notes?: string;
}

export interface EventTypeCreate {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
}

export type ErrorCode =
  | 'validation'
  | 'not_found'
  | 'slot_conflict'
  | 'slot_out_of_window'
  | 'payload_too_large'
  | 'duplicate_id'
  | 'server_error';

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'unknown';

  constructor(status: number, body: ApiErrorBody | undefined) {
    super(body?.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'unknown';
  }
}
