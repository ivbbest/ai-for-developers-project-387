import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">Страница не найдена</h1>
      <p className="mt-2 text-muted-foreground">Такой страницы нет — начните с главной.</p>
      <Button asChild className="mt-6">
        <Link to="/">На главную</Link>
      </Button>
    </div>
  );
}
