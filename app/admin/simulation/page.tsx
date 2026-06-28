import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { RotationSimulator } from "@/components/rotation-simulator";
import { requireSiteAdminAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function SimulationPage() {
  await requireSiteAdminAuth();

  const departments = await prisma.department.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
    include: {
      zones: {
        where: { active: true, temporary: false },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true, orderIndex: true }
      },
      groups: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          people: {
            where: { archived: false, active: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  return (
    <PageShell
      title="Rotationssimulering"
      description="Simulera en sekvens av rotationer och analysera hur jämt algoritmen fördelar personer och zoner över tid."
      breadcrumbs={[
        { href: "/admin", label: "Adminpanel" },
        { label: "Simulering" }
      ]}
      action={
        <Link
          href="/admin"
          className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
        >
          Tillbaka
        </Link>
      }
    >
      {departments.length === 0 ? (
        <Panel>
          <p className="text-sm text-stone-500">Inga aktiva avdelningar hittades.</p>
        </Panel>
      ) : (
        <RotationSimulator departments={departments} />
      )}
    </PageShell>
  );
}
