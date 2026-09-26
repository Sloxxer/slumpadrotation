"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { savePeopleAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

type PersonRow = {
  id: string;
  name: string;
  groupId: string;
  active: boolean;
};

type EditableRow = PersonRow & { remove: boolean };

type PeopleRegisterProps = {
  departmentId: string;
  groups: Array<{ id: string; name: string }>;
  people: PersonRow[];
  selectedGroupId?: string;
};

function isChanged(row: EditableRow, original: PersonRow) {
  return (
    row.remove ||
    row.name.trim() !== original.name ||
    row.groupId !== original.groupId ||
    row.active !== original.active
  );
}

const UNSAVED_WARNING = "Du har osparade ändringar i personregistret. Vill du lämna sidan utan att spara?";

// Hela registret redigeras i ett formulär och sparas med en knapp, i stället
// för en spara-knapp per rad.
export function PeopleRegister({ departmentId, groups, people, selectedGroupId }: PeopleRegisterProps) {
  const originals = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const [rows, setRows] = useState<EditableRow[]>(() => people.map((person) => ({ ...person, remove: false })));

  const visibleRows = selectedGroupId
    ? rows.filter((row) => originals.get(row.id)?.groupId === selectedGroupId)
    : rows;
  const changedRows = rows.filter((row) => isChanged(row, originals.get(row.id)!));
  const hasEmptyName = rows.some((row) => !row.remove && row.name.trim() === "");
  const dirty = changedRows.length > 0;

  // Varna innan man lämnar sidan (länkar, flikar, omladdning) med osparade ändringar.
  useEffect(() => {
    if (!dirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function handleLinkClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (link && !window.confirm(UNSAVED_WARNING)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [dirty]);

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function resetAll() {
    setRows(people.map((person) => ({ ...person, remove: false })));
  }

  const changesValue = JSON.stringify(
    changedRows.map(({ id, name, groupId, active, remove }) => ({ id, name: name.trim(), groupId, active, remove }))
  );

  return (
    <form action={savePeopleAction}>
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="redirectGroupId" value={selectedGroupId ?? ""} />
      <input type="hidden" name="changes" value={changesValue} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Personregister</h2>
        <p className="text-sm text-stone-500">
          {visibleRows.length} personer{selectedGroupId ? " i valt skift" : " totalt"}
        </p>
      </div>

      {groups.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/departments/${departmentId}/people`}
            className={cn(
              "rounded-full px-3 py-2 text-xs font-semibold",
              !selectedGroupId
                ? "bg-ink text-white dark:bg-teal"
                : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-300"
            )}
          >
            Alla skift
          </Link>
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/departments/${departmentId}/people?groupId=${group.id}`}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold",
                selectedGroupId === group.id
                  ? "bg-ink text-white dark:bg-teal"
                  : "border border-stone-300 text-stone-600 hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-300"
              )}
            >
              {group.name}
            </Link>
          ))}
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-600 dark:border-[#334155] dark:bg-[#0f172a] dark:text-stone-300">
          Inga personer i det valda skiftet.
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          <div className="hidden grid-cols-[1fr_220px_110px_110px] gap-3 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-400 lg:grid">
            <span>Namn</span>
            <span>Skift</span>
            <span>Aktiv</span>
            <span />
          </div>
          {visibleRows.map((row) => {
            const changed = isChanged(row, originals.get(row.id)!);
            const emptyName = !row.remove && row.name.trim() === "";

            return (
              <div
                key={row.id}
                className={cn(
                  "grid items-center gap-3 rounded-2xl border p-3 lg:grid-cols-[1fr_220px_110px_110px]",
                  row.remove
                    ? "border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20"
                    : changed
                      ? "border-accent/60 bg-accent/5 dark:border-accent/50 dark:bg-accent/10"
                      : "border-stone-200 dark:border-[#334155]"
                )}
              >
                <input
                  value={row.name}
                  onChange={(event) => updateRow(row.id, { name: event.target.value })}
                  disabled={row.remove}
                  aria-label={`Namn för ${originals.get(row.id)?.name}`}
                  aria-invalid={emptyName}
                  className={cn(row.remove && "line-through opacity-60", emptyName && "border-red-400")}
                />
                <select
                  value={row.groupId}
                  onChange={(event) => updateRow(row.id, { groupId: event.target.value })}
                  disabled={row.remove}
                  aria-label={`Skift för ${originals.get(row.id)?.name}`}
                  className={cn(row.remove && "opacity-60")}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-stone-300 px-4 py-3 text-sm text-ink dark:border-[#475569]",
                    row.remove && "opacity-60"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(event) => updateRow(row.id, { active: event.target.checked })}
                    disabled={row.remove}
                    className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                  />
                  Aktiv
                </label>
                <button
                  type="button"
                  onClick={() => updateRow(row.id, { remove: !row.remove })}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-semibold",
                    row.remove
                      ? "border-stone-300 hover:border-teal hover:text-teal dark:border-[#475569]"
                      : "border-stone-300 hover:border-red-400 hover:text-red-600 dark:border-[#475569]"
                  )}
                >
                  {row.remove ? "Ångra" : "Ta bort"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-panel backdrop-blur dark:border-[#334155] dark:bg-[#1e293b]/95">
        <p className="px-2 text-sm text-stone-600 dark:text-stone-300">
          {hasEmptyName
            ? "Alla personer måste ha ett namn."
            : dirty
              ? `${changedRows.length} ${changedRows.length === 1 ? "osparad ändring" : "osparade ändringar"}${
                  changedRows.some((row) => row.remove) ? " (borttagning sker när du sparar)" : ""
                }`
              : "Inga osparade ändringar."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetAll}
            disabled={!dirty}
            className="rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#475569]"
          >
            Ångra alla
          </button>
          <SubmitButton
            label="Spara ändringar"
            pendingLabel="Sparar..."
            disabled={!dirty || hasEmptyName}
            className="rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal dark:hover:bg-[#3d9298]"
          />
        </div>
      </div>
    </form>
  );
}
