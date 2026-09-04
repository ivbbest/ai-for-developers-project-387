// Доменные типы — по docs/specs/api-contract.md «Доменные сущности».
// Время храним и отдаём в UTC (ISO-строки); TZ сервиса — только для сетки/окна.

export interface EventType {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
}

export type SlotStatus = 'available' | 'booked';

// Коды ошибок — зеркало контракта (ErrorCode в contract/models.tsp)
export type ErrorCode =
  | 'validation'
  | 'not_found'
  | 'slot_conflict'
  | 'slot_out_of_window'
  | 'payload_too_large'
  | 'duplicate_id'
  | 'server_error';

export interface Slot {
  start: string; // ISO UTC
  end: string;   // ISO UTC
  status: SlotStatus;
}

export interface Booking {
  id: string; // uuid
  eventTypeId: string;
  start: string; // ISO UTC
  end: string;   // ISO UTC
  name: string;
  email: string;
  notes?: string;
  createdAt: string; // ISO UTC
}

// Вход для создания брони — repositories/bookings.ts (BookingCreate):
// id/createdAt серверные, end вычисляется из длительности типа.
