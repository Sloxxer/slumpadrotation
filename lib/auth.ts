import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_PREFIX = "department-auth-";
const LOGIN_ATTEMPT_PREFIX = "department-login-attempts-";
const SITE_ADMIN_COOKIE = "site-admin-auth";

export function createDepartmentPassword(passwordWord: string, now = new Date()) {
  return `${passwordWord}${now.getMinutes()}`;
}

export async function setDepartmentSession(departmentId: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${COOKIE_PREFIX}${departmentId}`, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearDepartmentSession(departmentId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`${COOKIE_PREFIX}${departmentId}`);
}

export async function registerFailedDepartmentLogin(departmentId: string) {
  const cookieStore = await cookies();
  const key = `${LOGIN_ATTEMPT_PREFIX}${departmentId}`;
  const now = Date.now();
  const current = cookieStore.get(key)?.value;

  let count = 1;
  let firstAttemptAt = now;

  if (current) {
    const [savedCount, savedTimestamp] = current.split(":");
    const parsedCount = Number.parseInt(savedCount ?? "", 10);
    const parsedTimestamp = Number.parseInt(savedTimestamp ?? "", 10);

    if (Number.isFinite(parsedCount) && Number.isFinite(parsedTimestamp) && now - parsedTimestamp < 60_000) {
      count = parsedCount + 1;
      firstAttemptAt = parsedTimestamp;
    }
  }

  cookieStore.set(key, `${count}:${firstAttemptAt}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60
  });

  return count;
}

export async function clearFailedDepartmentLogins(departmentId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`${LOGIN_ATTEMPT_PREFIX}${departmentId}`);
}

export async function shouldShowDepartmentLoginHint(departmentId: string) {
  const cookieStore = await cookies();
  const current = cookieStore.get(`${LOGIN_ATTEMPT_PREFIX}${departmentId}`)?.value;

  if (!current) {
    return false;
  }

  const [savedCount, savedTimestamp] = current.split(":");
  const parsedCount = Number.parseInt(savedCount ?? "", 10);
  const parsedTimestamp = Number.parseInt(savedTimestamp ?? "", 10);

  if (!Number.isFinite(parsedCount) || !Number.isFinite(parsedTimestamp)) {
    return false;
  }

  if (Date.now() - parsedTimestamp >= 60_000) {
    return false;
  }

  return parsedCount > 2;
}

export async function isDepartmentAuthenticated(departmentId: string) {
  const cookieStore = await cookies();
  return cookieStore.get(`${COOKIE_PREFIX}${departmentId}`)?.value === "ok";
}

export async function requireDepartmentAuth(departmentId: string) {
  const authenticated = await isDepartmentAuthenticated(departmentId);
  if (!authenticated) {
    redirect(`/departments/${departmentId}/login`);
  }
}

export async function setSiteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(SITE_ADMIN_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearSiteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SITE_ADMIN_COOKIE);
}

export async function isSiteAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(SITE_ADMIN_COOKIE)?.value === "ok";
}

export async function requireSiteAdminAuth() {
  const authenticated = await isSiteAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }
}
