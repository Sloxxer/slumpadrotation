import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_PREFIX = "department-auth-";
const SITE_ADMIN_COOKIE = "site-admin-auth";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

const globalForSession = globalThis as unknown as { sessionSecret?: string };

// Sessionscookies signeras med HMAC så att de inte kan förfalskas i webbläsaren.
// Utan SESSION_SECRET används en slumpad nyckel per serverprocess – då loggas
// alla ut vid omstart, men cookies kan fortfarande inte förfalskas.
function getSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }

  globalForSession.sessionSecret ??= randomBytes(32).toString("hex");
  return globalForSession.sessionSecret;
}

function signSession(scope: string, expiresAt: number) {
  return createHmac("sha256", getSessionSecret()).update(`${scope}:${expiresAt}`).digest("base64url");
}

function createSessionValue(scope: string) {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  return `${expiresAt}.${signSession(scope, expiresAt)}`;
}

function verifySessionValue(scope: string, value: string | undefined) {
  if (!value) {
    return false;
  }

  const [rawExpiresAt, signature] = value.split(".");
  const expiresAt = Number.parseInt(rawExpiresAt ?? "", 10);

  if (!signature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expected = Buffer.from(signSession(scope, expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Jämför lösenord i konstant tid (hashning gör längderna lika).
export function passwordsMatch(input: string, expected: string) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function departmentScope(departmentId: string) {
  return `department:${departmentId}`;
}

const SITE_ADMIN_SCOPE = "site-admin";

export function createDepartmentPassword(passwordWord: string, now = new Date()) {
  return `${passwordWord}${now.getMinutes()}`;
}

export async function setDepartmentSession(departmentId: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${COOKIE_PREFIX}${departmentId}`, createSessionValue(departmentScope(departmentId)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearDepartmentSession(departmentId: string) {
  const cookieStore = await cookies();
  cookieStore.delete(`${COOKIE_PREFIX}${departmentId}`);
}

// Inloggad direkt på just den här avdelningen (med avdelningens lösenord).
export async function hasDepartmentSession(departmentId: string) {
  const cookieStore = await cookies();
  return verifySessionValue(departmentScope(departmentId), cookieStore.get(`${COOKIE_PREFIX}${departmentId}`)?.value);
}

// Siteadmin har tillgång till alla avdelningar utan avdelningslösenord.
export async function isDepartmentAuthenticated(departmentId: string) {
  return (await hasDepartmentSession(departmentId)) || (await isSiteAdminAuthenticated());
}

export async function requireDepartmentAuth(departmentId: string) {
  const authenticated = await isDepartmentAuthenticated(departmentId);
  if (!authenticated) {
    redirect(`/departments/${departmentId}/login`);
  }
}

export async function setSiteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(SITE_ADMIN_COOKIE, createSessionValue(SITE_ADMIN_SCOPE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearSiteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SITE_ADMIN_COOKIE);
}

export async function isSiteAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionValue(SITE_ADMIN_SCOPE, cookieStore.get(SITE_ADMIN_COOKIE)?.value);
}

export async function requireSiteAdminAuth() {
  const authenticated = await isSiteAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }
}
