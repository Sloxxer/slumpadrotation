"use client";

import { useMemo, useState } from "react";
import { transferPeopleAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { useFormStatus } from "react-dom";

type TransferDepartment = {
  id: string;
  name: string;
  groups: Array<{
    id: string;
    name: string;
    people: Array<{ id: string; name: string; active: boolean }>;
  }>;
};

type Mode = "copy" | "move";

const normalize = (name: string) => name.trim().toLocaleLowerCase("sv-SE");

function TransferSubmitButton({ label, disabled, confirmMessage }: { label: string; disabled: boolean; confirmMessage: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal dark:hover:bg-[#3d9298]"
    >
      {pending ? "Sparar..." : label}
    </button>
  );
}

// Välj personer i ett skift och kopiera eller flytta dem till ett annat skift,
// även i en annan avdelning. Historiken följer inte med.
export function PeopleTransfer({ departments }: { departments: TransferDepartment[] }) {
  const firstWithGroups = departments.find((department) => department.groups.length > 0);
  const [sourceDepartmentId, setSourceDepartmentId] = useState(firstWithGroups?.id ?? "");
  const [sourceGroupId, setSourceGroupId] = useState(firstWithGroups?.groups[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [mode, setMode] = useState<Mode>("copy");

  const sourceDepartment = departments.find((department) => department.id === sourceDepartmentId);
  const sourceGroup = sourceDepartment?.groups.find((group) => group.id === sourceGroupId);
  const targetDepartment = departments.find((department) => department.id === targetDepartmentId);
  const targetGroup = targetDepartment?.groups.find((group) => group.id === targetGroupId);

  const existingInTarget = useMemo(
    () => new Set(targetGroup?.people.map((person) => normalize(person.name)) ?? []),
    [targetGroup]
  );

  const sourcePeople = sourceGroup?.people ?? [];
  const selectedPeople = sourcePeople.filter((person) => selected.includes(person.id));
  const willTransfer = selectedPeople.filter((person) => !existingInTarget.has(normalize(person.name)));
  const sameGroup = Boolean(targetGroupId) && targetGroupId === sourceGroupId;
  const canSubmit = Boolean(sourceGroup && targetGroup) && !sameGroup && willTransfer.length > 0;

  function selectSourceDepartment(id: string) {
    setSourceDepartmentId(id);
    setSourceGroupId(departments.find((department) => department.id === id)?.groups[0]?.id ?? "");
    setSelected([]);
  }

  function selectSourceGroup(id: string) {
    setSourceGroupId(id);
    setSelected([]);
  }

  function selectTargetDepartment(id: string) {
    setTargetDepartmentId(id);
    setTargetGroupId(departments.find((department) => department.id === id)?.groups[0]?.id ?? "");
  }

  function togglePerson(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((personId) => personId !== id)));
  }

  const allSelected = sourcePeople.length > 0 && selectedPeople.length === sourcePeople.length;
  const verb = mode === "move" ? "Flytta" : "Kopiera";
  const countLabel = `${willTransfer.length} ${willTransfer.length === 1 ? "person" : "personer"}`;
  const confirmMessage =
    targetGroup && targetDepartment && sourceGroup && sourceDepartment
      ? `${verb} ${countLabel} från ${sourceDepartment.name} / ${sourceGroup.name} till ${targetDepartment.name} / ${targetGroup.name}?` +
        (mode === "move" ? " De tas bort från det gamla skiftet." : "")
      : "";

  return (
    <form action={transferPeopleAction} className="space-y-6">
      <input type="hidden" name="sourceGroupId" value={sourceGroupId} />
      <input type="hidden" name="targetGroupId" value={targetGroupId} />
      <input type="hidden" name="mode" value={mode} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Från */}
        <section className="space-y-4 rounded-2xl border border-stone-200 p-4 dark:border-[#334155]">
          <h3 className="font-semibold text-ink">1. Från</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="source-department" className="text-sm font-medium text-ink">
                Avdelning
              </label>
              <select
                id="source-department"
                value={sourceDepartmentId}
                onChange={(event) => selectSourceDepartment(event.target.value)}
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="source-group" className="text-sm font-medium text-ink">
                Skift
              </label>
              <select
                id="source-group"
                value={sourceGroupId}
                onChange={(event) => selectSourceGroup(event.target.value)}
                disabled={!sourceDepartment || sourceDepartment.groups.length === 0}
              >
                {sourceDepartment?.groups.length ? null : <option value="">Inga skift</option>}
                {sourceDepartment?.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.people.length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sourcePeople.length === 0 ? (
            <p className="text-sm text-stone-500">Det finns inga personer i det här skiftet.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">
                  Personer ({selectedPeople.length} av {sourcePeople.length} valda)
                </p>
                <button
                  type="button"
                  onClick={() => setSelected(allSelected ? [] : sourcePeople.map((person) => person.id))}
                  className="text-sm font-medium text-teal hover:underline"
                >
                  {allSelected ? "Avmarkera alla" : "Markera alla"}
                </button>
              </div>
              <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {sourcePeople.map((person) => {
                  const alreadyInTarget = existingInTarget.has(normalize(person.name));
                  return (
                    <label
                      key={person.id}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-ink",
                        selected.includes(person.id)
                          ? "border-teal/60 bg-teal/5 dark:bg-teal/10"
                          : "border-stone-200 bg-stone-50 dark:border-[#334155] dark:bg-[#0f172a]"
                      )}
                    >
                      <input
                        type="checkbox"
                        name="personIds"
                        value={person.id}
                        checked={selected.includes(person.id)}
                        onChange={(event) => togglePerson(person.id, event.target.checked)}
                        className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                      />
                      <span className="truncate">{person.name}</span>
                      {alreadyInTarget ? (
                        <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          finns redan
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Till */}
        <section className="space-y-4 rounded-2xl border border-stone-200 p-4 dark:border-[#334155]">
          <h3 className="font-semibold text-ink">2. Till</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="target-department" className="text-sm font-medium text-ink">
                Avdelning
              </label>
              <select
                id="target-department"
                value={targetDepartmentId}
                onChange={(event) => selectTargetDepartment(event.target.value)}
              >
                <option value="">Välj avdelning</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="target-group" className="text-sm font-medium text-ink">
                Skift
              </label>
              <select
                id="target-group"
                value={targetGroupId}
                onChange={(event) => setTargetGroupId(event.target.value)}
                disabled={!targetDepartment || targetDepartment.groups.length === 0}
              >
                {!targetDepartment ? <option value="">Välj avdelning först</option> : null}
                {targetDepartment && targetDepartment.groups.length === 0 ? <option value="">Inga skift</option> : null}
                {targetDepartment?.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.people.length})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {targetDepartment && targetDepartment.groups.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {targetDepartment.name} har inga skift. Skapa ett skift på avdelningen först.
            </p>
          ) : null}
          {sameGroup ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">Välj ett annat skift än det du hämtar från.</p>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">3. Ska personerna finnas kvar i det gamla skiftet?</legend>
            {(
              [
                { value: "copy", title: "Kopiera", text: "Personerna finns kvar i båda skiften." },
                {
                  value: "move",
                  title: "Flytta",
                  text: "Personerna tas bort från det gamla skiftet. Finns de i den gamla historiken arkiveras de i stället, så att historiken är kvar."
                }
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm",
                  mode === option.value
                    ? "border-teal/60 bg-teal/5 dark:bg-teal/10"
                    : "border-stone-200 dark:border-[#334155]"
                )}
              >
                <input
                  type="radio"
                  name="mode-choice"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className="mt-0.5 size-4 min-h-0 w-4 p-0"
                />
                <span>
                  <span className="font-semibold text-ink">{option.title}</span>
                  <span className="mt-0.5 block text-stone-500">{option.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="text-xs text-stone-500">
            Historiken följer inte med – personerna börjar om från noll i det nya skiftet.
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-[#334155]">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {selectedPeople.length === 0
            ? "Välj personer att kopiera eller flytta."
            : selectedPeople.length > willTransfer.length
              ? `${selectedPeople.length - willTransfer.length} av de valda finns redan i målskiftet och hoppas över.`
              : `${countLabel} valda.`}
        </p>
        <TransferSubmitButton
          label={willTransfer.length > 0 ? `${verb} ${countLabel}` : verb}
          disabled={!canSubmit}
          confirmMessage={confirmMessage}
        />
      </div>
    </form>
  );
}
