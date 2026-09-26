import Link from "next/link";
import { Panel } from "@/components/cards";
import { DepartmentNav } from "@/components/department-nav";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
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
      zones: { where: { temporary: false }, orderBy: { orderIndex: "asc" } },
      groups: {
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { people: { where: { archived: false } } }
          }
        }
      },
      _count: {
        select: {
          people: { where: { archived: false } },
          rotations: true
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

  // Saker som hindrar att en rotation kan skapas på rotationssidan.
  const issues = [
    ...(activeZones.length === 0 ? ["Det finns inga aktiva zoner. Lägg till eller aktivera zoner."] : []),
    ...(department.groups.length === 0 ? ["Det finns inga skift. Skapa minst ett skift."] : []),
    ...department.groups
      .filter((group) => activeZones.length > 0 && group._count.people < activeZones.length)
      .map(
        (group) =>
          `${group.name} har ${group._count.people} personer men ${activeZones.length} zoner behöver fyllas.`
      )
  ];

  const cards = [
    {
      href: `/departments/${department.id}/edit`,
      title: "Zoner och skift",
      summary: `${activeZones.length} aktiva zoner • ${department.groups.length} skift`,
      description: "Lägg till, byt namn på och ändra ordning på zoner. Skapa och ändra skift."
    },
    {
      href: `/departments/${department.id}/people`,
      title: "Personer",
      summary: `${department._count.people} personer`,
      description: "Lägg till personer, flytta dem mellan skift eller ta bort dem."
    },
    {
      href: `/departments/${department.id}/rotations`,
      title: "Historik",
      summary: `${department._count.rotations} sparade rotationer`,
      description: "Se tidigare rotationer, filtrerat per skift."
    }
  ];

  return (
    <PageShell
      title={department.name}
      description="Här hanterar du avdelningens zoner, skift och personer. Själva rotationerna skapas på rotationssidan."
      breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: department.name }]}
      action={
        <Link
          href={`/rotation/${department.id}`}
          className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]"
        >
          Till rotationssidan
        </Link>
      }
    >
      <DepartmentNav departmentId={department.id} active="overview" />
      <StatusMessage error={query.error} success={query.success} />

      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Panel className="h-full space-y-3 transition group-hover:border-teal/60">
              <h2 className="text-lg font-semibold text-ink group-hover:text-teal">{card.title}</h2>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{card.summary}</p>
              <p className="text-sm text-stone-500">{card.description}</p>
            </Panel>
          </Link>
        ))}
      </div>

      {issues.length > 0 ? (
        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Att åtgärda</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-300">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {activeZones.length > 0 ? (
        <Panel className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Zonernas ordning</h2>
            <p className="mt-1 text-sm text-stone-500">
              Aktiva zoner i den ordning de står. Ordningen avgör vem som står framför vem.
            </p>
          </div>
          <ol className="flex flex-wrap gap-2">
            {activeZones.map((zone) => (
              <li
                key={zone.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-ink dark:border-[#334155] dark:bg-[#0f172a]"
              >
                <span className="mr-2 text-stone-400">{zone.orderIndex}.</span>
                {zone.name}
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </PageShell>
  );
}
