import Link from "next/link";
import { loginDepartmentAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { getClientIp, getLoginLockStatus, loginLockMessage } from "@/lib/login-lock";
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

  const lockStatus = await getLoginLockStatus({ kind: "department", departmentId: department.id }, await getClientIp());
  const showLoginHint = !lockStatus.locked && lockStatus.failures >= 2;

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
        <StatusMessage
          error={lockStatus.locked ? loginLockMessage(lockStatus) : query.error}
          success={lockStatus.locked ? undefined : query.success}
        />

        {lockStatus.locked ? (
          <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
            Det går fortfarande att skapa rotationer via{" "}
            <Link href={`/rotation/${department.id}`} className="font-medium text-teal hover:underline">
              den publika rotationssidan
            </Link>
            .
          </p>
        ) : null}

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
            <input id="password" name="password" type="password" autoFocus disabled={lockStatus.locked} />
          </div>

          <div className="flex flex-wrap gap-3">
            <SubmitButton
              label="Logga in"
              pendingLabel="Loggar in..."
              disabled={lockStatus.locked}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40"
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
