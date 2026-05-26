import Link from "next/link";
import { generateRotationAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { requireDepartmentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function RotationGenerationPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupId?: string; error?: string; success?: string }>;
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
          people: {
            where: { active: true, archived: false },
            orderBy: { name: "asc" }
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
  const selectedGroupId = query.groupId || department.groups[0]?.id;
  const latestRotation = selectedGroupId
    ? await prisma.rotation.findFirst({
        where: { departmentId: id, groupId: selectedGroupId },
        orderBy: { createdAt: "desc" },
        include: {
          group: true,
          assignments: {
            orderBy: { zoneIndex: "asc" },
            include: {
              zone: true,
              person: true
            }
          }
        }
      })
    : null;

  return (
    <PageShell
      title={`Generera rotation för ${department.name}`}
      description="Algoritmen provar många slumpade kandidater och väljer den rotation som får lägst totalpoäng."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { href: `/departments/${department.id}`, label: department.name },
        { label: "Rotation" }
      ]}
      action={
        <Link
          href={`/departments/${department.id}/rotations`}
          className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
        >
          Historik
        </Link>
      }
    >
      <StatusMessage error={query.error} success={query.success} />

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Ny rotation</h2>
            <p className="mt-1 text-sm text-stone-500">
              Endast aktiva zoner används. Om en zon är avstängd minskar också antalet personer som behövs.
            </p>
          </div>

          <div className="rounded-2xl bg-sand p-4 text-sm text-stone-700">
            <p>{activeZones.length} aktiva zoner i avdelningen</p>
            <p className="mt-1">{activeZones.length} personer behövs</p>
            <p className="mt-2">
              {activeZones.length > 0
                ? activeZones.map((zone) => `${zone.orderIndex}. ${zone.name}`).join(" | ")
                : "Inga aktiva zoner just nu"}
            </p>
          </div>

          {department.groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
              Inga grupper ännu. Lägg till grupper på redigeringssidan först.
            </div>
          ) : activeZones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
              Inga aktiva zoner ännu. Aktivera minst en zon på redigeringssidan först.
            </div>
          ) : (
            <div className="space-y-4">
              {department.groups.map((group) => (
                <form
                  key={group.id}
                  action={generateRotationAction}
                  className="rounded-2xl border border-stone-200 p-4"
                >
                  <input type="hidden" name="departmentId" value={department.id} />
                  <input type="hidden" name="groupId" value={group.id} />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{group.name}</p>
                      <p className="mt-1 text-sm text-stone-500">{group.people.length} aktiva personer</p>
                    </div>
                    <SubmitButton
                      label="Generera rotation"
                      pendingLabel="Genererar..."
                      className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
                    />
                  </div>
                </form>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Senaste rotationen</h2>
              <p className="mt-1 text-sm text-stone-500">
                {latestRotation
                  ? `Visar senaste sparade rotation för ${latestRotation.group.name}.`
                  : "Ingen sparad rotation för vald grupp ännu."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {department.groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/departments/${department.id}/rotation?groupId=${group.id}`}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${
                    group.id === selectedGroupId
                      ? "bg-ink text-white"
                      : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal"
                  }`}
                >
                  {group.name}
                </Link>
              ))}
            </div>
          </div>

          {latestRotation ? (
            <>
              <div className="rounded-2xl bg-sand p-4 text-sm text-stone-700">
                <p>{formatDate(latestRotation.createdAt)}</p>
                <p className="mt-1">Poäng: {latestRotation.score}</p>
              </div>
              <div className="space-y-3">
                {latestRotation.assignments.map((assignment, index) => (
                  <div key={assignment.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{assignment.zone.name}</p>
                      <span className="text-sm text-stone-500">Plats {assignment.zoneIndex}</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">Tilldelad: {assignment.person.name}</p>
                    <p className="mt-1 text-sm text-stone-500">
                      Framför:{" "}
                      {latestRotation.assignments[
                        index === 0 ? latestRotation.assignments.length - 1 : index - 1
                      ]?.person.name}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
              Välj en grupp och generera en rotation för att se resultat här.
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
