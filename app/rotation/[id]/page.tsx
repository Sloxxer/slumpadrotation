import Link from "next/link";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { RotationGroupForm } from "@/components/rotation-group-form";
import { RotationResultModal } from "@/components/rotation-result-modal";
import { StatusMessage } from "@/components/status-message";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function PublicRotationDepartmentPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupId?: string; error?: string; success?: string; rotationId?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      zones: {
        orderBy: { orderIndex: "asc" }
      },
      groups: {
        orderBy: { name: "asc" },
        include: {
          people: {
            where: { archived: false },
            orderBy: { name: "asc" }
          },
          _count: {
            select: {
              people: true
            }
          }
        }
      }
    }
  });

  if (!department || department.archived) {
    return (
      <PageShell
        title="Avdelningen hittades inte"
        description="Kontrollera att du valt rätt avdelning eller att avdelningen fortfarande är aktiv."
        breadcrumbs={[{ href: "/rotation", label: "Ny rotation" }, { label: "Saknas" }]}
      >
        <Panel>
          <Link href="/rotation" className="text-sm font-medium text-teal hover:underline">
            Tillbaka till avdelningsval
          </Link>
        </Panel>
      </PageShell>
    );
  }

  const selectedGroupId = query.groupId || department.groups[0]?.id;
  const availableZones = department.zones.filter((zone) => zone.active);
  const rotation =
    query.rotationId && selectedGroupId
      ? await prisma.rotation.findFirst({
          where: {
            id: query.rotationId,
            departmentId: department.id,
            groupId: selectedGroupId
          },
          include: {
            group: {
              select: {
                id: true,
                name: true
              }
            },
            assignments: {
              orderBy: {
                zoneIndex: "asc"
              },
              include: {
                zone: true,
                person: true
              }
            }
          }
        })
      : null;

  const closeModalHref = `/rotation/${department.id}?groupId=${selectedGroupId}`;

  const unassignedPeople = (() => {
    if (!rotation) return [];
    const assignedIds = new Set(rotation.assignments.map((a) => a.person.id));
    const rotationGroup = department.groups.find((g) => g.id === rotation.group.id);
    return rotationGroup?.people.filter((p) => p.active && !assignedIds.has(p.id)) ?? [];
  })();

  return (
    <PageShell
      title={`Ny rotation: ${department.name}`}
      description="Välj skift och skapa en ny rotation."
      breadcrumbs={[
        { href: "/rotation", label: "Ny rotation" },
        { label: department.name }
      ]}
      action={
        <>
          <Link
            href="/"
            className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
          >
            Startsida
          </Link>
          <Link
            href="/rotation"
            className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
          >
            Byt avdelning
          </Link>
        </>
      }
    >
      <StatusMessage error={query.error} success={rotation ? undefined : query.success} />

      <Panel className="mx-auto w-full max-w-5xl space-y-5">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <h2 className="text-lg font-semibold text-ink">Välj skift</h2>
            <p className="mt-1 text-sm text-stone-500">
              Välj skift, markera vilka zoner som ska vara med och skapa sedan en ny rotation.
            </p>
          </div>

          <div className="rounded-2xl bg-sand p-4 text-sm text-stone-700 dark:text-stone-300">
            <p>{availableZones.length} zoner tillgängliga</p>
            <p className="mt-1">Alla zoner är valda från start</p>
            <p className="mt-2">
              {availableZones.length > 0
                ? availableZones.map((zone) => `${zone.orderIndex}. ${zone.name}`).join(" | ")
                : "Alla zoner är inaktiva just nu"}
            </p>
          </div>
        </div>

        {department.groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
            Den här avdelningen saknar skift.
          </div>
        ) : availableZones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
            Det finns inga aktiva zoner. Aktivera minst en zon på redigeringssidan först.
          </div>
        ) : (
          <RotationGroupForm
            departmentId={department.id}
            groups={department.groups}
            zones={availableZones}
            initialGroupId={selectedGroupId}
          />
        )}
      </Panel>

      {rotation ? (
        <RotationResultModal
          closeHref={closeModalHref}
          createdAtLabel={formatDate(rotation.createdAt)}
          departmentName={department.name}
          groupName={rotation.group.name}
          score={rotation.score}
          assignments={rotation.assignments}
          unassignedPeople={unassignedPeople}
        />
      ) : null}
    </PageShell>
  );
}
