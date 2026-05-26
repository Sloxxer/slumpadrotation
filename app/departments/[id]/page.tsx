import Link from "next/link";
import { logoutDepartmentAction } from "@/app/actions";
import { EmptyState, Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { requireDepartmentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DepartmentDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireDepartmentAuth(id);

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      zones: { orderBy: { orderIndex: "asc" } },
      groups: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { people: true, rotations: true }
          }
        }
      },
      people: {
        where: { archived: false },
        orderBy: { name: "asc" },
        include: { group: true }
      }
    }
  });

  if (!department) {
    return (
      <PageShell
        title="Avdelningen hittades inte"
        description="Den här avdelningen verkar inte finnas längre."
        breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: "Saknas" }]}
      >
        <Panel>
          <Link href="/departments" className="text-sm font-medium text-teal hover:underline">
            Tillbaka till avdelningar
          </Link>
        </Panel>
      </PageShell>
    );
  }

  const activePeople = department.people.filter((person) => person.active).length;
  const inactivePeople = department.people.length - activePeople;
  const activeZones = department.zones.filter((zone) => zone.active);

  return (
    <PageShell
      title={department.name}
      description="Översikt över grupper, zoner och personer för avdelningen."
      breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: department.name }]}
      action={
        <>
          <Link
            href={`/departments/${department.id}/edit`}
            className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
          >
            Redigera
          </Link>
          <Link
            href={`/departments/${department.id}/people`}
            className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
          >
            Personer
          </Link>
          <Link
            href={`/departments/${department.id}/rotation`}
            className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-teal"
          >
            Skapa rotation
          </Link>
        </>
      }
    >
      <StatusMessage error={query.error} success={query.success} />

      <div className="space-y-5">
        <Panel className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Avdelningsöversikt
              </p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Läget just nu</h2>
              <p className="mt-1 text-sm text-stone-500">
                En snabb sammanfattning av bemanning, zoner och skift.
              </p>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-3 text-sm text-stone-700">
              <p>{department.people.length} personer totalt</p>
              <p className="mt-1">{inactivePeople} inaktiva just nu</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.75rem] bg-sand p-5">
              <p className="text-sm text-stone-500">Aktiva zoner</p>
              <p className="mt-3 text-4xl font-semibold text-ink">{activeZones.length}</p>
            </div>
            <div className="rounded-[1.75rem] bg-sand p-5">
              <p className="text-sm text-stone-500">Grupper</p>
              <p className="mt-3 text-4xl font-semibold text-ink">{department.groups.length}</p>
            </div>
            <div className="rounded-[1.75rem] bg-sand p-5">
              <p className="text-sm text-stone-500">Aktiva personer</p>
              <p className="mt-3 text-4xl font-semibold text-ink">{activePeople}</p>
            </div>
            <div className="rounded-[1.75rem] border border-stone-200 bg-white p-5">
              <p className="text-sm text-stone-500">Historik</p>
              <p className="mt-3 text-lg font-semibold text-ink">Se sparade rotationer</p>
              <Link
                href={`/departments/${department.id}/rotations`}
                className="mt-4 inline-flex text-sm font-medium text-teal hover:underline"
              >
                Öppna historik
              </Link>
            </div>
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
          <Panel className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Aktiva zoner i ordning</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Endast aktiva zoner används i rotationen. Ordningen visar vem som står längst fram.
                </p>
              </div>
              <Link
                href={`/departments/${department.id}/edit`}
                className="text-sm font-medium text-teal hover:underline"
              >
                Ändra zoner
              </Link>
            </div>

            {activeZones.length === 0 ? (
              <EmptyState
                title="Inga aktiva zoner"
                description="Aktivera minst en zon på redigeringssidan för att kunna skapa rotationer."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeZones.map((zone) => (
                  <div key={zone.id} className="rounded-[1.6rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Plats {zone.orderIndex}</p>
                    <p className="mt-3 text-lg font-semibold text-ink">{zone.name}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Grupper och skift</h2>
              <p className="mt-1 text-sm text-stone-500">
                Se hur många personer och rotationer varje skift har.
              </p>
            </div>

            {department.groups.length === 0 ? (
              <EmptyState
                title="Inga grupper ännu"
                description="Skapa grupper eller skift på redigeringssidan, till exempel Skift A, Skift B eller Natt."
              />
            ) : (
              <div className="space-y-3">
                {department.groups.map((group) => (
                  <div key={group.id} className="rounded-[1.6rem] border border-stone-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{group.name}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {group._count.people} personer kopplade till skiftet
                        </p>
                      </div>
                      <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-stone-700">
                        {group._count.rotations} rotationer
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <Panel className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Snabbvägar</h2>
              <p className="mt-1 text-sm text-stone-500">
                Vanliga uppgifter samlade på ett ställe.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Link
                href={`/departments/${department.id}/edit`}
                className="rounded-[1.4rem] border border-stone-300 px-4 py-4 text-sm font-medium hover:border-teal hover:text-teal"
              >
                Hantera zoner och grupper
              </Link>
              <Link
                href={`/departments/${department.id}/people`}
                className="rounded-[1.4rem] border border-stone-300 px-4 py-4 text-sm font-medium hover:border-teal hover:text-teal"
              >
                Hantera personer
              </Link>
              <Link
                href={`/departments/${department.id}/rotation`}
                className="rounded-[1.4rem] border border-stone-300 px-4 py-4 text-sm font-medium hover:border-teal hover:text-teal"
              >
                Generera ny rotation
              </Link>
              <Link
                href={`/departments/${department.id}/rotations`}
                className="rounded-[1.4rem] border border-stone-300 px-4 py-4 text-sm font-medium hover:border-teal hover:text-teal"
              >
                Se rotationshistorik
              </Link>
            </div>
          </Panel>

          <Panel className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Session</h2>
              <p className="mt-1 text-sm text-stone-500">Avsluta inloggningen för den här avdelningen.</p>
            </div>
            <form action={logoutDepartmentAction}>
              <input type="hidden" name="departmentId" value={department.id} />
              <SubmitButton
                label="Logga ut"
                pendingLabel="Loggar ut..."
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
              />
            </form>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
