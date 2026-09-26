import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Regler för inloggningsspärren (räknas per avdelning/siteadmin och IP-adress):
// 4 felaktiga försök → spärr i 10 minuter. Därefter 2 försök till; misslyckas
// båda låses avdelningsinloggningen tills siteadmin låser upp den. Siteadmin kan
// aldrig låsas permanent (ingen skulle kunna låsa upp) utan får en ny
// 10-minutersspärr efter varannat felförsök.
const FIRST_ROUND_ATTEMPTS = 4;
const SECOND_ROUND_ATTEMPTS = 2;
const LOCK_MINUTES = 10;
// Enstaka felförsök (före första spärren) glöms bort efter ett dygn.
const STALE_FAILURE_MS = 24 * 60 * 60 * 1000;

export type LoginTarget = { kind: "department"; departmentId: string } | { kind: "site-admin" };

export type LoginLockStatus =
  | { locked: false; failures: number }
  | { locked: true; permanent: boolean; minutesLeft: number };

function scopeFor(target: LoginTarget) {
  return target.kind === "department" ? `department:${target.departmentId}` : "site-admin";
}

// Sidan nås via en Cloudflare Tunnel: Cloudflare sätter alltid CF-Connecting-IP
// till klientens riktiga adress (och skriver över ett medskickat värde). Det går
// bara att lita på så länge appen inte kan nås direkt, utanför tunneln.
// Fallback (t.ex. lokal utveckling): sista ledet i X-Forwarded-For, som Next.js
// fyller i med socketadressen om headern saknas.
export async function getClientIp() {
  const headerList = await headers();
  const cloudflareIp = headerList.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwarded = headerList.get("x-forwarded-for");
  const last = forwarded
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return last || "okänd";
}

function statusFromLock(lock: {
  failures: number;
  lockedUntil: Date | null;
  permanentlyLocked: boolean;
  lastFailureAt: Date;
}): LoginLockStatus {
  const now = Date.now();

  if (lock.permanentlyLocked) {
    return { locked: true, permanent: true, minutesLeft: 0 };
  }

  if (lock.lockedUntil && lock.lockedUntil.getTime() > now) {
    return {
      locked: true,
      permanent: false,
      minutesLeft: Math.max(1, Math.ceil((lock.lockedUntil.getTime() - now) / 60_000))
    };
  }

  if (lock.failures < FIRST_ROUND_ATTEMPTS && now - lock.lastFailureAt.getTime() > STALE_FAILURE_MS) {
    return { locked: false, failures: 0 };
  }

  return { locked: false, failures: lock.failures };
}

export async function getLoginLockStatus(target: LoginTarget, ip: string): Promise<LoginLockStatus> {
  const lock = await prisma.loginLock.findUnique({
    where: { scope_ip: { scope: scopeFor(target), ip } }
  });

  return lock ? statusFromLock(lock) : { locked: false, failures: 0 };
}

function attemptsLeftAfter(failures: number) {
  if (failures < FIRST_ROUND_ATTEMPTS) {
    return FIRST_ROUND_ATTEMPTS - failures;
  }

  const intoSecondRound = (failures - FIRST_ROUND_ATTEMPTS) % SECOND_ROUND_ATTEMPTS;
  return intoSecondRound === 0 ? 0 : SECOND_ROUND_ATTEMPTS - intoSecondRound;
}

export async function registerFailedLogin(target: LoginTarget, ip: string) {
  const scope = scopeFor(target);

  // Glöm gamla enstaka felförsök innan det nya räknas.
  await prisma.loginLock.deleteMany({
    where: {
      scope,
      ip,
      permanentlyLocked: false,
      failures: { lt: FIRST_ROUND_ATTEMPTS },
      lastFailureAt: { lt: new Date(Date.now() - STALE_FAILURE_MS) }
    }
  });

  const lock = await prisma.loginLock.upsert({
    where: { scope_ip: { scope, ip } },
    create: {
      scope,
      ip,
      failures: 1,
      departmentId: target.kind === "department" ? target.departmentId : null
    },
    update: {
      failures: { increment: 1 },
      lastFailureAt: new Date()
    }
  });

  const failures = lock.failures;
  const reachedLimit =
    failures >= FIRST_ROUND_ATTEMPTS && (failures - FIRST_ROUND_ATTEMPTS) % SECOND_ROUND_ATTEMPTS === 0;
  let justLocked: "temporary" | "permanent" | null = null;

  if (reachedLimit) {
    const permanent = target.kind === "department" && failures >= FIRST_ROUND_ATTEMPTS + SECOND_ROUND_ATTEMPTS;
    justLocked = permanent ? "permanent" : "temporary";

    const updated = await prisma.loginLock.update({
      where: { id: lock.id },
      data: permanent
        ? { permanentlyLocked: true, lockedUntil: null }
        : { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
    });

    return { status: statusFromLock(updated), justLocked, attemptsLeft: 0 };
  }

  return { status: statusFromLock(lock), justLocked, attemptsLeft: attemptsLeftAfter(failures) };
}

export async function clearLoginLock(target: LoginTarget, ip: string) {
  await prisma.loginLock.deleteMany({ where: { scope: scopeFor(target), ip } });
}

export function loginLockMessage(status: Extract<LoginLockStatus, { locked: true }>) {
  if (status.permanent) {
    return "Inloggningen är låst efter för många felaktiga försök. Kontakta siteadmin för att låsa upp den.";
  }

  return `För många felaktiga försök. Försök igen om ${status.minutesLeft} ${
    status.minutesLeft === 1 ? "minut" : "minuter"
  }.`;
}

export function failedLoginMessage(attemptsLeft: number) {
  return `Fel lösenord. ${attemptsLeft} försök kvar innan inloggningen spärras.`;
}
