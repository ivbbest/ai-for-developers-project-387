import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { CalendarDaysIcon } from 'lucide-react';
import { AdminNewTypePage } from './routes/admin-new-type';
import { AdminPage } from './routes/admin';
import { BookSlotPage } from './routes/book-slot';
import { BookTypePage } from './routes/book';
import { ConfirmPage } from './routes/confirm';
import { HomePage } from './routes/home';
import { NotFoundPage } from './routes/not-found';
import { SuccessPage } from './routes/success';

export default function App() {
  return (
    <>
      <header className="border-b bg-muted/30">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3 text-sm">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <CalendarDaysIcon className="size-5 text-primary" />
            Calendar
          </Link>
          <div className="flex items-center gap-2">
            <NavLink
              to="/book"
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 hover:bg-muted ${isActive ? 'bg-muted' : ''}`
              }
            >
              Записаться
            </NavLink>
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 hover:bg-muted ${isActive ? 'bg-muted' : ''}`
              }
            >
              Админка
            </NavLink>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book" element={<BookTypePage />} />
          <Route path="/book/:typeId" element={<BookSlotPage />} />
          <Route path="/book/:typeId/confirm" element={<ConfirmPage />} />
          <Route path="/book/:typeId/success" element={<SuccessPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/new-type" element={<AdminNewTypePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  );
}
