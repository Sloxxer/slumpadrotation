"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RotationResultModalProps = {
  closeHref: string;
  createdAtLabel: string;
  departmentName: string;
  groupName: string;
  score: number;
  animate?: boolean;
  assignments: Array<{
    id?: string;
    zoneIndex: number;
    zone: {
      name: string;
    };
    person: {
      name: string;
    };
  }>;
  unassignedPeople?: Array<{ id: string; name: string }>;
};

const ROW_HEIGHT = 48;
const FILLER_COUNT = 24;
const ROLL_DURATION_MS = 1400;
const COLUMN_STAGGER_MS = 150;

function NameReel({
  finalName,
  pool,
  animate,
  delayMs
}: {
  finalName: string;
  pool: string[];
  animate: boolean;
  delayMs: number;
}) {
  // Bygg en "rulle" av slumpade namn som avslutas med rätt namn längst ned.
  const reel = useMemo(() => {
    if (!animate || pool.length === 0) {
      return [finalName];
    }
    const fillers = Array.from(
      { length: FILLER_COUNT },
      () => pool[Math.floor(Math.random() * pool.length)] ?? finalName
    );
    return [...fillers, finalName];
  }, [finalName, pool, animate]);

  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!animate) return;
    // Liten fördröjning så att utgångsläget (translateY 0) hinner målas innan
    // transitionen startar – annars hoppar rullen direkt till slutet.
    const id = window.setTimeout(() => setRolling(true), 40);
    return () => window.clearTimeout(id);
  }, [animate]);

  const landed = !animate || rolling;
  const translateY = landed ? -(reel.length - 1) * ROW_HEIGHT : 0;

  return (
    <div className="mt-4 overflow-hidden" style={{ height: ROW_HEIGHT }}>
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          transition:
            animate && rolling
              ? `transform ${ROLL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms`
              : "none"
        }}
      >
        {reel.map((name, index) => (
          <div
            key={`${index}-${name}`}
            className="flex items-center justify-center px-1"
            style={{ height: ROW_HEIGHT }}
          >
            <span className="truncate text-2xl font-medium leading-tight text-ink">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RotationResultModal({
  closeHref,
  createdAtLabel,
  departmentName,
  groupName,
  score,
  animate = true,
  assignments,
  unassignedPeople = []
}: RotationResultModalProps) {
  const orderedAssignments = useMemo(
    () => [...assignments].sort((left, right) => left.zoneIndex - right.zoneIndex),
    [assignments]
  );
  const pool = useMemo(
    () => orderedAssignments.map((assignment) => assignment.person.name),
    [orderedAssignments]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-sm dark:bg-black/60">
      <div className="relative max-h-[90vh] w-full max-w-[92vw] overflow-y-auto rounded-[2rem] bg-white p-6 shadow-[0_32px_120px_rgba(16,24,32,0.28)] dark:bg-[#1e293b] dark:shadow-[0_32px_120px_rgba(0,0,0,0.6)] md:p-8">
        <Link
          href={closeHref}
          className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-xl font-semibold text-stone-500 transition hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-400"
          aria-label="Stäng rotation"
        >
          ×
        </Link>

        <div className="space-y-6">
          <div className="space-y-3 pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">Ny rotation</p>
            <h2 className="text-3xl font-semibold text-ink md:text-4xl">{departmentName}</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-[150px] rounded-2xl bg-sand px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Skift</p>
              <p className="mt-1 text-base font-semibold text-ink">{groupName}</p>
            </div>
            <div className="min-w-[220px] rounded-2xl bg-sand px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Skapad</p>
              <p className="mt-1 text-base font-semibold text-ink">{createdAtLabel}</p>
            </div>
            <div className="min-w-[120px] rounded-2xl bg-sand px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Poäng</p>
              <p className="mt-1 text-base font-semibold text-ink">{score}</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5 dark:border-[#334155] dark:bg-[#0f172a] md:p-6">
            <div className="w-full">
              <div
                className="grid w-full gap-4 md:gap-5"
                style={{
                  gridTemplateColumns: `repeat(${orderedAssignments.length}, minmax(0, 1fr))`
                }}
              >
                {orderedAssignments.map((assignment, index) => (
                  <div
                    key={assignment.id ?? `${assignment.zoneIndex}-${assignment.zone.name}-${assignment.person.name}`}
                    className="flex min-w-0 flex-col items-center justify-center rounded-[1.75rem] border border-stone-200 bg-white px-5 py-8 text-center dark:border-[#334155] dark:bg-[#1e293b]"
                    style={{ minHeight: 180 }}
                  >
                    <p className="text-xl font-semibold leading-tight text-ink">{assignment.zone.name}</p>
                    <NameReel
                      finalName={assignment.person.name}
                      pool={pool}
                      animate={animate}
                      delayMs={index * COLUMN_STAGGER_MS}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {unassignedPeople.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                Utanför rotation
              </p>
              <div className="flex flex-wrap gap-2">
                {unassignedPeople.map((person) => (
                  <span
                    key={person.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-600 dark:border-[#334155] dark:bg-[#0f172a] dark:text-stone-400"
                  >
                    {person.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
