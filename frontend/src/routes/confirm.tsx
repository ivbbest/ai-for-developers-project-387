import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiError, type Booking, type EventType, type Slot } from '../api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InfoBox } from '../components/info-box';
import { formatDayLongMsk, formatTimeMsk, mskDay } from '../lib/time';

// ISO-момент из слотов (дата + время с обязательной зоной); «0» и прочий
// мусор Date.parse переживает, а Intl на нём падает
const ISO_START = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// Лимит email по контракту (GuestEmail @maxLength 254). maxLength на поле не
// ставим намеренно: HTML-атрибут молча режет вставку длинного адреса без
// сообщения; предел показываем подсказкой и проверкой перед отправкой.
const EMAIL_MAX = 254;

export function ConfirmPage() {
  const { typeId } = useParams<{ typeId: string }>();
  const [params] = useSearchParams();
  const rawStart = params.get('start');
  const rawEnd = params.get('end');
  const start = rawStart && ISO_START.test(rawStart) && !Number.isNaN(Date.parse(rawStart)) ? rawStart : null;
  // end берём из слота (он знает свой end); вычисление по длительности — только
  // фолбэк для ссылки без ?end=, чтобы не разъезжалось с серверным округлением
  const endParam = rawEnd && ISO_START.test(rawEnd) && !Number.isNaN(Date.parse(rawEnd)) ? rawEnd : null;
  const navigate = useNavigate();
  const dayParam = start ? mskDay(start) : null;

  const [type, setType] = useState<EventType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<Slot[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // ошибка загрузки слотов ≠ «день занят»: «Свободно: 0» при сетке, которая
  // не поднялась, вводит в заблуждение
  const [slotsError, setSlotsError] = useState(false);
  // рефетч из catch не в эффекте — флаг живости компонента через ref;
  // StrictMode делает setup→cleanup→setup на том же инстансе: без
  // взведения в setup флаг оставался false в dev, и авто-рефреш после
  // 409 молча отбрасывал результат
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!typeId || !start) return;
    let cancelled = false;
    api
      .listEventTypes()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((t) => t.id === typeId);
        if (found) setType(found);
        else setLoadError('Тип события не найден');
      })
      .catch(() => !cancelled && setLoadError('Не удалось загрузить данные'));
    // счётчик «Свободно» — как в референсе; сетку дня перезапрашиваем — она же
    // источник актуальности после 409; успех снимает slotsError (StrictMode:
    // первый fetch мог упасть, второй — подняться на том же инстансе)
    api
      .getSlots(typeId, mskDay(start))
      .then((s) => {
        if (!cancelled) {
          setDaySlots(s);
          setSlotsError(false);
        }
      })
      .catch(() => !cancelled && setSlotsError(true));
    return () => {
      cancelled = true;
    };
  }, [typeId, start]);

  if (!typeId || !start) {
    return (
      <div>
        <p className="text-destructive">Слот не выбран</p>
        <Button asChild className="mt-4">
          <Link to="/book">Выбрать тип</Link>
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <p className="text-destructive">{loadError}</p>
        <Button asChild className="mt-4">
          <Link to={`/book/${typeId}`}>К слотам</Link>
        </Button>
      </div>
    );
  }

  const freeCount = daySlots?.filter((s) => s.status === 'available').length;
  const emailTooLong = email.length > EMAIL_MAX;
  const endIso = endParam ?? (type
    ? new Date(new Date(start).getTime() + type.durationMinutes * 60_000).toISOString()
    : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || emailTooLong || submitting || !type) return;
    setSubmitting(true);
    setError(null);
    setConflict(false);
    setExpired(false);
    try {
      const booking: Booking = await api.createBooking({
        eventTypeId: typeId,
        start,
        name: name.trim(),
        email: email.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      navigate(`/book/${typeId}/success`, { state: { booking } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'slot_conflict') {
        setConflict(true);
        setError(err.message || 'Слот уже занят');
        // рефреш сетки: слот мог занять другой гость; если рефреш не поднялся —
        // показываем ошибку конфликта, счётчик «Свободно» остаётся прежним (свежий
        // виден после «Обновить слоты»)
        api
          .getSlots(typeId, mskDay(start))
          .then((list) => {
            if (aliveRef.current) {
              setDaySlots(list);
              setSlotsError(false);
            }
          })
          .catch(() => {});
      } else if (err instanceof ApiError && err.code === 'slot_out_of_window') {
        // E3: слот «протух» между выбором и подтверждением — путь назад к календарю
        setError(err.message || 'Слот больше не доступен');
        setExpired(true);
      } else if (err instanceof ApiError) {
        setError(err.message || 'Проверьте данные формы');
      } else {
        setError('Сервер недоступен, попробуйте ещё раз');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Запись на звонок</h1>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Информация</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <InfoBox label="Выбранная дата" value={formatDayLongMsk(start)} />
            <InfoBox label="Выбранное время" value={endIso ? `${formatTimeMsk(start)} - ${formatTimeMsk(endIso)}` : '…'} />
            <InfoBox label="Свободно" value={slotsError ? 'не загрузилось' : freeCount === undefined ? '…' : String(freeCount)} />
            <InfoBox label="Длительности в дне" value={type ? `${type.durationMinutes} мин` : '…'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Подтверждение записи</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to={`/book/${typeId}?date=${dayParam}`}>Изменить</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <Input
                aria-label="Имя"
                placeholder="Имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
              <div className="grid gap-1">
                <Input
                  aria-label="Email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={emailTooLong || undefined}
                  required
                />
                {emailTooLong ? (
                  <span className="text-xs text-destructive">
                    слишком длинный адрес: максимум {EMAIL_MAX} символа (введено {email.length})
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    до {EMAIL_MAX} символов{email.length > 0 ? ` — введено ${email.length}` : ''}
                  </span>
                )}
              </div>
              <Textarea
                aria-label="Заметки"
                placeholder="Заметки (необязательно)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={3}
              />
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                  {(conflict || expired) && (
                    // expired — слот протух через полночь: вчерашняя дата ведёт
                    // на пустую сетку, ссылка без ?date открывает сегодня
                    <Link
                      className="ml-2 underline"
                      to={expired ? `/book/${typeId}` : `/book/${typeId}?date=${dayParam}`}
                    >
                      Обновить слоты
                    </Link>
                  )}
                </p>
              )}
              <Button type="submit" disabled={submitting || !name.trim() || emailTooLong || !email.trim() || !type} className="w-full">
                {submitting ? 'Отправка…' : 'Подтвердить запись'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
