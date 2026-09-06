// Эндпоинты — строго по таблице «Эндпоинты» docs/specs/api-contract.md.
// Для 404/409 — явные @opExample тела Error: smoke (contract/smoke.sh) через
// `Prefer: code=NNN` становится детерминированным. Примеры только для тела ответа:
// темпоральные литералы (plainDate/utcDateTime) компилятор 1.15 в значениях не
// принимает, а запросов с датами в примерах это не касается.
import "@typespec/http";
import "./models.tsp";

using TypeSpec.Http;

namespace CalCom {

@doc("400 validation: кривые данные запроса (E4, E7, E8, E9, E10, E11, E12, E20)")
model BadRequestError extends Response<400> {
  @body
  body: Error;
}

@doc("404 not_found: тип события не найден (E6)")
model NotFoundError extends Response<404> {
  @body
  body: Error;
}

@doc("409 slot_conflict: пересечение интервалов с существующей бронью (E1, E2, E15)")
model SlotConflictError extends Response<409> {
  @body
  body: Error;
}

@doc("409 duplicate_id: id типа уже занят (E13)")
model DuplicateIdError extends Response<409> {
  @body
  body: Error;
}

@doc("413 payload_too_large: тело запроса больше лимита (E9, E18)")
model PayloadTooLargeError extends Response<413> {
  @body
  body: Error;
}

@doc("201 Created: созданная бронь")
model CreatedBookingResponse extends Response<201> {
  @body
  body: Booking;
}

@doc("201 Created: созданный тип события")
model CreatedEventTypeResponse extends Response<201> {
  @body
  body: EventType;
}

@doc("Гость: каталог типов, сетка слотов дня, бронирование")
interface GuestApi {
  @get
  @route("/event-types")
  @doc("Каталог типов событий (все поля карточки; GET /{id} нет — C6)")
  listEventTypes(): EventType[];

  @get
  @route("/event-types/{id}/slots")
  @doc("Сетка слотов дня со статусами. date обязателен: без него 400 (E20); дата кривая или вне окна — 400 (E4, E5); тип не найден — 404 (E6)")
  @opExample(
    #{
      returnType: #{ statusCode: 404, body: #{ code: "not_found", message: "Тип события не найден: meet-15x" } },
    },
    #{ title: "Тип не найден" }
  )
  getSlots(
    @path id: EventTypeId,
    @query date: plainDate,
  ): Slot[] | BadRequestError | NotFoundError;

  @post
  @route("/bookings")
  @doc("Создать бронь. end = start + durationMinutes типа (сервер). Конфликт пересечения — 409 (E1, E2)")
  @opExample(
    #{
      returnType: #{ statusCode: 409, body: #{ code: "slot_conflict", message: "Слот уже занят: 09:15–09:30 МСК пересекается с существующей бронью" } },
    },
    #{ title: "Слот занят" }
  )
  @opExample(
    #{
      returnType: #{ statusCode: 404, body: #{ code: "not_found", message: "Тип события не найден: meet-99" } },
    },
    #{ title: "Тип не найден" }
  )
  createBooking(
    @body body: BookingCreate,
  ): CreatedBookingResponse | BadRequestError | NotFoundError | SlotConflictError | PayloadTooLargeError;

  // NoContentResponse (TypeSpec.Http) — штатный 204 без тела: именованная
  // model extends Response<204> заводит в openapi content+схему на 204, и
  // prism-proxy затем считает пустое тело бэка нарушением схемы
  @delete
  @route("/bookings/{id}")
  @doc("Отмена брони по id: id — capability, гость получает его при записи (номер и ссылка на странице подтверждения). 204 — отменена или уже отменена (идемпотентно); неизвестный id — 404, состояние «отменена» от «не существует» не отличается")
  @opExample(
    #{
      returnType: #{ statusCode: 404, body: #{ code: "not_found", message: "Бронь не найдена: 6f1f2a34-0000-0000-0000-000000000000" } },
    },
    #{ title: "id не найден" }
  )
  cancelBooking(@path id: string): NoContentResponse | NotFoundError;
}

@doc("Владелец: фиксированный профиль { name, email }, без регистрации и авторизации (по курсу); ручки молча принадлежат владельцу (Owner — документационная сущность, не модель)")
interface OwnerApi {
  @get
  @route("/bookings")
  @doc("Предстоящие встречи всех типов: start >= now (MSK), сортировка по start (E16)")
  listBookings(): Booking[];

  @post
  @route("/event-types")
  @doc("Создать тип события; id задаёт владелец (паттерн C5), занятый id — 409 (E13)")
  @opExample(
    #{
      returnType: #{ statusCode: 409, body: #{ code: "duplicate_id", message: "id уже занят: meet-15" } },
    },
    #{ title: "id занят" }
  )
  createEventType(
    @body body: EventType,
  ): CreatedEventTypeResponse | BadRequestError | DuplicateIdError | PayloadTooLargeError;
}

}
