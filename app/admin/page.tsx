import Link from "next/link";
import {
  clearDepartmentRotationHistoryAction,
  createDepartmentAction,
  logoutSiteAdminAction,
  renameDepartmentAction,
  setDepartmentArchivedAction,
  unlockLoginAction,
  updateDepartmentPasswordWordAction
} from "@/app/actions";
import { EmptyState, Panel } from "@/components/cards";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageShell } from "@/components/page-shell";
import { PeopleTransfer } from "@/components/people-transfer";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { parseAdminLogMetadata } from "@/lib/admin";
import { requireSiteAdminAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn, formatDate } from "@/lib/utils";

type AdminTab = "departments" | "transfer" | "locks" | "log" | "tools";

const primaryButton =
  "rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]";
const secondaryButton =
  "rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-200";
const dangerButton =
  "rounded-2xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string; tab?: string; dept?: string }>;
}) {
  const query = await searchParams;
  await requireSiteAdminAuth();

  const tab: AdminTab =
    query.tab === "transfer" || query.tab === "locks" || query.tab === "log" || query.tab === "tools"
      ? query.tab
      : "departments";

  const [departments, logs, loginLocks, transferDepartments] = await Promise.all([
    prisma.department.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        zones: { where: { temporary: false, active: true }, select: { id: true } },
        groups: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            _count: { select: { people: { where: { archived: false } } } }
          }
        },
        _count: {
          select: {
            people: { where: { archived: false } },
            rotations: true
          }
        }
      }
    }),
    tab === "log"
      ? prisma.adminLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { department: { select: { name: true } } }
        })
      : Promise.resolve([]),
    prisma.loginLock.findMany({
      where: {
        OR: [{ permanentlyLocked: true }, { lockedUntil: { gt: new Date() } }]
      },
      orderBy: { lastFailureAt: "desc" },
      include: { department: { select: { name: true } } }
    }),
    tab === "transfer"
      ? prisma.department.findMany({
          where: { archived: false },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            groups: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                people: {
                  where: { archived: false },
                  orderBy: { name: "asc" },
                  select: { id: true, name: true, active: true }
                }
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const activeDepartments = departments.filter((department) => !department.archived);
  const archivedDepartments = departments.filter((department) => department.archived);

  const tabs: Array<{ key: AdminTab; label: string; href: string }> = [
    { key: "departments", label: "Avdelningar", href: "/admin" },
    { key: "transfer", label: "Flytta personer", href: "/admin?tab=transfer" },
    {
      key: "locks",
      label: loginLocks.length > 0 ? `Spärrade inloggningar (${loginLocks.length})` : "Spärrade inloggningar",
      href: "/admin?tab=locks"
    },
    { key: "log", label: "Systemlogg", href: "/admin?tab=log" },
    { key: "tools", label: "Verktyg", href: "/admin?tab=tools" }
  ];

  function renderDepartment(department: (typeof departments)[number]) {
    const activeZoneCount = department.zones.length;
    const warnings = [
      ...(activeZoneCount === 0 ? ["Inga aktiva zoner"] : []),
      ...(department.groups.length === 0 ? ["Inga skift"] : []),
      ...department.groups
        .filter((group) => activeZoneCount > 0 && group._count.people < activeZoneCount)
        .map((group) => `${group.name}: ${group._count.people} personer, ${activeZoneCount} zoner`)
    ];

    return (
      <Panel key={department.id} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{department.name}</h2>
              {department.archived ? (
                <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-600 dark:bg-[#334155] dark:text-stone-300">
                  Arkiverad
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {activeZoneCount} aktiva zoner • {department.groups.length} skift • {department._count.people} personer •{" "}
              {department._count.rotations} rotationer
            </p>
            {!department.archived && warnings.length > 0 ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">Att åtgärda: {warnings.join(" • ")}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/departments/${department.id}`} className={primaryButton}>
              Öppna avdelning
            </Link>
            {!department.archived ? (
              <Link href={`/rotation/${department.id}`} className={secondaryButton}>
                Rotationssida
              </Link>
            ) : null}
          </div>
        </div>

        <details open={query.dept === department.id} className="rounded-2xl border border-stone-200 dark:border-[#334155]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-stone-600 hover:text-teal dark:text-stone-300">
            Inställningar
          </summary>

          <div className="space-y-5 border-t border-stone-200 p-4 dark:border-[#334155]">
            <div className="grid gap-4 lg:grid-cols-2">
              <form action={renameDepartmentAction} className="space-y-2">
                <input type="hidden" name="departmentId" value={department.id} />
                <label htmlFor={`name-${department.id}`} className="text-sm font-medium text-ink">
                  Namn
                </label>
                <div className="flex gap-2">
                  <input id={`name-${department.id}`} name="name" defaultValue={department.name} />
                  <SubmitButton label="Spara" pendingLabel="Sparar..." className={cn(secondaryButton, "shrink-0")} />
                </div>
              </form>

              <form action={updateDepartmentPasswordWordAction} className="space-y-2">
                <input type="hidden" name="departmentId" value={department.id} />
                <label htmlFor={`pw-${department.id}`} className="text-sm font-medium text-ink">
                  Nytt passwordWord
                </label>
                <div className="flex gap-2">
                  <input id={`pw-${department.id}`} name="passwordWord" placeholder="Lösenord = ord + serverminut" />
                  <SubmitButton label="Byt" pendingLabel="Sparar..." className={cn(secondaryButton, "shrink-0")} />
                </div>
              </form>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Exportera historik (CSV)</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/export/rotations?departmentId=${department.id}`} className={secondaryButton}>
                  Alla skift
                </Link>
                {department.groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/admin/export/rotations?departmentId=${department.id}&groupId=${group.id}`}
                    className={secondaryButton}
                  >
                    {group.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Rensa historik</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Äldre än 2 månader", period: "2m" },
                  { label: "Äldre än 6 månader", period: "6m" },
                  { label: "Äldre än 1 år", period: "1y" },
                  { label: "All historik", period: "all" }
                ].map((option) => (
                  <form key={option.period} action={clearDepartmentRotationHistoryAction}>
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="period" value={option.period} />
                    <ConfirmSubmitButton
                      label={option.label}
                      pendingLabel="Rensar..."
                      confirmMessage={`Rensa historik (${option.label.toLowerCase()}) för ${department.name}? Det går inte att ångra.`}
                      className={option.period === "all" ? dangerButton : secondaryButton}
                    />
                  </form>
                ))}
              </div>
            </div>

            <form action={setDepartmentArchivedAction} className="border-t border-stone-200 pt-4 dark:border-[#334155]">
              <input type="hidden" name="departmentId" value={department.id} />
              <input type="hidden" name="archived" value={department.archived ? "false" : "true"} />
              <ConfirmSubmitButton
                label={department.archived ? "Återaktivera avdelningen" : "Arkivera avdelningen"}
                confirmMessage={
                  department.archived
                    ? `Återaktivera ${department.name}? Den syns då igen på rotationssidan.`
                    : `Arkivera ${department.name}? Den döljs från rotationssidan men all data sparas.`
                }
                className={department.archived ? secondaryButton : dangerButton}
              />
            </form>
          </div>
        </details>
      </Panel>
    );
  }

  return (
    <PageShell
      title="Adminpanel"
      description="Hantera avdelningar, spärrade inloggningar och systemloggen."
      breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: "Adminpanel" }]}
      action={
        <form action={logoutSiteAdminAction}>
          <SubmitButton label="Logga ut" pendingLabel="Loggar ut..." className={secondaryButton} />
        </form>
      }
    >
      <nav className="flex flex-wrap gap-2 rounded-[2rem] border border-white/70 bg-white/85 p-3 shadow-panel backdrop-blur dark:border-white/10 dark:bg-[#1e293b]/85">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.key === tab ? "page" : undefined}
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm font-semibold",
              item.key === tab
                ? "bg-ink text-white dark:bg-teal"
                : "text-stone-600 hover:bg-stone-100 hover:text-teal dark:text-stone-300 dark:hover:bg-[#0f172a]"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <StatusMessage error={query.error} success={query.success} />

      {tab === "departments" ? (
        <div className="space-y-5">
          {loginLocks.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              {loginLocks.length === 1 ? "1 inloggning är spärrad." : `${loginLocks.length} inloggningar är spärrade.`}{" "}
              <Link href="/admin?tab=locks" className="font-semibold underline">
                Visa
              </Link>
            </div>
          ) : null}

          <Panel>
            <form action={createDepartmentAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <label htmlFor="new-name" className="text-sm font-medium text-ink">
                  Ny avdelning
                </label>
                <input id="new-name" name="name" placeholder="Namn, t.ex. Akuten" />
              </div>
              <div className="space-y-2">
                <label htmlFor="new-passwordWord" className="text-sm font-medium text-ink">
                  PasswordWord
                </label>
                <input id="new-passwordWord" name="passwordWord" placeholder="T.ex. laser" />
              </div>
              <SubmitButton label="Skapa avdelning" pendingLabel="Skapar..." className={cn(primaryButton, "py-3")} />
            </form>
          </Panel>

          {activeDepartments.length === 0 ? (
            <EmptyState title="Inga aktiva avdelningar" description="Skapa en avdelning med formuläret ovan." />
          ) : (
            activeDepartments.map(renderDepartment)
          )}

          {archivedDepartments.length > 0 ? (
            <details open={archivedDepartments.some((department) => department.id === query.dept)}>
              <summary className="cursor-pointer select-none px-2 text-sm font-semibold text-stone-500 hover:text-teal">
                Arkiverade avdelningar ({archivedDepartments.length})
              </summary>
              <div className="mt-5 space-y-5">{archivedDepartments.map(renderDepartment)}</div>
            </details>
          ) : null}
        </div>
      ) : null}

      {tab === "transfer" ? (
        <Panel className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Flytta eller kopiera personer</h2>
            <p className="mt-1 text-sm text-stone-500">
              Välj personer i ett skift och skicka dem till ett annat skift, i samma eller en annan avdelning.
            </p>
          </div>
          {transferDepartments.some((department) => department.groups.length > 0) ? (
            <PeopleTransfer departments={transferDepartments} />
          ) : (
            <p className="text-sm text-stone-500">Det finns inga skift att flytta personer från ännu.</p>
          )}
        </Panel>
      ) : null}

      {tab === "locks" ? (
        <Panel className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Spärrade inloggningar</h2>
            <p className="mt-1 text-sm text-stone-500">
              Spärrar räknas per avdelning och IP-adress: 4 felaktiga försök ger 10 minuters spärr, därefter 2 försök
              till innan inloggningen låses tills den låses upp här. Rotationssidan påverkas aldrig.
            </p>
          </div>
          {loginLocks.length === 0 ? (
            <p className="text-sm text-stone-500">Inga inloggningar är spärrade just nu.</p>
          ) : (
            <div className="space-y-3">
              {loginLocks.map((lock) => (
                <div
                  key={lock.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4 text-sm dark:border-[#334155]"
                >
                  <div>
                    <p className="font-semibold text-ink">{lock.department?.name ?? "Siteadmin"}</p>
                    <p className="mt-1 text-stone-500">
                      IP {lock.ip} • {lock.failures} felaktiga försök •{" "}
                      {lock.permanentlyLocked ? "låst tills den låses upp" : `spärrad till ${formatDate(lock.lockedUntil!)}`}
                    </p>
                  </div>
                  <form action={unlockLoginAction}>
                    <input type="hidden" name="lockId" value={lock.id} />
                    <SubmitButton label="Lås upp" pendingLabel="Låser upp..." className={primaryButton} />
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "log" ? (
        <Panel className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Systemlogg</h2>
            <span className="text-sm text-stone-500">Senaste 50 händelser</span>
          </div>
          {logs.length === 0 ? (
            <EmptyState
              title="Ingen logg ännu"
              description="När adminåtgärder, felaktiga inloggningar eller rotationer sker visas de här."
            />
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-[#334155]">
              {logs.map((log) => {
                const metadata = parseAdminLogMetadata(log.metadata);

                return (
                  <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{log.message}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {log.department?.name ? `${log.department.name} • ` : ""}
                        {log.eventType}
                        {metadata
                          ? ` • ${Object.entries(metadata)
                              .map(([key, value]) => `${key}: ${String(value)}`)
                              .join(" • ")}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-xs text-stone-500">{formatDate(log.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "tools" ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Panel className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Simulering</h2>
            <p className="text-sm text-stone-500">
              Kör rotationsalgoritmen många gånger i rad och se hur jämnt zoner och grannar fördelas över tid.
            </p>
            <Link href="/admin/simulation" className={cn(primaryButton, "inline-flex")}>
              Öppna simuleringen
            </Link>
          </Panel>
          <Panel className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Exportera all historik</h2>
            <p className="text-sm text-stone-500">
              Alla rotationer för alla avdelningar som CSV. Export per avdelning finns under Inställningar på varje
              avdelning.
            </p>
            <Link href="/admin/export/rotations" className={cn(secondaryButton, "inline-flex")}>
              Ladda ner CSV
            </Link>
          </Panel>
        </div>
      ) : null}
    </PageShell>
  );
}
