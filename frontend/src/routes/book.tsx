import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { EventType } from '../api/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OwnerBlock } from '../components/owner-block';

export function BookTypePage() {
  const [types, setTypes] = useState<EventType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listEventTypes()
      .then((list) => !cancelled && setTypes(list))
      .catch(() => !cancelled && setError('Не удалось загрузить каталог'));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <OwnerBlock />
          <h1 className="mt-4 text-3xl font-bold">Выберите тип события</h1>
          <CardDescription className="mt-1">
            Нажмите на карточку, чтобы открыть календарь и выбрать удобный слот.
          </CardDescription>
        </CardContent>
      </Card>
      {error && (
        <p className="text-destructive" role="alert">
          {error}{' '}
          <button type="button" className="underline" onClick={() => { setError(null); setReload((n) => n + 1); }}>
            Повторить
          </button>
        </p>
      )}
      {types === null && !error && <Skeleton className="h-32" />}
      {types !== null && types.length === 0 && (
        <p className="text-muted-foreground">Пока нет доступных типов событий</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {types?.map((t) => (
          <Link key={t.id} to={`/book/${t.id}`}>
            <Card className="h-full transition-colors hover:border-primary/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{t.title}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    {t.durationMinutes} мин
                  </Badge>
                </div>
                {t.description ? <CardDescription>{t.description}</CardDescription> : null}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
