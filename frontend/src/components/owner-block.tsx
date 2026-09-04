import { OWNER } from '../lib/owner';

// Аватар-заглушка из референсного макета (SVG без внешних ресурсов)
export function OwnerBlock() {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted"
      >
        <svg viewBox="0 0 40 40" className="size-11">
          <circle cx="20" cy="16" r="10" fill="#f5a623" />
          <circle cx="16" cy="14" r="1.4" fill="#3b2a12" />
          <circle cx="24" cy="14" r="1.4" fill="#3b2a12" />
          <path d="M6 40c2-9 8-13 14-13s12 4 14 13z" fill="#1f9d7a" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="font-semibold">{OWNER.name}</div>
        <div className="text-sm text-muted-foreground">{OWNER.role}</div>
      </div>
    </div>
  );
}
