"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateRotationAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

type ZoneInput = {
  id: string;
  name: string;
  orderIndex: number;
};

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
  zones: ZoneInput[];
  initialGroupId?: string;
  compact?: boolean;
};

type OrderItem =
  | { kind: "existing"; id: string; name: string; orderIndex: number }
  | { kind: "temp"; id: string; name: string };

function buildInitialOrder(zones: ZoneInput[]): OrderItem[] {
  return [...zones]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((zone) => ({ kind: "existing", id: zone.id, name: zone.name, orderIndex: zone.orderIndex }));
}

// Tillfälliga zonändringar (tredjeman-zoner, omordning, avmarkeringar) sparas i en
// modulvariabel så att de överlever själva rotationsskapandet (en klient-navigering
// tillbaka till samma sida). Variabeln nollställs automatiskt vid en riktig
// sidladdning – och vi nollställer den explicit när man byter skift.
let cachedZoneOrder: { groupId: string; order: OrderItem[] } | null = null;

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
  const [order, setOrder] = useState<OrderItem[]>(() =>
    cachedZoneOrder && cachedZoneOrder.groupId === selectedGroupId
      ? cachedZoneOrder.order
      : buildInitialOrder(zones)
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const tempCounter = useRef(0);
  const previousGroupRef = useRef(selectedGroupId);

  useEffect(() => {
    setActivePersonIds(selectedGroup?.people.filter((person) => person.active).map((person) => person.id) ?? []);
  }, [selectedGroupId, selectedGroup]);

  // Spegla aktuell zonordning till modulvariabeln så den finns kvar vid nästa
  // rendering/navigering (men inte över en sidladdning).
  useEffect(() => {
    cachedZoneOrder = { groupId: selectedGroupId, order };
  }, [selectedGroupId, order]);

  // Vid byte av skift: återgå till avdelningens standardzoner.
  useEffect(() => {
    if (previousGroupRef.current !== selectedGroupId) {
      previousGroupRef.current = selectedGroupId;
      setOrder(buildInitialOrder(zones));
    }
  }, [selectedGroupId, zones]);

  const sortedZones = useMemo(() => [...zones].sort((a, b) => a.orderIndex - b.orderIndex), [zones]);
  const includedExistingIds = useMemo(
    () => new Set(order.filter((item) => item.kind === "existing").map((item) => item.id)),
    [order]
  );
  const excludedZones = sortedZones.filter((zone) => !includedExistingIds.has(zone.id));

  const zoneCount = order.length;
  const enoughPeople = activePersonIds.length >= zoneCount;
  const canSubmit = zoneCount > 0 && enoughPeople && Boolean(selectedGroupId);

  const rotationZonesValue = useMemo(
    () =>
      JSON.stringify(
        order.map((item) =>
          item.kind === "existing"
            ? { type: "existing", id: item.id }
            : { type: "temp", name: item.name }
        )
      ),
    [order]
  );

  function togglePerson(personId: string, checked: boolean) {
    setActivePersonIds((current) => {
      if (checked) {
        return current.includes(personId) ? current : [...current, personId];
      }
      return current.filter((id) => id !== personId);
    });
  }

  function includeZone(zone: ZoneInput) {
    setOrder((current) => {
      if (current.some((item) => item.kind === "existing" && item.id === zone.id)) {
        return current;
      }
      // Återinför den befintliga zonen på sin kanoniska plats relativt övriga
      // befintliga zoner. Tillfälliga zoner behåller sina platser.
      const next = [...current];
      let insertAt = next.length;
      for (let i = 0; i < next.length; i += 1) {
        const item = next[i];
        if (item.kind === "existing" && item.orderIndex > zone.orderIndex) {
          insertAt = i;
          break;
        }
      }
      next.splice(insertAt, 0, {
        kind: "existing",
        id: zone.id,
        name: zone.name,
        orderIndex: zone.orderIndex
      });
      return next;
    });
  }

  function excludeZone(zoneId: string) {
    setOrder((current) => current.filter((item) => !(item.kind === "existing" && item.id === zoneId)));
  }

  function addTempZone() {
    tempCounter.current += 1;
    setOrder((current) => [
      ...current,
      { kind: "temp", id: `temp-${tempCounter.current}-${Date.now()}`, name: "Tredjeman" }
    ]);
  }

  function removeTempZone(id: string) {
    setOrder((current) => current.filter((item) => !(item.kind === "temp" && item.id === id)));
  }

  // Flyttar en tillfällig zon ett steg i sekvensen. Befintliga zoner behåller
  // alltid sin inbördes ordning eftersom bara tillfälliga zoner kan flyttas.
  function moveTemp(id: string, direction: -1 | 1) {
    setOrder((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1 || current[index].kind !== "temp") return current;
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function dropTempAt(targetIndex: number) {
    if (!dragId) return;
    setOrder((current) => {
      const from = current.findIndex((item) => item.id === dragId);
      if (from === -1 || current[from].kind !== "temp") return current;
      const item = current[from];
      const next = [...current];
      next.splice(from, 1);
      const insertAt = from < targetIndex ? targetIndex - 1 : targetIndex;
      next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, item);
      return next;
    });
    setDragId(null);
  }

  return (
    <form action={generateRotationAction} className="space-y-6">
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="rotationZones" value={rotationZonesValue} />
      <input
        type="hidden"
        name="returnPath"
        value={`/rotation/${departmentId}?groupId=${selectedGroupId}`}
      />

      {!compact ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Zoner i rotationen</p>
              <p className="mt-1 text-xs text-stone-500">
                {zoneCount} zoner i ordning, {zoneCount} personer behövs
              </p>
            </div>
            <p className="text-xs text-stone-500">
              Dra i tredjeman-zonerna (eller använd pilarna) för att placera dem i cirkeln.
            </p>
          </div>

          {zoneCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600 dark:border-[#334155] dark:bg-[#0f172a]">
              Inga zoner valda. Markera minst en zon nedan eller lägg till en tredjeman-zon.
            </div>
          ) : (
            <div className="flex flex-wrap items-stretch gap-1.5">
              {order.map((item, index) => {
                const isTemp = item.kind === "temp";
                return (
                  <div
                    key={item.id}
                    draggable={isTemp}
                    onDragStart={() => isTemp && setDragId(item.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(event) => {
                      if (dragId) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!dragId) return;
                      event.preventDefault();
                      dropTempAt(index);
                    }}
                    className={`relative flex w-[84px] flex-col rounded-xl border px-1.5 py-1.5 text-center ${
                      isTemp
                        ? "cursor-grab border-accent/60 bg-accent/10 text-ink dark:border-accent/50 dark:bg-accent/15"
                        : "border-stone-200 bg-stone-50 text-ink dark:border-[#334155] dark:bg-[#0f172a]"
                    } ${dragId === item.id ? "opacity-50" : ""}`}
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                      Plats {index + 1}
                    </span>
                    <span className="mt-1 line-clamp-2 flex-1 text-[11px] font-medium leading-tight">
                      {item.name}
                    </span>

                    {isTemp ? (
                      <div className="mt-1.5 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveTemp(item.id, -1)}
                          disabled={index === 0}
                          aria-label="Flytta zonen tidigare"
                          className="flex h-5 w-5 items-center justify-center rounded border border-stone-300 text-[10px] text-stone-600 disabled:opacity-30 dark:border-[#475569] dark:text-stone-300"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTemp(item.id, 1)}
                          disabled={index === order.length - 1}
                          aria-label="Flytta zonen senare"
                          className="flex h-5 w-5 items-center justify-center rounded border border-stone-300 text-[10px] text-stone-600 disabled:opacity-30 dark:border-[#475569] dark:text-stone-300"
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTempZone(item.id)}
                          aria-label="Ta bort tredjeman-zon"
                          className="flex h-5 w-5 items-center justify-center rounded border border-stone-300 text-[11px] text-red-600 hover:border-red-400 dark:border-[#475569]"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => excludeZone(item.id)}
                        aria-label={`Ta bort ${item.name} ur rotationen`}
                        className="mt-1 text-[9px] font-medium text-stone-400 hover:text-red-600"
                      >
                        Ta bort
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={addTempZone}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            <span className="text-base leading-none">+</span> Lägg till tredjeman-zon
          </button>

          {excludedZones.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500">Avmarkerade zoner:</span>
              {excludedZones.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => includeZone(zone)}
                  className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-300"
                >
                  + {zone.orderIndex}. {zone.name}
                </button>
              ))}
            </div>
          ) : null}
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

      {!compact && zoneCount > 0 && !enoughPeople ? (
        <p className="text-xs font-medium text-red-600">
          Du behöver markera minst {zoneCount} personer för att fylla alla zoner ({activePersonIds.length} valda).
        </p>
      ) : null}

      {!compact ? (
        <label className="flex w-fit items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          <input
            type="checkbox"
            name="skipAnimation"
            className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
          />
          Skapa utan animation
        </label>
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
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal dark:hover:bg-[#3d9298]"
        />
      </div>
    </form>
  );
}
