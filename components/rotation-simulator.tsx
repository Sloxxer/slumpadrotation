"use client";

import { useState } from "react";
import { generateRotation, type GeneratedRotation } from "@/lib/rotation";
import { Panel } from "@/components/cards";

type SimPerson = { id: string; name: string };
type SimZone = { id: string; name: string; orderIndex: number };
type SimGroup = { id: string; name: string; people: SimPerson[] };
type SimDepartment = {
  id: string;
  name: string;
  zones: SimZone[];
  groups: SimGroup[];
};

type PersonStat = {
  name: string;
  assigned: number;
  zoneRepetitions: number;
  neighborRepetitions: number;
  zoneDistribution: Record<string, number>;
};

type SimulationResult = {
  iterations: number;
  personStats: Record<string, PersonStat>;
  zones: SimZone[];
  scoreStats: { min: number; max: number; avg: number; zeroCount: number };
};

function toHistoricalAssignments(result: GeneratedRotation) {
  return result.assignments.map((a) => ({
    zoneId: a.zoneId,
    personId: a.personId,
    zoneIndex: a.zoneIndex,
    zone: { id: a.zoneId, name: a.zoneName, orderIndex: a.zoneIndex },
    person: { id: a.personId, name: a.personName }
  }));
}

function runSimulation(
  group: SimGroup,
  zones: SimZone[],
  iterations: number
): SimulationResult {
  const personStats: Record<string, PersonStat> = {};
  for (const person of group.people) {
    personStats[person.id] = {
      name: person.name,
      assigned: 0,
      zoneRepetitions: 0,
      neighborRepetitions: 0,
      zoneDistribution: Object.fromEntries(zones.map((z) => [z.id, 0]))
    };
  }

  const scores = { min: Infinity, max: 0, total: 0, zeroCount: 0 };
  let history: ReturnType<typeof toHistoricalAssignments>[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = generateRotation({
      group,
      zones,
      people: group.people,
      previousRotations: history.map((assignments) => ({ assignments })),
      iterations: 200
    });

    scores.min = Math.min(scores.min, result.score);
    scores.max = Math.max(scores.max, result.score);
    scores.total += result.score;
    if (result.score === 0) scores.zeroCount++;

    for (const a of result.assignments) {
      const stat = personStats[a.personId];
      if (!stat) continue;
      stat.assigned++;
      stat.zoneDistribution[a.zoneId] = (stat.zoneDistribution[a.zoneId] ?? 0) + 1;
      if (a.repeatedZone) stat.zoneRepetitions++;
      if (a.repeatedFrontNeighbor) stat.neighborRepetitions++;
    }

    history = [toHistoricalAssignments(result), ...history].slice(0, 3);
  }

  return {
    iterations,
    personStats,
    zones,
    scoreStats: {
      min: scores.min === Infinity ? 0 : scores.min,
      max: scores.max,
      avg: Math.round((scores.total / iterations) * 10) / 10,
      zeroCount: scores.zeroCount
    }
  };
}

function pct(value: number, total: number) {
  if (total === 0) return "–";
  return `${Math.round((value / total) * 100)}%`;
}

function ScoreCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-sand p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{sub}</p>}
    </div>
  );
}

function ResultsPanel({ result }: { result: SimulationResult }) {
  const people = Object.entries(result.personStats).sort((a, b) =>
    a[1].name.localeCompare(b[1].name, "sv-SE")
  );
  const { zones, scoreStats, iterations } = result;

  // compute max zone count for heatmap intensity
  const allCounts = people.flatMap(([, stat]) => Object.values(stat.zoneDistribution));
  const maxCount = Math.max(...allCounts, 1);

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <Panel>
        <h2 className="mb-4 text-base font-semibold text-ink">Poängstatistik</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ScoreCard
            label="Snittpoäng"
            value={String(scoreStats.avg)}
            sub="lägre = bättre"
          />
          <ScoreCard
            label="Bästa rotation"
            value={String(scoreStats.min)}
            sub="lägsta poäng"
          />
          <ScoreCard
            label="Sämsta rotation"
            value={String(scoreStats.max)}
            sub="högsta poäng"
          />
          <ScoreCard
            label="Perfekta (0p)"
            value={pct(scoreStats.zeroCount, iterations)}
            sub={`${scoreStats.zeroCount} av ${iterations}`}
          />
        </div>
      </Panel>

      {/* Per-person repetition stats */}
      <Panel>
        <h2 className="mb-1 text-base font-semibold text-ink">Upprepningar per person</h2>
        <p className="mb-4 text-xs text-stone-500 dark:text-stone-400">
          Procentandel av rotationerna där personen hamnade i samma zon eller bakom samma granne som föregående rotation.
          {people.some(([, s]) => s.assigned < iterations) && (
            <> Kolumnen "Tilldelad" visar hur ofta personen ingick i rotationen.</>
          )}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:border-[#334155] dark:text-stone-400">
                <th className="pb-2 pr-4">Person</th>
                <th className="pb-2 pr-4 text-right">Upprepad zon</th>
                <th className="pb-2 pr-4 text-right">Samma granne</th>
                {people.some(([, s]) => s.assigned < iterations) && (
                  <th className="pb-2 text-right">Tilldelad</th>
                )}
              </tr>
            </thead>
            <tbody>
              {people.map(([id, stat]) => (
                <tr
                  key={id}
                  className="border-b border-stone-100 last:border-0 dark:border-[#334155]/50"
                >
                  <td className="py-2 pr-4 font-medium text-ink">{stat.name}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-stone-600 dark:text-stone-300">
                    {pct(stat.zoneRepetitions, stat.assigned)}
                    <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">
                      ({stat.zoneRepetitions})
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-stone-600 dark:text-stone-300">
                    {pct(stat.neighborRepetitions, stat.assigned)}
                    <span className="ml-1 text-xs text-stone-400 dark:text-stone-500">
                      ({stat.neighborRepetitions})
                    </span>
                  </td>
                  {people.some(([, s]) => s.assigned < iterations) && (
                    <td className="py-2 text-right tabular-nums text-stone-600 dark:text-stone-300">
                      {pct(stat.assigned, iterations)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Zone distribution heatmap */}
      <Panel>
        <h2 className="mb-1 text-base font-semibold text-ink">Zonfördelning</h2>
        <p className="mb-4 text-xs text-stone-500 dark:text-stone-400">
          Antal gånger varje person tilldelades respektive zon under simuleringen. Mörkare färg = fler tilldelningar.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:border-[#334155] dark:text-stone-400">
                <th className="pb-2 pr-3 font-semibold">Person</th>
                {zones.map((zone) => (
                  <th key={zone.id} className="pb-2 pr-2 text-center font-semibold">
                    {zone.orderIndex}. {zone.name}
                  </th>
                ))}
                <th className="pb-2 pl-2 text-right font-semibold">Totalt</th>
              </tr>
            </thead>
            <tbody>
              {people.map(([id, stat]) => {
                const ideal = stat.assigned / zones.length;
                return (
                  <tr
                    key={id}
                    className="border-b border-stone-100 last:border-0 dark:border-[#334155]/50"
                  >
                    <td className="py-1.5 pr-3 font-medium text-ink">{stat.name}</td>
                    {zones.map((zone) => {
                      const count = stat.zoneDistribution[zone.id] ?? 0;
                      const intensity = maxCount > 0 ? count / maxCount : 0;
                      const deviation = ideal > 0 ? (count - ideal) / ideal : 0;
                      return (
                        <td
                          key={zone.id}
                          className="py-1.5 pr-2 text-center tabular-nums"
                          style={{
                            backgroundColor: `rgb(var(--color-teal) / ${intensity * 0.35})`,
                            color: deviation < -0.4 ? "rgb(var(--color-accent))" : "inherit"
                          }}
                          title={`${stat.name} i ${zone.name}: ${count} ggr (idealt ${Math.round(ideal)})`}
                        >
                          {count}
                        </td>
                      );
                    })}
                    <td className="py-1.5 pl-2 text-right tabular-nums text-stone-500 dark:text-stone-400">
                      {stat.assigned}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          Tal markerade i orange avviker mer än 40% under det förväntade snittet.
        </p>
      </Panel>
    </div>
  );
}

export function RotationSimulator({ departments }: { departments: SimDepartment[] }) {
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [groupId, setGroupId] = useState<string>("");
  const [iterations, setIterations] = useState(100);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dept = departments.find((d) => d.id === deptId) ?? departments[0];
  const group = dept?.groups.find((g) => g.id === groupId) ?? dept?.groups[0] ?? null;

  function handleDeptChange(newDeptId: string) {
    setDeptId(newDeptId);
    setGroupId("");
    setResult(null);
    setError(null);
  }

  function handleRun() {
    if (!dept || !group) return;
    if (dept.zones.length === 0) {
      setError("Avdelningen har inga aktiva zoner.");
      return;
    }
    if (group.people.length < dept.zones.length) {
      setError(
        `${group.name} har ${group.people.length} aktiva personer men det behövs minst ${dept.zones.length} för att fylla zonerna.`
      );
      return;
    }
    setError(null);
    setRunning(true);
    setResult(null);

    // defer to let the UI update before blocking
    setTimeout(() => {
      try {
        const res = runSimulation(group, dept.zones, iterations);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Simuleringen misslyckades.");
      } finally {
        setRunning(false);
      }
    }, 30);
  }

  const activeGroup = group ?? null;
  const canRun =
    !!dept &&
    !!activeGroup &&
    dept.zones.length > 0 &&
    activeGroup.people.length >= dept.zones.length;

  return (
    <div className="space-y-5">
      {/* Config */}
      <Panel className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-ink">Inställningar</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Välj avdelning, skift och antal simuleringar. Simuleringen kör rotationsalgoritmen upprepat i sekvens, precis som det sker i verkligheten.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Avdelning</label>
            <select
              value={deptId}
              onChange={(e) => handleDeptChange(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Skift</label>
            <select
              value={groupId || activeGroup?.id || ""}
              onChange={(e) => { setGroupId(e.target.value); setResult(null); }}
            >
              {dept?.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.people.length} personer)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">Antal simuleringar</label>
            <select
              value={iterations}
              onChange={(e) => { setIterations(Number(e.target.value)); setResult(null); }}
            >
              {[50, 100, 250, 500, 1000].map((n) => (
                <option key={n} value={n}>{n} rotationer</option>
              ))}
            </select>
          </div>
        </div>

        {dept && activeGroup && (
          <div className="flex flex-wrap gap-3 rounded-2xl bg-sand px-4 py-3 text-sm text-stone-600 dark:text-stone-300">
            <span>{dept.zones.length} aktiva zoner</span>
            <span>·</span>
            <span>{activeGroup.people.length} aktiva personer</span>
            {activeGroup.people.length > dept.zones.length && (
              <>
                <span>·</span>
                <span>{activeGroup.people.length - dept.zones.length} person(er) utanför per rotation</span>
              </>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={handleRun}
          disabled={!canRun || running}
          className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal dark:hover:bg-[#3d9298]"
        >
          {running ? `Simulerar ${iterations} rotationer…` : "Kör simulering"}
        </button>
      </Panel>

      {result && <ResultsPanel result={result} />}
    </div>
  );
}
