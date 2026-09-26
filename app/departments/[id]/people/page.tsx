import Link from "next/link";
import { createPersonAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { DepartmentNav } from "@/components/department-nav";
import { PageShell } from "@/components/page-shell";
import { PeopleRegister } from "@/components/people-register";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { requireDepartmentAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DepartmentPeoplePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
    groupId?: string;
    archivedDuplicateId?: string;
    pendingName?: string;
    pendingGroupId?: string;
    pendingActive?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireDepartmentAuth(id);

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      groups: { orderBy: { name: "asc" } },
      people: {
        where: { archived: false },
        orderBy: { name: "asc" },
        include: { group: true }
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

  const selectedGroupId =
    query.groupId && department.groups.some((group) => group.id === query.groupId)
      ? query.groupId
      : undefined;

  const people = department.people.map(({ id, name, groupId, active }) => ({ id, name, groupId, active }));
  // Ny nyckel när datan ändras (t.ex. efter att ändringarna sparats) så att
  // registret börjar om från det som faktiskt ligger i databasen.
  const registerKey = department.people.map((person) => `${person.id}:${person.updatedAt.getTime()}`).join("|");

  return (
    <PageShell
      title="Personer"
      description="Varje person tillhör ett skift. Vilka som är på plats väljs på rotationssidan när rotationen skapas."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { href: `/departments/${department.id}`, label: department.name },
        { label: "Personer" }
      ]}
    >
      <DepartmentNav departmentId={department.id} active="people" />
      <StatusMessage error={query.error} success={query.success} />

      <Panel>
        <h2 className="text-lg font-semibold text-ink">Lägg till person</h2>
        {department.groups.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            Skapa minst ett skift under{" "}
            <Link href={`/departments/${department.id}/edit`} className="font-medium text-teal hover:underline">
              Zoner och skift
            </Link>{" "}
            innan du lägger till personer.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {query.archivedDuplicateId && query.pendingName ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  En arkiverad person med namnet {query.pendingName} finns redan.
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Vill du återaktivera den personen eller skapa en helt ny person med samma namn?
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={createPersonAction}>
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="redirectGroupId" value={selectedGroupId ?? ""} />
                    <input type="hidden" name="archivedPersonId" value={query.archivedDuplicateId} />
                    <input type="hidden" name="duplicateAction" value="reactivate" />
                    <input type="hidden" name="name" value={query.pendingName} />
                    <input
                      type="hidden"
                      name="groupId"
                      value={query.pendingGroupId ?? selectedGroupId ?? department.groups[0]?.id ?? ""}
                    />
                    {query.pendingActive === "true" ? <input type="hidden" name="active" value="on" /> : null}
                    <SubmitButton
                      label="Återaktivera befintlig"
                      className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
                    />
                  </form>
                  <form action={createPersonAction}>
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="redirectGroupId" value={selectedGroupId ?? ""} />
                    <input type="hidden" name="archivedPersonId" value={query.archivedDuplicateId} />
                    <input type="hidden" name="duplicateAction" value="create_new" />
                    <input type="hidden" name="name" value={query.pendingName} />
                    <input
                      type="hidden"
                      name="groupId"
                      value={query.pendingGroupId ?? selectedGroupId ?? department.groups[0]?.id ?? ""}
                    />
                    {query.pendingActive === "true" ? <input type="hidden" name="active" value="on" /> : null}
                    <SubmitButton
                      label="Skapa ny person"
                      className="rounded-2xl border border-stone-300 px-5 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
                    />
                  </form>
                  <Link
                    href={selectedGroupId ? `/departments/${department.id}/people?groupId=${selectedGroupId}` : `/departments/${department.id}/people`}
                    className="rounded-2xl border border-stone-300 px-5 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
                  >
                    Avbryt
                  </Link>
                </div>
              </div>
            ) : null}

            <form action={createPersonAction} className="grid gap-4 lg:grid-cols-[1fr_220px_120px_170px]">
              <input type="hidden" name="departmentId" value={department.id} />
              <input type="hidden" name="redirectGroupId" value={selectedGroupId ?? ""} />
              <input name="name" placeholder="Namn" aria-label="Namn" defaultValue={query.pendingName ?? ""} />
              <select
                name="groupId"
                aria-label="Skift"
                defaultValue={query.pendingGroupId ?? selectedGroupId ?? department.groups[0]?.id ?? ""}
              >
                {department.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={query.pendingActive ? query.pendingActive === "true" : true}
                  className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                />
                Aktiv
              </label>
              <SubmitButton
                label="Lägg till"
                className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal"
              />
            </form>
          </div>
        )}
      </Panel>

      <Panel>
        <PeopleRegister
          key={registerKey}
          departmentId={department.id}
          groups={department.groups.map(({ id, name }) => ({ id, name }))}
          people={people}
          selectedGroupId={selectedGroupId}
        />
      </Panel>
    </PageShell>
  );
}
