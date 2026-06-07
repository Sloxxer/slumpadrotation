import Link from "next/link";
import { EmptyState, Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { prisma } from "@/lib/prisma";

export default async function PublicRotationDepartmentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const query = await searchParams;
  const departments = await prisma.department.findMany({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
    include: {
      zones: true,
      groups: true,
      people: {
        where: { archived: false }
      }
    }
  });

  return (
    <PageShell
      title="Ny rotation"
      description="Välj vilken avdelning du vill skapa en ny rotation för."
      breadcrumbs={[{ label: "Ny rotation" }]}
      action={
        <Link
          href="/admin"
          className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]"
        >
          Adminpanel
        </Link>
      }
    >
      <StatusMessage error={query.error} success={query.success} />

      {departments.length === 0 ? (
        <EmptyState
          title="Inga avdelningar ännu"
          description="Skapa en avdelning i adminpanelen först innan det går att generera en rotation."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {departments.map((department) => {
            const activeZones = department.zones.filter((zone) => zone.active).length;

            return (
              <Panel key={department.id} className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-ink">{department.name}</h2>
                  <p className="text-sm text-stone-600">
                    {activeZones} aktiva zoner, {department.groups.length} skift och {department.people.length} personer.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/rotation/${department.id}`}
                    className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]"
                  >
                    Välj avdelning
                  </Link>
                  <Link
                    href={`/departments/${department.id}/login`}
                    className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-200 dark:hover:border-teal dark:hover:text-teal"
                  >
                    Logga in
                  </Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
