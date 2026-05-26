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
        "rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-panel backdrop-blur",
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
    <div className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50/80 p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
    </div>
  );
}
