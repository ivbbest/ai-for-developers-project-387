import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Booking } from '../api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCreatedMsk, formatSlotMsk } from '../lib/time';

export function AdminPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listBookings()
      .then((list) => !cancelled && setBookings(list))
      .catch(() => !cancelled && setError('Не удалось загрузить встречи'));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Предстоящие события</h1>
        <Button asChild variant="outline">
          <Link to="/admin/new-type">Новый тип события</Link>
        </Button>
      </div>
      {error && (
        <p className="text-destructive" role="alert">
          {error}{' '}
          <button type="button" className="underline" onClick={() => { setError(null); setReload((n) => n + 1); }}>
            Повторить
          </button>
        </p>
      )}
      {bookings === null && !error && <Skeleton className="h-32" />}
      {bookings !== null && bookings.length === 0 && (
        <p className="text-muted-foreground">Пока нет запланированных встреч</p>
      )}
      <div className="grid gap-4">
        {bookings?.map((b) => (
          <Card key={b.id}>
            <CardContent className="grid gap-1 pt-6">
              <div className="font-semibold">{b.name}</div>
              <div className="text-sm text-muted-foreground">{b.email}</div>
              <div className="text-sm text-muted-foreground">Слот: {formatSlotMsk(b.start)}</div>
              <div className="text-sm text-muted-foreground">Создано: {formatCreatedMsk(b.createdAt)}</div>
              {b.notes ? <div className="text-sm break-words text-muted-foreground">Заметки: {b.notes}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
