"use client";

import { useEffect, useState } from "react";
import { generateRotationAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type RotationGroupFormProps = {
  departmentId: string;
  groups: Array<{
    id: string;
    name: string;
    people: Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
    _count: {
      people: number;
    };
  }>;
  zones: Array<{
    id: string;
    name: string;
    orderIndex: number;
  }>;
  initialGroupId?: string;
  compact?: boolean;
};

export function RotationGroupForm({
  departmentId,
  groups,
  zones,
  initialGroupId,
  compact = false
}: RotationGroupFormProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId ?? groups[0]?.id ?? "");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const [activePersonIds, setActivePersonIds] = useState<string[]>(
    selectedGroup?.people.filter((person) => person.active).map((person) => person.id) ?? []
  );
  const [activeZoneIds, setActiveZoneIds] = useState<string[]>(zones.map((zone) => zone.id));

  useEffect(() => {
    setActivePersonIds(selectedGroup?.people.filter((person) => person.active).map((person) => person.id) ?? []);
  }, [selectedGroupId, selectedGroup]);

  useEffect(() => {
    setActiveZoneIds(zones.map((zone) => zone.id));
  }, [zones]);

  function togglePerson(personId: string, checked: boolean) {
    setActivePersonIds((current) => {
      if (checked) {
        return current.includes(personId) ? current : [...current, personId];
      }

      return current.filter((id) => id !== personId);
    });
  }

  function toggleZone(zoneId: string, checked: boolean) {
    setActiveZoneIds((current) => {
      if (checked) {
        return current.includes(zoneId) ? current : [...current, zoneId];
      }

      return current.filter((id) => id !== zoneId);
    });
  }

  return (
    <form action={generateRotationAction} className="space-y-6">
      <input type="hidden" name="departmentId" value={departmentId} />
      <input
        type="hidden"
        name="returnPath"
        value={`/rotation/${departmentId}?groupId=${selectedGroupId}`}
      />

      {!compact ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Zoner i rotationen</p>
              <p className="mt-1 text-xs text-stone-500">
                {activeZoneIds.length} aktiva zoner, {activeZoneIds.length} personer behövs
              </p>
            </div>
            <p className="text-xs text-stone-500">Alla zoner är valda från start. Avmarkera tillfälligt vid behov.</p>
          </div>

          {zones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
              Det finns inga zoner att välja för den här avdelningen ännu.
            </div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-2">
                {zones.map((zone) => (
                  <label
                    key={zone.id}
                    className="flex h-[84px] w-[110px] shrink-0 flex-col items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 px-2 py-2 text-center text-sm text-ink dark:border-[#334155] dark:bg-[#0f172a]"
                  >
                    <input
                      type="checkbox"
                      name="activeZoneIds"
                      value={zone.id}
                      checked={activeZoneIds.includes(zone.id)}
                      onChange={(event) => toggleZone(zone.id, event.target.checked)}
                      className="mb-2 size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                    />
                    <span className="line-clamp-2 text-xs font-medium leading-tight">
                      {zone.orderIndex}. {zone.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {selectedGroup && !compact ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Personer i {selectedGroup.name}</p>
              <p className="mt-1 text-xs text-stone-500">
                {activePersonIds.length} aktiva av {selectedGroup.people.length} personer
              </p>
            </div>
            <p className="text-xs text-stone-500">
              Markerade personer sätts som aktiva för detta skift när rotationen skapas.
            </p>
          </div>
          {selectedGroup.people.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
              Det finns inga personer kopplade till det här skiftet ännu.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {selectedGroup.people.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-ink dark:border-[#334155] dark:bg-[#0f172a]"
                >
                  <input
                    type="checkbox"
                    name="activePersonIds"
                    value={person.id}
                    checked={activePersonIds.includes(person.id)}
                    onChange={(event) => togglePerson(person.id, event.target.checked)}
                    className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
                  />
                  <span className="truncate">{person.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div
        className={
          compact
            ? "grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-end"
            : "grid gap-4 border-t border-stone-200 pt-2 dark:border-[#334155] md:grid-cols-[minmax(0,1fr)_220px] md:items-end"
        }
      >
        <div className="space-y-2">
          <label htmlFor="groupId" className="text-sm font-medium text-ink">
            Skift
          </label>
          <select
            id="groupId"
            name="groupId"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.people.length} personer)
              </option>
            ))}
          </select>
        </div>

        <SubmitButton
          label="Skapa rotation"
          pendingLabel="Skapar rotation..."
          className="w-full rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]"
        />
      </div>
    </form>
  );
}
