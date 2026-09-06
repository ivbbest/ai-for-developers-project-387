import { Link, useLocation } from 'react-router-dom';
import type { Booking } from '../api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { formatDateTimeMsk } from '../lib/time';

export function SuccessPage() {
  const { state } = useLocation() as { state: { booking?: Booking } | null };
  const booking = state?.booking;

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        {/* h1 вместо CardTitle (div) — на странице нет ни одного заголовка
            верхнего уровня; классы те же, вид не меняется (preflight обнуляет
            браузерные стили h1) */}
        <h1 className="font-heading text-base leading-snug font-medium">
          Бронь подтверждена. До встречи!
        </h1>
        {booking ? (
          <CardDescription>{formatDateTimeMsk(booking.start)}</CardDescription>
        ) : (
          <CardDescription>Ваша запись создана</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {/* id брони — capability для отмены (issue #12): сервер не знает,
            кто гость, и отменяет по номеру; ссылка ведёт на страницу
            отмены, номер стоит рядом текстом — на случай «закрыл вкладку»
        */}
        {booking && (
          <CardDescription className="text-center">
            Номер брони:{' '}
            <span data-testid="booking-id" className="font-mono text-xs break-all">
              {booking.id}
            </span>
          </CardDescription>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          {booking && (
            <Button variant="outline" asChild>
              <Link to={`/cancel/${booking.id}`}>Отменить бронь</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/">На главную</Link>
          </Button>
          <Button asChild>
            <Link to="/admin">Предстоящие встречи</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
