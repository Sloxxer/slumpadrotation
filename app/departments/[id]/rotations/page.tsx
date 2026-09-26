import Link from "next/link";
import { Panel } from "@/components/cards";
import { DepartmentNav } from "@/components/department-nav";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { requireDepartmentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export default async function RotationHistoryPage({
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
      groups: { orderBy: { name: "asc" } }
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

  const rotations = await prisma.rotation.findMany({
    where: {
      departmentId: id,
      ...(query.groupId ? { groupId: query.groupId } : {})
    },
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
  });

  return (
    <PageShell
      title="Historik"
      description="Alla rotationer som skapats för avdelningen. Filtrera per skift för att följa mönster över tid."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { href: `/departments/${department.id}`, label: department.name },
        { label: "Historik" }
      ]}
    >
      <DepartmentNav departmentId={department.id} active="history" />
      <StatusMessage error={query.error} success={query.success} />

      <Panel className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/departments/${department.id}/rotations`}
            className={`rounded-full px-3 py-2 text-xs font-semibold ${
              !query.groupId
                ? "bg-ink text-white"
                : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal"
            }`}
          >
            Alla skift
          </Link>
          {department.groups.map((group) => (
            <Link
              key={group.id}
              href={`/departments/${department.id}/rotations?groupId=${group.id}`}
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                query.groupId === group.id
                  ? "bg-ink text-white"
                  : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal"
              }`}
            >
              {group.name}
            </Link>
          ))}
        </div>

        {rotations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600 dark:border-[#334155] dark:bg-[#0f172a] dark:text-stone-300">
            Ingen rotationshistorik matchar det valda filtret ännu.
          </div>
        ) : (
          <div className="space-y-4">
            {rotations.map((rotation) => (
              <div key={rotation.id} className="rounded-2xl border border-stone-200 p-4 dark:border-[#334155]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-ink">{rotation.group.name}</h2>
                    <p className="text-sm text-stone-500">{formatDate(rotation.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20">
                    Poäng {rotation.score}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {rotation.assignments.map((assignment, index) => (
                    <div key={assignment.id} className="rounded-2xl bg-stone-50 p-4 text-sm dark:bg-[#0f172a]">
                      <p className="font-medium text-ink">
                        {assignment.zone.name}: {assignment.person.name}
                      </p>
                      <p className="mt-1 text-stone-500">
                        Framför:{" "}
                        {rotation.assignments[
                          index === 0 ? rotation.assignments.length - 1 : index - 1
                        ]?.person.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
