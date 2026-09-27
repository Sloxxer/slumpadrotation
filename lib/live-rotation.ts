// Live-rotation: räknar ut när zonbytena sker under ett skift, med raster.
// Ren logik utan beroenden så att den kan användas både på servern (när
// rotationen skapas) och i webbläsaren (live-vyn räknar själv från klockan).

export const APP_TIME_ZONE = "Europe/Stockholm";

// Hur långt före ett schemas start en rotation räknas till det schemat.
export const SCHEDULE_LEAD_MINUTES = 60;

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

export type LiveMode = "off" | "schedule" | "continuous";

export type ScheduleInput = {
  name: string;
  startMinute: number;
  endMinute: number;
  breaks: Array<{ label: string; startMinute: number; durationMinutes: number }>;
};

export type LiveBreak = { label: string; startAt: number; endAt: number };

// Sparas som JSON på rotationen när den skapas.
export type LiveSchedule = {
  mode: "schedule" | "continuous";
  scheduleName: string | null;
  // true om avdelningen kör med scheman men inget schema passade tiden.
  fallback: boolean;
  anchorAt: number;
  startAt: number;
  endAt: number;
  intervalMin: number;
  minPassMin: number;
  breaks: LiveBreak[];
};

export type LiveSegment =
  | { kind: "work"; startAt: number; endAt: number; step: number }
  | { kind: "break"; startAt: number; endAt: number; label: string };

export type LiveState =
  | { phase: "before"; step: number; next: LiveSegment }
  | { phase: "work"; step: number; segment: Extract<LiveSegment, { kind: "work" }>; next: LiveSegment | null }
  | { phase: "break"; step: number; segment: Extract<LiveSegment, { kind: "break" }>; next: LiveSegment | null }
  | { phase: "ended"; step: number };

// ---------- Tid ----------

export function formatClock(ms: number) {
  return new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE }).format(ms);
}

export function minuteToTime(minute: number) {
  const normalized = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function timeToMinute(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// Skillnaden mellan svensk lokal tid och UTC vid en viss tidpunkt (hanterar sommartid).
function zoneOffsetMs(utcMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(utcMs);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// Lokalt datum (svensk tid) för `utcMs`, förskjutet `dayOffset` dagar.
function localDay(utcMs: number, dayOffset: number) {
  const local = new Date(utcMs + zoneOffsetMs(utcMs));
  const shifted = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

// Tidpunkt (UTC ms) för `minuteOfDay` minuter efter lokal midnatt den dagen.
// Minuter över 1440 hamnar på nästa dag (nattskift).
function localTime(day: { year: number; month: number; day: number }, minuteOfDay: number) {
  const naive = Date.UTC(day.year, day.month, day.day, 0, minuteOfDay);
  const firstGuess = naive - zoneOffsetMs(naive);
  return naive - zoneOffsetMs(firstGuess);
}

// ---------- Schema ----------

export function shiftLengthMinutes(startMinute: number, endMinute: number) {
  const length = (endMinute - startMinute + DAY_MINUTES) % DAY_MINUTES;
  return length === 0 ? DAY_MINUTES : length;
}

// Rastens start i minuter räknat från samma midnatt som skiftets start
// (en rast kl 02:00 under ett nattskift som börjar 22:00 blir 26:00).
function breakMinuteInShift(breakMinute: number, shiftStartMinute: number) {
  return breakMinute < shiftStartMinute ? breakMinute + DAY_MINUTES : breakMinute;
}

// Väljer det schema vars start ligger närmast i tid, bland de som pågår eller
// börjar inom SCHEDULE_LEAD_MINUTES. Kör avdelningen utan raster, eller
// passar inget schema, roterar det i stället hela tiden i fasta intervall.
export function buildLiveSchedule({
  mode,
  intervalMin,
  minPassMin,
  schedules,
  now
}: {
  mode: LiveMode;
  intervalMin: number;
  minPassMin: number;
  schedules: ScheduleInput[];
  now: number;
}): LiveSchedule | null {
  if (mode === "off") {
    return null;
  }

  if (mode === "schedule") {
    let best: { schedule: ScheduleInput; day: ReturnType<typeof localDay>; startAt: number; endAt: number } | null =
      null;

    for (const schedule of schedules) {
      for (const dayOffset of [-1, 0, 1]) {
        const day = localDay(now, dayOffset);
        const startAt = localTime(day, schedule.startMinute);
        const endAt = localTime(day, schedule.startMinute + shiftLengthMinutes(schedule.startMinute, schedule.endMinute));

        if (now < startAt - SCHEDULE_LEAD_MINUTES * MINUTE || now >= endAt) continue;
        if (!best || Math.abs(now - startAt) < Math.abs(now - best.startAt)) {
          best = { schedule, day, startAt, endAt };
        }
      }
    }

    if (best) {
      const { schedule, day, startAt, endAt } = best;
      const breaks = schedule.breaks
        .map((item) => {
          const breakStart = localTime(day, breakMinuteInShift(item.startMinute, schedule.startMinute));
          return { label: item.label, startAt: breakStart, endAt: breakStart + item.durationMinutes * MINUTE };
        })
        .filter((item) => item.startAt >= startAt && item.startAt < endAt)
        .sort((a, b) => a.startAt - b.startAt);

      return {
        mode: "schedule",
        scheduleName: schedule.name,
        fallback: false,
        anchorAt: now,
        startAt,
        endAt,
        intervalMin,
        minPassMin,
        breaks
      };
    }
  }

  // Utan raster: byten på fasta klockslag (t.ex. :00, :20, :40) räknat från midnatt.
  const midnight = localTime(localDay(now, 0), 0);
  const interval = intervalMin * MINUTE;
  const startAt = midnight + Math.floor((now - midnight) / interval) * interval;

  return {
    mode: "continuous",
    scheduleName: null,
    fallback: mode === "schedule",
    anchorAt: now,
    startAt,
    endAt: startAt + DAY_MINUTES * MINUTE,
    intervalMin,
    minPassMin,
    breaks: []
  };
}

// Samma schema uttryckt i minuter efter midnatt, för förhandsvisningen i
// inställningarna (ingen tidszon inblandad – formatera med minuteToTime).
export function previewSchedule(schedule: ScheduleInput, intervalMin: number, minPassMin: number): LiveSchedule {
  const startAt = schedule.startMinute * MINUTE;
  return {
    mode: "schedule",
    scheduleName: schedule.name,
    fallback: false,
    anchorAt: startAt,
    startAt,
    endAt: startAt + shiftLengthMinutes(schedule.startMinute, schedule.endMinute) * MINUTE,
    intervalMin,
    minPassMin,
    breaks: schedule.breaks
      .map((item) => {
        const breakStart = breakMinuteInShift(item.startMinute, schedule.startMinute) * MINUTE;
        return { label: item.label, startAt: breakStart, endAt: breakStart + item.durationMinutes * MINUTE };
      })
      .sort((a, b) => a.startAt - b.startAt)
  };
}

// ---------- Pass och byten ----------

// Delar upp skiftet i arbetspass och raster. Byten sker på fasta tider
// (start + n × intervall). Regel: blir ett pass kortare än minPassMin hoppas
// nästa ordinarie byte över (08:18 → 08:40 i stället för 08:18 → 08:20).
// Ett för kort pass precis före en rast eller skiftslut slås ihop med passet före.
export function buildSegments(schedule: LiveSchedule): LiveSegment[] {
  const interval = Math.max(1, schedule.intervalMin) * MINUTE;
  const minPass = Math.max(0, schedule.minPassMin) * MINUTE;
  const breaks = [...schedule.breaks].sort((a, b) => a.startAt - b.startAt);
  const segments: LiveSegment[] = [];
  let cursor = schedule.startAt;
  let breakIndex = 0;
  let step = 0;

  while (cursor < schedule.endAt) {
    while (breakIndex < breaks.length && breaks[breakIndex].endAt <= cursor) breakIndex += 1;
    const upcomingBreak = breaks[breakIndex];

    if (upcomingBreak && upcomingBreak.startAt <= cursor) {
      const endAt = Math.min(upcomingBreak.endAt, schedule.endAt);
      segments.push({ kind: "break", startAt: cursor, endAt, label: upcomingBreak.label });
      cursor = endAt;
      breakIndex += 1;
      continue;
    }

    const limit = Math.min(upcomingBreak?.startAt ?? Infinity, schedule.endAt);
    const nextSwitch = schedule.startAt + (Math.floor((cursor - schedule.startAt) / interval) + 1) * interval;
    let endAt = Math.min(nextSwitch, limit);

    while (endAt - cursor < minPass && endAt < limit) {
      endAt = Math.min(endAt + interval, limit);
    }

    const previous = segments[segments.length - 1];
    if (endAt - cursor < minPass && previous?.kind === "work" && previous.endAt === cursor) {
      previous.endAt = endAt;
    } else {
      segments.push({ kind: "work", startAt: cursor, endAt, step });
      step += 1;
    }
    cursor = endAt;
  }

  return segments;
}

function stepAt(segments: LiveSegment[], time: number) {
  const workSegments = segments.filter((segment) => segment.kind === "work");
  if (workSegments.length === 0) return 0;

  for (const segment of workSegments) {
    // Under en rast räknas nästa pass; före start räknas första passet.
    if (time < segment.endAt) return segment.step;
  }
  return workSegments[workSegments.length - 1].step;
}

// Var i schemat vi är just nu. `step` är antal byten sedan rotationen skapades.
export function getLiveState(schedule: LiveSchedule, segments: LiveSegment[], now: number): LiveState {
  const anchorStep = stepAt(segments, schedule.anchorAt);
  const relative = (step: number) => Math.max(0, step - anchorStep);

  const first = segments[0];
  if (!first || now >= schedule.endAt) {
    return { phase: "ended", step: relative(stepAt(segments, schedule.endAt - 1)) };
  }

  if (now < first.startAt) {
    return { phase: "before", step: 0, next: first };
  }

  const index = segments.findIndex((segment) => now >= segment.startAt && now < segment.endAt);
  const segment = segments[index];
  const next = segments[index + 1] ?? null;

  if (!segment) {
    return { phase: "ended", step: relative(stepAt(segments, schedule.endAt - 1)) };
  }

  if (segment.kind === "break") {
    return { phase: "break", step: relative(stepAt(segments, now)), segment, next };
  }

  return { phase: "work", step: relative(segment.step), segment, next };
}

// Vem som står i zonen på plats `zonePosition` efter `step` byten, när alla
// flyttar ett steg framåt per byte och sista zonen går vidare till zon 1.
export function personIndexAt(zonePosition: number, step: number, zoneCount: number) {
  return (((zonePosition - step) % zoneCount) + zoneCount) % zoneCount;
}

export function parseLiveSchedule(raw: string | null | undefined): LiveSchedule | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LiveSchedule;
    return typeof value?.startAt === "number" && typeof value?.endAt === "number" && Array.isArray(value.breaks)
      ? value
      : null;
  } catch {
    return null;
  }
}
