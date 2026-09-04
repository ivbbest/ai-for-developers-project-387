import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES = [
  'Выбор типа события и удобного времени для встречи.',
  'Быстрое бронирование с подтверждением и дополнительными заметками.',
  'Управление типами встреч и просмотр предстоящих записей в админке.',
];

export function HomePage() {
  return (
    <div className="grid items-start gap-10 py-10 md:grid-cols-2">
      <div>
        <Badge variant="secondary" className="uppercase">
          Быстрая запись на звонок
        </Badge>
        <h1 className="mt-4 text-4xl font-bold">Calendar</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Забронируйте встречу за минуту: выберите тип события и удобное время.
        </p>
        <Button className="mt-6" size="lg" asChild>
          <Link to="/book">
            Записаться <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Возможности</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-sm text-muted-foreground">
            {FEATURES.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
