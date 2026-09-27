"use client";

import { useMemo, useRef, useState } from "react";
import { deleteScheduleAction, saveScheduleAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { buildSegments, minuteToTime, previewSchedule, timeToMinute } from "@/lib/live-rotation";
import { cn } from "@/lib/utils";

type BreakRow = { key: string; label: string; start: string; durationMinutes: string };

type ScheduleEditorProps = {
  departmentId: string;
  intervalMin: number;
  minPassMin: number;
  schedule?: {
    id: string;
    name: string;
    startMinute: number;
    endMinute: number;
    breaks: Array<{ id: string; label: string; startMinute: number; durationMinutes: number }>;
  };
};

const MINUTE = 60_000;

// Redigerar ett arbetstidsschema med raster och visar direkt hur passen och
// bytena blir under dagen.
export function ScheduleEditor({ departmentId, intervalMin, minPassMin, schedule }: ScheduleEditorProps) {
  const keyCounter = useRef(0);
  const [name, setName] = useState(schedule?.name ?? "");
  const [start, setStart] = useState(minuteToTime(schedule?.startMinute ?? 6 * 60));
  const [end, setEnd] = useState(minuteToTime(schedule?.endMinute ?? 14 * 60 + 30));
  const [breaks, setBreaks] = useState<BreakRow[]>(
    () =>
      schedule?.breaks
        .slice()
        .sort((a, b) => a.startMinute - b.startMinute)
        .map((item) => ({
          key: item.id,
          label: item.label,
          start: minuteToTime(item.startMinute),
          durationMinutes: String(item.durationMinutes)
        })) ?? []
  );

  function updateBreak(key: string, patch: Partial<BreakRow>) {
    setBreaks((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addBreak() {
    keyCounter.current += 1;
    setBreaks((current) => [
      ...current,
      { key: `new-${keyCounter.current}`, label: current.length === 0 ? "Rast" : "Lunch", start: "", durationMinutes: "30" }
    ]);
  }

  const payload = JSON.stringify({
    name,
    start,
    end,
    breaks: breaks.map(({ label, start: breakStart, durationMinutes }) => ({ label, start: breakStart, durationMinutes }))
  });

  // Förhandsvisning – bara när tiderna går att tolka.
  const preview = useMemo(() => {
    const startMinute = timeToMinute(start);
    const endMinute = timeToMinute(end);
    if (startMinute === null || endMinute === null) return null;

    const validBreaks = breaks.flatMap((row) => {
      const breakStart = timeToMinute(row.start);
      const duration = Number.parseInt(row.durationMinutes, 10);
      return breakStart !== null && duration > 0
        ? [{ label: row.label || "Rast", startMinute: breakStart, durationMinutes: duration }]
        : [];
    });

    return buildSegments(
      previewSchedule({ name, startMinute, endMinute, breaks: validBreaks }, intervalMin, minPassMin)
    );
  }, [name, start, end, breaks, intervalMin, minPassMin]);

  const toTime = (ms: number) => minuteToTime(Math.round(ms / MINUTE));

  return (
    <form action={saveScheduleAction} className="space-y-4">
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="scheduleId" value={schedule?.id ?? ""} />
      <input type="hidden" name="schedule" value={payload} />

      <div className="grid gap-3 sm:grid-cols-[1fr_140px_140px]">
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Namn</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="T.ex. Förmiddag" aria-label="Schemats namn" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Start</label>
          <input type="time" value={start} onChange={(event) => setStart(event.target.value)} aria-label="Starttid" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-stone-500">Slut</label>
          <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} aria-label="Sluttid" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Raster</p>
        {breaks.length === 0 ? (
          <p className="text-sm text-stone-500">Inga raster – rotationen byter hela skiftet.</p>
        ) : (
          breaks.map((row) => (
            <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto] sm:items-center">
              <input
                value={row.label}
                onChange={(event) => updateBreak(row.key, { label: event.target.value })}
                placeholder="Namn, t.ex. Lunch"
                aria-label="Rastens namn"
              />
              <input
                type="time"
                value={row.start}
                onChange={(event) => updateBreak(row.key, { start: event.target.value })}
                aria-label="Rastens starttid"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={row.durationMinutes}
                  onChange={(event) => updateBreak(row.key, { durationMinutes: event.target.value })}
                  aria-label="Rastens längd i minuter"
                />
                <span className="text-sm text-stone-500">min</span>
              </div>
              <button
                type="button"
                onClick={() => setBreaks((current) => current.filter((item) => item.key !== row.key))}
                className="rounded-2xl border border-stone-300 px-3 py-2.5 text-sm font-semibold hover:border-red-400 hover:text-red-600 dark:border-[#475569]"
              >
                Ta bort
              </button>
            </div>
          ))
        )}
        <button type="button" onClick={addBreak} className="text-sm font-medium text-teal hover:underline">
          + Lägg till rast
        </button>
      </div>

      {preview && preview.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Så blir bytena</p>
          <div className="flex flex-wrap gap-1.5">
            {preview.map((segment) => {
              const minutes = Math.round((segment.endAt - segment.startAt) / MINUTE);
              const unusual = segment.kind === "work" && minutes !== intervalMin;
              return (
                <span
                  key={segment.startAt}
                  title={`${toTime(segment.startAt)}–${toTime(segment.endAt)}`}
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs tabular-nums",
                    segment.kind === "break"
                      ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
                      : unusual
                        ? "bg-teal/15 font-semibold text-teal"
                        : "bg-stone-100 text-stone-600 dark:bg-[#0f172a] dark:text-stone-300"
                  )}
                >
                  {toTime(segment.startAt)}
                  {segment.kind === "break" ? ` ${segment.label} ${minutes} min` : unusual ? ` (${minutes} min)` : ""}
                </span>
              );
            })}
            <span className="rounded-lg px-2 py-1 text-xs tabular-nums text-stone-500">{end} slut</span>
          </div>
          <p className="text-xs text-stone-500">
            Varje tid är ett zonbyte. Markerade pass avviker från {intervalMin} minuter, t.ex. efter en rast.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SubmitButton
          label={schedule ? "Spara schema" : "Skapa schema"}
          pendingLabel="Sparar..."
          className="rounded-2xl bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]"
        />
        {schedule ? (
          <button
            type="submit"
            formAction={deleteScheduleAction}
            onClick={(event) => {
              if (!window.confirm(`Ta bort schemat ${schedule.name}?`)) event.preventDefault();
            }}
            className="rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:border-red-400 hover:text-red-600 dark:border-[#475569]"
          >
            Ta bort schema
          </button>
        ) : null}
      </div>
    </form>
  );
}
