import Link from "next/link";
import { loginSiteAdminAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const query = await searchParams;

  return (
    <PageShell
      title="Siteadmin"
      description="Logga in som siteadmin för att hantera övergripande funktioner och skapa nya avdelningar."
      breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: "Siteadmin" }]}
    >
      <Panel className="mx-auto max-w-2xl">
        <StatusMessage error={query.error} success={query.success} />

        <form action={loginSiteAdminAction} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Siteadmin-lösenord
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
