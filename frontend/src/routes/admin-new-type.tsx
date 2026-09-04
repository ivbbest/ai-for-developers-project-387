import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ApiError } from '../api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function AdminNewTypePage() {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationOk = /^\d+$/.test(duration) && Number(duration) >= 5 && Number(duration) <= 540 && Number(duration) % 5 === 0;
  const idOk = /^[a-z0-9-]{1,40}$/.test(id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idOk || !title.trim() || !durationOk || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createEventType({
        id,
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        durationMinutes: Number(duration),
      });
      navigate('/book');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 'duplicate_id'
            ? `${err.message || 'id уже занят'}`
            : err.message || 'Проверьте данные формы',
        );
      } else {
        setError('Сервер недоступен, попробуйте ещё раз');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        {/* h1 вместо CardTitle (div) — см. success.tsx: вид тот же, семантика верная */}
        <h1 className="font-heading text-base leading-snug font-medium">
          Новый тип события
        </h1>
        <CardDescription>id задаёте вы — строчные латинские буквы, цифры, дефисы</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm">
            Id
            <Input value={id} onChange={(e) => setId(e.target.value)} pattern="[a-z0-9-]{1,40}" maxLength={40} required />
            {id && !idOk && <span className="text-xs text-destructive">только a-z, 0-9, дефис; до 40 символов</span>}
          </label>
          <label className="grid gap-1 text-sm">
            Название
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          </label>
          <label className="grid gap-1 text-sm">
            Описание (необязательно)
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </label>
          <label className="grid gap-1 text-sm">
            Длительность, минут
            <Input
              type="number"
              min={5}
              max={540}
              step={5}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            {!durationOk && <span className="text-xs text-destructive">от 5 до 540, кратно 5</span>}
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={submitting || !idOk || !title.trim() || !durationOk}>
            {submitting ? 'Создание…' : 'Создать тип'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
