import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiError, type EventType, type Slot } from '../api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDayLongMsk, formatTimeMsk, mskDay } from '../lib/time';
import { WINDOW_DAYS } from '../lib/window';
import { OwnerBlock } from '../components/owner-block';
import { InfoBox } from '../components/info-box';

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function BookSlotPage() {
  const { typeId } = useParams<{ typeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reqSeq = useRef(0);
  const [type, setType] = useState<EventType | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Граница «сегодня» — MSK-календарная дата (сервис живёт по Europe/Moscow),
  // но хранится как локальная полночь: ячейки react-day-picker и toIsoDay()
  // тоже локальные, поэтому сравнения и round-trip в строки самосогласованы.
  // В крайних поясах локальное «сегодня» гостя может отличаться от MSK-даты
  // на ±1 — это осознанно: окно задаёт сервер по MSK, сетка заякорена на него же
  const today = useMemo(() => new Date(`${mskDay(new Date().toISOString())}T00:00:00`), []);
  const lastDay = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + WINDOW_DAYS - 1);
    return d;
  }, [today]);

  // роутер переиспользует компонент при смене :typeId — без сброса под новым
  // заголовком остаётся сетка и выбор предыдущего типа
  useEffect(() => {
    // type тоже сбрасываем: иначе под новым заголовком висит старый, пока
    // асинхронная загрузка не ответит
    setType(null);
    setDay(null);
    setSlots(null);
    setSelected(null);
    setLoadError(null);
    // in-flight ответ прежнего типа не должен пройти seq-проверку в loadSlots
    // и затереть сетку нового (сейчас безвредно из-за гейта day===null —
    // не держать рваную гонку «на честном слове»)
    reqSeq.current += 1;
  }, [typeId]);

  useEffect(() => {
    if (!typeId) return;
    let cancelled = false;
    api
      .listEventTypes()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((t) => t.id === typeId);
        if (!found) setLoadError('Тип события не найден');
        else setType(found);
      })
      .catch(() => !cancelled && setLoadError('Не удалось загрузить тип события'));
    return () => {
      cancelled = true;
    };
  }, [typeId]);

  const loadSlots = useCallback((d: Date) => {
    if (!typeId) return;
    setDay(d);
    setSelected(null);
    setSlots(null);
    setLoadError(null);
    // ответ за прежний день не должен перезаписать новый при быстрой смене даты
    const seq = ++reqSeq.current;
    api
      .getSlots(typeId, toIsoDay(d))
      .then((list) => {
        if (seq === reqSeq.current) setSlots(list);
      })
      .catch((e: unknown) => {
        if (seq !== reqSeq.current) return;
        setSlots([]);
        setLoadError(e instanceof ApiError ? e.message : 'Не удалось загрузить слоты');
      });
  }, [typeId]);

  // возврат из /confirm («Изменить», «Обновить слоты») — на тот же день;
  // searchParams в deps: identity меняется только вместе с location,
  // повторных загрузок нет (type/loadSlots стабильны после первой)
  useEffect(() => {
    const date = searchParams.get('date');
    if (type && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      loadSlots(new Date(`${date}T00:00:00`));
    }
  }, [type, loadSlots, searchParams]);

  if (loadError && type === null) return <p className="text-destructive">{loadError}</p>;
  if (type === null) return <Skeleton className="h-40" />;

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">{type.title}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <OwnerBlock />
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{type.title}</h2>
                <Badge variant="secondary">{type.durationMinutes} мин</Badge>
              </div>
              {type.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
              ) : null}
            </div>
            <InfoBox
              label="Выбранная дата"
              value={day ? formatDayLongMsk(`${toIsoDay(day)}T12:00:00Z`) : 'Дата не выбрана'}
            />
            <InfoBox
              label="Выбранное время"
              value={selected ? `${formatTimeMsk(selected.start)} - ${formatTimeMsk(selected.end)}` : 'Время не выбрано'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Календарь</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              defaultMonth={today}
              selected={day ?? undefined}
              onSelect={(d) => d && loadSlots(d)}
              startMonth={today}
              endMonth={lastDay}
              disabled={(d) => d < today || d > lastDay}
              weekStartsOn={1}
              locale={{ code: 'ru-RU' }}
              className="w-full"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Статус слотов</CardTitle>
            {day === null ? <CardDescription>Выберите дату в календаре</CardDescription> : null}
          </CardHeader>
          <CardContent>
            {day !== null && slots === null && <Skeleton className="h-40" />}
            {day !== null && slots !== null && slots.length === 0 && !loadError && (
              <p className="text-sm text-muted-foreground">Нет слотов на этот день</p>
            )}
            {day !== null && slots !== null && slots.length > 0 && (
              <div className="grid max-h-96 gap-2 overflow-y-auto">
                {slots.map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    disabled={s.status === 'booked'}
                    onClick={() => setSelected(s)}
                    aria-pressed={selected?.start === s.start}
                    className={
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ' +
                      (s.status === 'booked'
                        ? 'cursor-not-allowed bg-muted/60 text-muted-foreground'
                        : selected?.start === s.start
                          ? 'border-primary bg-primary/10'
                          : 'hover:border-primary/60')
                    }
                  >
                    <span className="tabular-nums">
                      {formatTimeMsk(s.start)} - {formatTimeMsk(s.end)}
                    </span>
                    <span className={s.status === 'booked' ? 'text-muted-foreground' : 'font-medium'}>
                      {s.status === 'booked' ? 'Занято' : 'Свободно'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {loadError && day !== null && <p className="mt-2 text-sm text-destructive" role="alert">{loadError}</p>}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" asChild className="flex-1">
                <Link to="/book">Назад</Link>
              </Button>
              <Button
                className="flex-1"
                disabled={selected === null}
                onClick={() =>
                  typeId &&
                  selected &&
                  navigate(
                    `/book/${typeId}/confirm?start=${encodeURIComponent(selected.start)}&end=${encodeURIComponent(selected.end)}`,
                  )
                }
              >
                Продолжить
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

