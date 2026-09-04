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
      <CardContent className="flex justify-center gap-2">
        <Button variant="outline" asChild>
          <Link to="/">На главную</Link>
        </Button>
        <Button asChild>
          <Link to="/admin">Предстоящие встречи</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
