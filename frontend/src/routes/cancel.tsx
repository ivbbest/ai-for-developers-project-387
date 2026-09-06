import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiError } from '../api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

type Phase = 'confirm' | 'cancelling' | 'cancelled' | 'not-found' | 'failed';

// Страница отмены по ссылке с номера брони (issue #12). Отдельного GET
// «одна бронь» в контракте нет (C6-логика: карточка типа без GET /{id}),
// поэтому страница не показывает детали — только подтверждение отмены
// по id и итог. Повторная отмена идемпотентна (204), «не найдено» — 404:
// состояние «уже отменена» от «не существует» API не различает
export function CancelBookingPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [phase, setPhase] = useState<Phase>('confirm');

  const cancel = async () => {
    if (!bookingId || phase === 'cancelling') return;
    setPhase('cancelling');
    try {
      await api.cancelBooking(bookingId);
      setPhase('cancelled');
    } catch (err) {
      setPhase(err instanceof ApiError && err.status === 404 ? 'not-found' : 'failed');
    }
  };

  const done = phase === 'cancelled' || phase === 'not-found';
  const title =
    phase === 'cancelled'
      ? 'Бронь отменена'
      : phase === 'not-found'
        ? 'Бронь не найдена'
        : 'Отменить бронь?';
  const hint =
    phase === 'cancelled'
      ? 'Слот снова свободен и доступен для записи.'
      : phase === 'not-found'
        ? 'Брони с таким номером нет — возможно, она уже отменена.'
        : phase === 'failed'
          ? 'Сервер недоступен, попробуйте ещё раз.'
          : 'Слот сразу станет свободен для других; вернуть запись будет нельзя.';

  return (
    <Card className="mx-auto max-w-md text-center">
      <CardHeader>
        {/* h1 — тот же приём, что в success.tsx: заголовок верхнего уровня
            обязателен, CardTitle (div) его не даёт */}
        <h1 className="font-heading text-base leading-snug font-medium">{title}</h1>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {bookingId && !done && (
          <CardDescription className="text-center">
            Номер брони:{' '}
            <span className="font-mono text-xs break-all">{bookingId}</span>
          </CardDescription>
        )}
        <div className="flex justify-center gap-2">
          {!done && (
            <Button onClick={cancel} disabled={phase === 'cancelling' || !bookingId}>
              {phase === 'cancelling' ? 'Отменяем…' : 'Да, отменить'}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={done ? '/book' : '/'}>{done ? 'Выбрать другое время' : 'На главную'}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
