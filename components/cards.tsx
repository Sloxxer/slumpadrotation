import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur dark:border-white/10 dark:bg-[#1e293b]/85",
        className
      )}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50/80 p-8 text-center dark:border-stone-700 dark:bg-[#0f172a]/80">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{description}</p>
    </div>
  );
}
