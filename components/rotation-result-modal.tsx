"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSegments,
  formatClock,
  getLiveState,
  personIndexAt,
  type LiveSchedule,
  type LiveState
} from "@/lib/live-rotation";
import { cn } from "@/lib/utils";

type RotationResultModalProps = {
  closeHref: string;
  createdAtLabel: string;
  departmentName: string;
  groupName: string;
  score: number;
  animate?: boolean;
  liveSchedule?: LiveSchedule | null;
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

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(hours > 0 ? 2 : 1, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

// Klockan i webbläsaren, uppdaterad varje sekund. null tills sidan är monterad
// så att server- och klientrendering blir lika.
function useNow(enabled: boolean) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  return now;
}

function LiveStatus({ state, now, schedule }: { state: LiveState; now: number; schedule: LiveSchedule }) {
  const nextBreak = schedule.breaks.find((item) => item.startAt > now);

  let headline: string;
  let detail: string | null = null;
  let countdownTo: number | null = null;

  if (state.phase === "before") {
    headline = `Rotationen startar kl ${formatClock(state.next.startAt)}`;
    countdownTo = state.next.startAt;
  } else if (state.phase === "break") {
    headline = `${state.segment.label} till kl ${formatClock(state.segment.endAt)}`;
    detail = "Zonerna nedan gäller efter rasten.";
    countdownTo = state.segment.endAt;
  } else if (state.phase === "work") {
    countdownTo = state.segment.endAt;
    if (!state.next) {
      headline = `Skiftet slutar kl ${formatClock(state.segment.endAt)}`;
    } else if (state.next.kind === "break") {
      headline = `${state.next.label} kl ${formatClock(state.next.startAt)}`;
    } else {
      headline = `Nästa byte kl ${formatClock(state.next.startAt)}`;
    }
  } else {
    headline = "Skiftet är slut";
  }

  const scheduleLabel =
    schedule.mode === "schedule"
      ? `${schedule.scheduleName} ${formatClock(schedule.startAt)}–${formatClock(schedule.endAt)}`
      : `Byte var ${schedule.intervalMin}:e minut${schedule.fallback ? " (inget schema passade tiden)" : ""}`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] px-5 py-4",
        state.phase === "break"
          ? "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200"
          : "bg-teal/10 text-ink dark:bg-teal/20"
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
          Live • {scheduleLabel}
        </p>
        <p className="mt-1 text-2xl font-semibold md:text-3xl">{headline}</p>
        {detail ? <p className="mt-1 text-sm opacity-80">{detail}</p> : null}
        {state.phase !== "break" && state.phase !== "ended" && nextBreak && state.next?.kind !== "break" ? (
          <p className="mt-1 text-sm opacity-70">
            Nästa rast: {nextBreak.label} kl {formatClock(nextBreak.startAt)}
          </p>
        ) : null}
      </div>
      {countdownTo !== null ? (
        <p className="text-4xl font-semibold tabular-nums md:text-5xl" aria-label="Tid kvar">
          {formatCountdown(countdownTo - now)}
        </p>
      ) : null}
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
  liveSchedule = null,
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

  // ---------- Live ----------
  const segments = useMemo(() => (liveSchedule ? buildSegments(liveSchedule) : []), [liveSchedule]);
  const now = useNow(Boolean(liveSchedule));
  const liveState = liveSchedule && now !== null ? getLiveState(liveSchedule, segments, now) : null;
  const step = liveState?.step ?? 0;
  const zoneCount = orderedAssignments.length;
  const showNext = liveState?.phase === "work" && liveState.next !== null;

  // Första visningen använder den vanliga animationen; vid varje byte rullar
  // namnen igen så att det syns att alla flyttat.
  const firstStep = useRef<number | null>(null);
  if (liveState && firstStep.current === null) firstStep.current = step;
  const rolledSinceOpen = firstStep.current !== null && step !== firstStep.current;

  // ---------- Helskärm och skärmlås ----------
  const panelRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", onChange);
    setWakeLockSupported("wakeLock" in navigator);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void panelRef.current?.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    if (!keepAwake) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        if (!cancelled) setKeepAwake(false);
      }
    };
    // Skärmlåset släpps när fliken döljs – begär det igen när den syns.
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [keepAwake]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-sm dark:bg-black/60">
      <div
        ref={panelRef}
        className={cn(
          "relative w-full overflow-y-auto bg-white p-6 shadow-[0_32px_120px_rgba(16,24,32,0.28)] dark:bg-[#1e293b] dark:shadow-[0_32px_120px_rgba(0,0,0,0.6)] md:p-8",
          fullscreen ? "h-full max-h-none max-w-none rounded-none" : "max-h-[90vh] max-w-[92vw] rounded-[2rem]"
        )}
      >
        <div className="absolute right-5 top-5 flex gap-2">
          {liveSchedule ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-11 items-center justify-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-500 transition hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-400"
            >
              {fullscreen ? "Avsluta helskärm" : "Helskärm"}
            </button>
          ) : null}
          {!fullscreen ? (
            <Link
              href={closeHref}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 text-xl font-semibold text-stone-500 transition hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-400"
              aria-label="Stäng rotation"
            >
              ×
            </Link>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className={cn("space-y-3", liveSchedule ? "pr-40" : "pr-12")}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
              {liveSchedule ? "Live-rotation" : "Ny rotation"}
            </p>
            <h2 className="text-3xl font-semibold text-ink md:text-4xl">{departmentName}</h2>
          </div>

          {!fullscreen ? (
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
          ) : null}

          {liveSchedule && liveState && now !== null ? (
            <LiveStatus state={liveState} now={now} schedule={liveSchedule} />
          ) : null}

          <div className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5 dark:border-[#334155] dark:bg-[#0f172a] md:p-6">
            <div className="w-full">
              <div
                className="grid w-full gap-4 md:gap-5"
                style={{
                  gridTemplateColumns: `repeat(${orderedAssignments.length}, minmax(0, 1fr))`
                }}
              >
                {orderedAssignments.map((assignment, index) => {
                  const current = orderedAssignments[personIndexAt(index, step, zoneCount)];
                  const next = orderedAssignments[personIndexAt(index, step + 1, zoneCount)];

                  return (
                    <div
                      key={assignment.id ?? `${assignment.zoneIndex}-${assignment.zone.name}`}
                      className={cn(
                        "flex min-w-0 flex-col items-center justify-center rounded-[1.75rem] border border-stone-200 bg-white px-5 py-8 text-center dark:border-[#334155] dark:bg-[#1e293b]",
                        liveState?.phase === "break" && "opacity-70"
                      )}
                      style={{ minHeight: 180 }}
                    >
                      <p className="text-xl font-semibold leading-tight text-ink">{assignment.zone.name}</p>
                      <NameReel
                        key={`${index}-${step}`}
                        finalName={current.person.name}
                        pool={pool}
                        animate={rolledSinceOpen || animate}
                        delayMs={index * COLUMN_STAGGER_MS}
                      />
                      {showNext && zoneCount > 1 ? (
                        <p className="mt-2 truncate text-sm text-stone-500">Nästa: {next.person.name}</p>
                      ) : null}
                    </div>
                  );
                })}
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

          {liveSchedule && wakeLockSupported ? (
            <label className="flex w-fit items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
              <input
                type="checkbox"
                checked={keepAwake}
                onChange={(event) => setKeepAwake(event.target.checked)}
                className="size-4 min-h-0 w-4 rounded border-stone-300 p-0"
              />
              Håll skärmen tänd
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}
