import Link from "next/link";
import {
  createGroupAction,
  createZoneAction,
  deleteDepartmentAction,
  deleteGroupAction,
  deleteZoneAction,
  updateDepartmentAction,
  updateGroupAction,
  updateZoneAction
} from "@/app/actions";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { requireDepartmentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DepartmentEditPage({
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
            select: {
              people: true,
              rotations: true
            }
          }
        }
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

  const activeZones = department.zones.filter((zone) => zone.active);

  return (
    <PageShell
      title={`Redigera ${department.name}`}
      description="Hantera avdelningens grunddata, zonnamn, zonordning samt grupper och skift på samma sida."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { href: `/departments/${department.id}`, label: department.name },
        { label: "Redigera" }
      ]}
      action={
        <Link
          href={`/departments/${department.id}`}
          className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
        >
          Tillbaka till översikt
        </Link>
      }
    >
      <StatusMessage error={query.error} success={query.success} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <h2 className="text-lg font-semibold text-ink">Avdelningsuppgifter</h2>
          <form action={updateDepartmentAction} className="mt-6 space-y-5">
            <input type="hidden" name="departmentId" value={department.id} />

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-ink">
                Namn
              </label>
              <input id="name" name="name" defaultValue={department.name} />
            </div>

            <div className="space-y-2">
              <label htmlFor="passwordWord" className="text-sm font-medium text-ink">
                PasswordWord
              </label>
              <input id="passwordWord" name="passwordWord" defaultValue={department.passwordWord} />
              <p className="text-sm text-stone-500">
                Giltigt inloggningslösenord = passwordWord + aktuell serverminut.
              </p>
            </div>

            <SubmitButton
              label="Spara avdelning"
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
            />
          </form>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold text-ink">Lägg till zon</h2>
          <p className="mt-1 text-sm text-stone-500">
            Nya zoner läggs sist i ordningen och påverkar vem som står framför vem.
          </p>
          <form action={createZoneAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="departmentId" value={department.id} />
            <input name="name" placeholder="Exempel: Laser 1" />
            <SubmitButton
              label="Lägg till zon"
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
            />
          </form>
        </Panel>

        <Panel className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Zoner och ordning</h2>
              <p className="mt-1 text-sm text-stone-500">
                Redigera varje zon separat. Endast aktiva zoner används i rotationen.
              </p>
            </div>
            <div className="rounded-2xl bg-sand px-4 py-3 text-sm text-stone-700">
              <p>{activeZones.length} aktiva zoner</p>
              <p className="mt-1">{activeZones.length} personer behövs för full rotation</p>
            </div>
          </div>
          {department.zones.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
              Inga zoner ännu. Lägg till minst en zon för att kunna skapa rotationer.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {department.zones.map((zone) => (
                <div
                  key={zone.id}
                  className="grid gap-4 rounded-2xl border border-stone-200 p-4 xl:grid-cols-[1fr_140px_160px_150px_140px]"
                >
                  <form action={updateZoneAction} className="contents">
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <input name="name" defaultValue={zone.name} aria-label={`Namn för zon ${zone.name}`} />
                    <input
                      name="orderIndex"
                      type="number"
                      min={1}
                      max={department.zones.length}
                      defaultValue={zone.orderIndex}
                      aria-label={`Ordning för zon ${zone.name}`}
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={zone.active}
                        className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                      />
                      Aktiv zon
                    </label>
                    <SubmitButton
                      label="Spara zon"
                      className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
                    />
                  </form>
                  <form action={deleteZoneAction}>
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <SubmitButton
                      label="Ta bort"
                      pendingLabel="Tar bort..."
                      className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-red-400 hover:text-red-600"
                    />
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Grupper och skift</h2>
          <p className="mt-1 text-sm text-stone-500">
            Skapa, uppdatera och ta bort grupper direkt här, till exempel Skift A, Skift B eller Natt.
          </p>

          <form action={createGroupAction} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="departmentId" value={department.id} />
            <input name="name" placeholder="Exempel: Skift A" />
            <SubmitButton
              label="Lägg till grupp"
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
            />
          </form>

          <div className="mt-6 space-y-4">
            {department.groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
                Inga grupper ännu. Lägg till minst en grupp för att kunna koppla personer och skapa rotationer.
              </div>
            ) : (
              department.groups.map((group) => (
                <div
                  key={group.id}
                  className="grid gap-4 rounded-2xl border border-stone-200 p-4 xl:grid-cols-[1fr_1fr_150px_140px]"
                >
                  <form action={updateGroupAction} className="contents">
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="groupId" value={group.id} />
                    <input name="name" defaultValue={group.name} aria-label={`Namn för grupp ${group.name}`} />
                    <div className="flex items-center text-sm text-stone-500">
                      {group._count.people} personer, {group._count.rotations} rotationer
                    </div>
                    <SubmitButton
                      label="Spara grupp"
                      className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
                    />
                  </form>
                  <form action={deleteGroupAction}>
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="groupId" value={group.id} />
                    <SubmitButton
                      label="Ta bort"
                      pendingLabel="Tar bort..."
                      className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-red-400 hover:text-red-600"
                    />
                  </form>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Farlig zon</h2>
          <p className="mt-1 text-sm text-stone-500">
            Att ta bort avdelningen raderar även zoner, grupper, personer och rotationshistorik.
          </p>
          <form action={deleteDepartmentAction} className="mt-6">
            <input type="hidden" name="departmentId" value={department.id} />
            <SubmitButton
              label="Ta bort avdelning"
              pendingLabel="Tar bort..."
              className="rounded-2xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-50"
            />
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
