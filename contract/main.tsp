import "@typespec/http";
import "./models.tsp";
import "./routes.tsp";

using TypeSpec.Http;

@doc("Календарь звонков: типы событий, сетка слотов, бронирования. Время в контракте — UTC; фиксированная TZ сервиса — Europe/Moscow (рабочие часы 09:00–18:00 MSK, окно записи: сегодня … сегодня+13).")
@service(#{
  title: "Календарь звонков",
})
@server("/api", "Один источник: в проде бэкенд раздаёт статику фронта и API с одного порта")
namespace CalCom;
