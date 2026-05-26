import Link from "next/link";
import { loginDepartmentAction } from "@/app/actions";
import { shouldShowDepartmentLoginHint } from "@/lib/auth";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { prisma } from "@/lib/prisma";

export default async function DepartmentLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const department = await prisma.department.findUnique({
    where: { id },
    select: { id: true, name: true }
  });
  const showLoginHint = await shouldShowDepartmentLoginHint(id);

  if (!department) {
    return (
      <PageShell
        title="Avdelningen hittades inte"
        description="Kontrollera länken eller gå tillbaka till listan över avdelningar."
        breadcrumbs={[
          { href: "/departments", label: "Avdelningar" },
          { label: "Saknas" }
        ]}
      >
        <Panel>
          <Link href="/departments" className="text-sm font-medium text-teal hover:underline">
            Tillbaka till avdelningar
          </Link>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={`Logga in: ${department.name}`}
      description="Använd avdelningens passwordWord följt av aktuell serverminut utan inledande nolla."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { label: department.name }
      ]}
    >
      <Panel className="max-w-2xl">
        <StatusMessage error={query.error} success={query.success} />

        <form action={loginDepartmentAction} className="mt-6 space-y-5">
          <input type="hidden" name="departmentId" value={department.id} />

          {showLoginHint ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              Lösenordet består av avdelningens passwordWord följt av aktuell serverminut, till exempel <code>ord7</code>.
            </div>
          ) : null}

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Lösenord
            </label>
            <input id="password" name="password" type="password" autoFocus />
          </div>

          <div className="flex flex-wrap gap-3">
            <SubmitButton
              label="Logga in"
              pendingLabel="Loggar in..."
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
            />
            <Link
              href="/departments"
              className="rounded-2xl border border-stone-300 px-5 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
            >
              Tillbaka
            </Link>
          </div>
        </form>
      </Panel>
    </PageShell>
  );
}
