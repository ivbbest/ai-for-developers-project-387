import {
  ApiError,
  type Booking,
  type BookingCreate,
  type EventType,
  type EventTypeCreate,
  type Slot,
} from './types';

// Тонкий fetch-слой по контракту: базовый URL относительный — в dev его
// проксирует Vite (vite.config proxy /api), в проде бэк раздаёт фронт с
// того же порта (§11 решение 9). Ошибки бэкенда — единая модель Error (C7).

const REQUEST_TIMEOUT_MS = 15_000;

async function send(path: string, init?: RequestInit): Promise<Response> {
  // сеть не гарантирует завершения: без таймаута экран висит в skeleton вечно
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const res = await fetch(`/api${path}`, {
    ...init,
    // отмена вызывающего (если появится) и дедлайн живут вместе, а не перезаписывают друг друга
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, body);
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  return (await res.json()) as T;
}

// 204 No Content (отмена брони): тела по контракту нет, и res.json() на пустом
// потоке бросает — читающий request для таких ручек не применяется
// (замечание ревью PR #40: без каста undefined as T)
async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  await send(path, init);
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export const api = {
  listEventTypes: () => request<EventType[]>('/event-types'),

  getSlots: (typeId: string, date: string) =>
    request<Slot[]>(`/event-types/${encodeURIComponent(typeId)}/slots?date=${encodeURIComponent(date)}`),

  createBooking: (input: BookingCreate) =>
    request<Booking>('/bookings', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }),

  listBookings: () => request<Booking[]>('/bookings'),

  cancelBooking: (id: string) =>
    requestNoContent(`/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  createEventType: (input: EventTypeCreate) =>
    request<EventType>('/event-types', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }),
};
