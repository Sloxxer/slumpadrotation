import Link from "next/link";
import { loginSiteAdminAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { getClientIp, getLoginLockStatus, loginLockMessage } from "@/lib/login-lock";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const query = await searchParams;
  const lockStatus = await getLoginLockStatus({ kind: "site-admin" }, await getClientIp());

  return (
    <PageShell
      title="Siteadmin"
      description="Logga in som siteadmin för att hantera övergripande funktioner och skapa nya avdelningar."
      breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: "Siteadmin" }]}
    >
      <Panel className="mx-auto max-w-2xl">
        <StatusMessage
          error={lockStatus.locked ? loginLockMessage(lockStatus) : query.error}
          success={lockStatus.locked ? undefined : query.success}
        />

        <form action={loginSiteAdminAction} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Siteadmin-lösenord
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
