import Link from "next/link";
import {
  clearDepartmentRotationHistoryAction,
  createDepartmentAction,
  logoutSiteAdminAction,
  setDepartmentArchivedAction,
  updateDepartmentPasswordWordAction
} from "@/app/actions";
import { EmptyState, Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { parseAdminLogMetadata } from "@/lib/admin";
import { requireSiteAdminAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const query = await searchParams;
  await requireSiteAdminAuth();

  const [departments, logs] = await Promise.all([
    prisma.department.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        zones: { orderBy: { orderIndex: "asc" } },
        groups: {
          orderBy: { name: "asc" },
          include: {
            people: {
              orderBy: { name: "asc" }
            }
          }
        },
        _count: {
          select: {
            zones: true,
            groups: true,
            people: true,
            rotations: true
          }
        }
      }
    }),
    prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        department: {
          select: { name: true }
        }
      }
    })
  ]);

  const activeDepartments = departments.filter((department) => !department.archived);
  const archivedDepartments = departments.filter((department) => department.archived);
  const missingZones = activeDepartments.filter(
    (department) => department.zones.filter((zone) => zone.active).length === 0
  );
  const missingGroups = activeDepartments.filter((department) => department.groups.length === 0);
  const groupCapacityIssues = activeDepartments.flatMap((department) => {
    const needed = department.zones.filter((zone) => zone.active).length;

    if (needed === 0) {
      return [];
    }

    return department.groups
      .map((group) => ({
        departmentId: department.id,
        departmentName: department.name,
        groupId: group.id,
        groupName: group.name,
        activePeople: group.people.filter((person) => person.active).length,
        needed
      }))
      .filter((group) => group.activePeople < group.needed);
  });

  return (
    <PageShell
      title="Adminpanel"
      description="Siteadmin hanterar övergripande funktioner för hela webbplatsen och skapar nya avdelningar."
      breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: "Adminpanel" }]}
      action={
        <>
          <Link
            href="/departments"
            className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
          >
            Till avdelningar
          </Link>
          <form action={logoutSiteAdminAction}>
            <SubmitButton
              label="Logga ut"
              pendingLabel="Loggar ut..."
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
            />
          </form>
        </>
      }
    >
      <StatusMessage error={query.error} success={query.success} />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <Panel className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Skapa avdelning</h2>
              <p className="mt-1 text-sm text-stone-500">Endast siteadmin kan skapa nya avdelningar.</p>
            </div>

            <form action={createDepartmentAction} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-ink">
                  Namn
                </label>
                <input id="name" name="name" placeholder="Exempel: Akuten" />
              </div>

              <div className="space-y-2">
                <label htmlFor="passwordWord" className="text-sm font-medium text-ink">
                  PasswordWord
                </label>
                <input id="passwordWord" name="passwordWord" placeholder="Exempel: laser" />
              </div>

              <SubmitButton
                label="Skapa avdelning"
                className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
              />
            </form>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Driftöversikt</h2>
              <span className="text-sm text-stone-500">{departments.length} avdelningar totalt</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-sand p-4">
                <p className="text-sm text-stone-500">Aktiva</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{activeDepartments.length}</p>
              </div>
              <div className="rounded-2xl bg-sand p-4">
                <p className="text-sm text-stone-500">Arkiverade</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{archivedDepartments.length}</p>
              </div>
              <div className="rounded-2xl bg-sand p-4">
                <p className="text-sm text-stone-500">Kapacitetsvarningar</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{groupCapacityIssues.length}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-stone-600">
              <div className="rounded-2xl border border-stone-200 p-4">
                <p className="font-medium text-ink">Avdelningar utan zoner</p>
                <p className="mt-1">
                  {missingZones.length > 0
                    ? missingZones.map((department) => department.name).join(", ")
                    : "Inga problem just nu."}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 p-4">
                <p className="font-medium text-ink">Avdelningar utan grupper</p>
                <p className="mt-1">
                  {missingGroups.length > 0
                    ? missingGroups.map((department) => department.name).join(", ")
                    : "Inga problem just nu."}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 p-4">
                <p className="font-medium text-ink">Skift med för få aktiva personer</p>
                {groupCapacityIssues.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {groupCapacityIssues.map((issue) => (
                      <p key={`${issue.departmentId}-${issue.groupId}`}>
                        {issue.departmentName} / {issue.groupName}: {issue.activePeople} aktiva, behöver {issue.needed}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1">Inga problem just nu.</p>
                )}
              </div>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Export</h2>
              <Link
                href="/admin/export/rotations"
                className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-medium hover:border-teal hover:text-teal"
              >
                Exportera allt
              </Link>
            </div>
            <div className="space-y-3">
              {activeDepartments.length === 0 ? (
                <EmptyState
                  title="Inga aktiva avdelningar"
                  description="Aktivera eller skapa en avdelning för att exportera historik."
                />
              ) : (
                activeDepartments.map((department) => (
                  <div key={department.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{department.name}</p>
                        <p className="mt-1 text-sm text-stone-500">Exportera alla rotationer eller ett enskilt skift.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/export/rotations?departmentId=${department.id}`}
                          className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-medium hover:border-teal hover:text-teal"
                        >
                          Alla rotationer
                        </Link>
                        {department.groups.map((group) => (
                          <Link
                            key={group.id}
                            href={`/admin/export/rotations?departmentId=${department.id}&groupId=${group.id}`}
                            className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-medium hover:border-teal hover:text-teal"
                          >
                            {group.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Säkerhet och status</h2>
              <span className="text-sm text-stone-500">PasswordWord och arkivering</span>
            </div>
            {departments.length === 0 ? (
              <EmptyState
                title="Inga avdelningar ännu"
                description="Skapa den första avdelningen från panelen till vänster."
              />
            ) : (
              <div className="space-y-4">
                {departments.map((department) => (
                  <div key={department.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{department.name}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {department.archived ? "Arkiverad" : "Aktiv"} • {department._count.zones} zoner • {department._count.groups} grupper • {department._count.people} personer
                        </p>
                      </div>
                      <form action={setDepartmentArchivedAction}>
                        <input type="hidden" name="departmentId" value={department.id} />
                        <input type="hidden" name="archived" value={department.archived ? "false" : "true"} />
                        <SubmitButton
                          label={department.archived ? "Återaktivera" : "Arkivera"}
                          pendingLabel="Sparar..."
                          className="rounded-2xl border border-stone-300 px-4 py-2 text-sm font-medium hover:border-teal hover:text-teal"
                        />
                      </form>
                    </div>

                    <form action={updateDepartmentPasswordWordAction} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
                      <input type="hidden" name="departmentId" value={department.id} />
                      <input name="passwordWord" placeholder="Nytt passwordWord" />
                      <SubmitButton
                        label="Byt passwordWord"
                        pendingLabel="Sparar..."
                        className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-teal"
                      />
                    </form>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Rensa historik</h2>
              <span className="text-sm text-stone-500">Per avdelning</span>
            </div>
            {departments.length === 0 ? (
              <EmptyState
                title="Inga avdelningar ännu"
                description="Skapa den första avdelningen innan du rensar historik."
              />
            ) : (
              <div className="space-y-4">
                {departments.map((department) => (
                  <div key={department.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{department.name}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {department._count.rotations} sparade rotationer
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { label: "Äldre än 2 månader", period: "2m" },
                        { label: "Äldre än 6 månader", period: "6m" },
                        { label: "Äldre än 1 år", period: "1y" },
                        { label: "Rensa all historik", period: "all" }
                      ].map((option) => (
                        <form key={option.period} action={clearDepartmentRotationHistoryAction}>
                          <input type="hidden" name="departmentId" value={department.id} />
                          <input type="hidden" name="period" value={option.period} />
                          <SubmitButton
                            label={option.label}
                            pendingLabel="Rensar..."
                            className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                              option.period === "all"
                                ? "border border-red-300 text-red-700 hover:bg-red-50"
                                : "border border-stone-300 hover:border-teal hover:text-teal"
                            }`}
                          />
                        </form>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">Systemlogg</h2>
              <span className="text-sm text-stone-500">Senaste 30 händelser</span>
            </div>
            {logs.length === 0 ? (
              <EmptyState
                title="Ingen logg ännu"
                description="När adminåtgärder, felaktiga inloggningar eller rotationer sker visas de här."
              />
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const metadata = parseAdminLogMetadata(log.metadata);

                  return (
                    <div key={log.id} className="rounded-2xl border border-stone-200 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink">{log.message}</p>
                          <p className="mt-1 text-stone-500">
                            {log.department?.name ? `${log.department.name} • ` : ""}
                            {log.eventType}
                          </p>
                        </div>
                        <span className="text-stone-500">{formatDate(log.createdAt)}</span>
                      </div>
                      {metadata ? (
                        <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                          {Object.entries(metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" • ")}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
