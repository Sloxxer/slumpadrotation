import Link from "next/link";
import { createPersonAction, deletePersonAction, updatePersonAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { PageShell } from "@/components/page-shell";
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

  const filteredPeople = selectedGroupId
    ? department.people.filter((person) => person.groupId === selectedGroupId)
    : department.people;

  return (
    <PageShell
      title={`Personer i ${department.name}`}
      description="Varje person kopplas till en grupp. Endast aktiva personer används i rotationer."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { href: `/departments/${department.id}`, label: department.name },
        { label: "Personer" }
      ]}
      action={
        <Link
          href={`/departments/${department.id}`}
          className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
        >
          Tillbaka till översikt
        </Link>
      }
    >
      <StatusMessage error={query.error} success={query.success} />

      <Panel>
        <h2 className="text-lg font-semibold text-ink">Lägg till person</h2>
        {department.groups.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            Skapa minst en grupp på redigeringssidan innan du lägger till personer.
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
              <input name="name" placeholder="Namn" defaultValue={query.pendingName ?? ""} />
              <select
                name="groupId"
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Personregister</h2>
          <p className="text-sm text-stone-500">
            {filteredPeople.length} personer{selectedGroupId ? " i valt skift" : " totalt"}
          </p>
        </div>

        {department.groups.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {department.groups.map((group) => (
              <Link
                key={group.id}
                href={`/departments/${department.id}/people?groupId=${group.id}`}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${
                  selectedGroupId === group.id
                    ? "bg-ink text-white"
                    : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal"
                }`}
              >
                {group.name}
              </Link>
            ))}
            <Link
              href={`/departments/${department.id}/people`}
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                !query.groupId
                  ? "bg-ink text-white"
                  : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal"
              }`}
            >
              Alla
            </Link>
          </div>
        ) : null}

        {filteredPeople.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600">
            Inga personer i det valda skiftet.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredPeople.map((person) => (
              <div key={person.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_220px_120px_140px_140px]">
                  <form action={updatePersonAction} className="contents">
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="personId" value={person.id} />
                    <input type="hidden" name="redirectGroupId" value={selectedGroupId ?? ""} />
                    <input name="name" defaultValue={person.name} aria-label={`Namn för ${person.name}`} />
                    <select name="groupId" defaultValue={person.groupId}>
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
                        defaultChecked={person.active}
                        className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                      />
                      Aktiv
                    </label>
                    <SubmitButton
                      label="Spara"
                      className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-teal hover:text-teal"
                    />
                  </form>
                  <form action={deletePersonAction}>
                    <input type="hidden" name="departmentId" value={department.id} />
                    <input type="hidden" name="personId" value={person.id} />
                    <input type="hidden" name="redirectGroupId" value={selectedGroupId ?? ""} />
                    <SubmitButton
                      label="Ta bort"
                      pendingLabel="Tar bort..."
                      className="rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold hover:border-red-400 hover:text-red-600"
                    />
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
