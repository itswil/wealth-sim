import type { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
  sub?: string;
}

export function Card({ title, children, className = "", sub }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">{title}</h3>
        {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
      </div>
      {children}
    </div>
  );
}
