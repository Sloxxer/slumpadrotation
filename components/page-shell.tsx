import type { ReactNode } from "react";
import Link from "next/link";
import { HeaderClock } from "@/components/header-clock";
import { cn } from "@/lib/utils";

type Breadcrumb = {
  href?: string;
  label: string;
};

type PageShellProps = {
  title: string;
  description: string;
  action?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  children: ReactNode;
};

export function PageShell({
  title,
  description,
  action,
  breadcrumbs,
  children
}: PageShellProps) {
  return (
    <main className="space-y-8">
      <header className="relative rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur dark:border-white/10 dark:bg-[#1e293b]/80">
        <div className="absolute right-6 top-6">
          <HeaderClock />
        </div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-4 flex flex-wrap gap-2 text-sm text-stone-500 dark:text-stone-400">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-teal">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-ink">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? <span>/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 pr-24 lg:pr-28">
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Slumpad rotation
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-400">{description}</p>
            </div>
          </div>
          {action ? <div className={cn("flex flex-wrap gap-3 lg:justify-end")}>{action}</div> : null}
        </div>
      </header>
      {children}
    </main>
  );
}
