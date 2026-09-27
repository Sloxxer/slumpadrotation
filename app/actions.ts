"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearDepartmentSession,
  clearSiteAdminSession,
  createDepartmentPassword,
  passwordsMatch,
  requireSiteAdminAuth,
  requireDepartmentAuth,
  setSiteAdminSession,
  setDepartmentSession
} from "@/lib/auth";
import { logAdminEvent } from "@/lib/admin";
import {
  clearLoginLock,
  failedLoginMessage,
  getClientIp,
  getLoginLockStatus,
  loginLockMessage,
  registerFailedLogin
} from "@/lib/login-lock";
import { prisma } from "@/lib/prisma";
import { buildLiveSchedule, type LiveMode } from "@/lib/live-rotation";
import { generateRotation } from "@/lib/rotation";
import {
  departmentSchema,
  groupSchema,
  liveSettingsSchema,
  peopleChangesSchema,
  personSchema,
  rotationZoneOrderSchema,
  scheduleSchema,
  transferPeopleSchema,
  zoneSchema
} from "@/lib/validation";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function withError(path: string, message: string) {
  return `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;
}

function withSuccess(path: string, message: string) {
  return `${path}${path.includes("?") ? "&" : "?"}success=${encodeURIComponent(message)}`;
}

function peoplePath(departmentId: string, groupId?: string) {
  return groupId ? `/departments/${departmentId}/people?groupId=${groupId}` : `/departments/${departmentId}/people`;
}

// Adminpanelens flikar. `departmentId` fäller ut inställningarna för den
// avdelningen igen efter att en åtgärd sparats.
function adminPath(tab?: "locks" | "log" | "tools" | "transfer", departmentId?: string) {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (departmentId) params.set("dept", departmentId);
  return params.size > 0 ? `/admin?${params.toString()}` : "/admin";
}

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Id:n i formulären kommer från klienten – kontrollera alltid att raden tillhör
// avdelningen man är inloggad på innan den ändras.
async function groupBelongsToDepartment(groupId: string, departmentId: string) {
  return (await prisma.group.count({ where: { id: groupId, departmentId } })) > 0;
}

const ZONE_TEMP_OFFSET = 1_000_000;
// Tillfälliga "tredjeman"-zoner parkeras i ett eget högt orderIndex-intervall så
// att de aldrig krockar med de ordinarie zonernas ordning (1..N) eller med
// omsorterings-offseten ovan.
const TREDJEMAN_ORDER_OFFSET = 2_000_000;

function getHistoryCutoff(period: string) {
  const now = new Date();

  if (period === "2m") {
    return new Date(now.getFullYear(), now.getMonth() - 2, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  }

  if (period === "6m") {
    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  }

  if (period === "1y") {
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  }

  return null;
}

async function normalizeZoneOrder(departmentId: string) {
  const zones = await prisma.zone.findMany({
    where: { departmentId, temporary: false },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });

  await prisma.$transaction(async (tx) => {
    for (const [index, zone] of zones.entries()) {
      await tx.zone.update({
        where: { id: zone.id },
        data: { orderIndex: ZONE_TEMP_OFFSET + index }
      });
    }

    for (const [index, zone] of zones.entries()) {
      await tx.zone.update({
        where: { id: zone.id },
        data: { orderIndex: index + 1 }
      });
    }
  });
}

export async function createDepartmentAction(formData: FormData) {
  await requireSiteAdminAuth();

  const parsed = departmentSchema.safeParse({
    name: getString(formData, "name"),
    passwordWord: getString(formData, "passwordWord")
  });

  if (!parsed.success) {
    redirect(withError("/admin", parsed.error.issues[0]?.message ?? "Ogiltiga värden."));
  }

  const department = await prisma.department.create({ data: parsed.data });
  await logAdminEvent({
    eventType: "admin.department.created",
    message: `Avdelningen ${department.name} skapades.`,
    departmentId: department.id
  });
  redirect(withSuccess(`/admin`, `Avdelningen ${department.name} skapades.`));
}

export async function loginSiteAdminAction(formData: FormData) {
  const password = getString(formData, "password");
  const expectedPassword = process.env.SITE_ADMIN_PASSWORD;

  if (!expectedPassword) {
    redirect(withError("/admin/login", "SITE_ADMIN_PASSWORD saknas i miljöinställningarna."));
  }

  const ip = await getClientIp();
  const lockTarget = { kind: "site-admin" } as const;
  const lockStatus = await getLoginLockStatus(lockTarget, ip);

  if (lockStatus.locked) {
    redirect(withError("/admin/login", loginLockMessage(lockStatus)));
  }

  if (!passwordsMatch(password, expectedPassword)) {
    const result = await registerFailedLogin(lockTarget, ip);
    await logAdminEvent({
      eventType: "admin.login.failed",
      message: "Fel siteadmin-lösenord angavs.",
      metadata: { ip }
    });

    if (result.justLocked) {
      await logAdminEvent({
        eventType: "admin.login.locked",
        message: "Siteadmin-inloggningen spärrades i 10 minuter efter för många felaktiga försök.",
        metadata: { ip }
      });
    }

    redirect(
      withError(
        "/admin/login",
        result.status.locked ? loginLockMessage(result.status) : failedLoginMessage(result.attemptsLeft)
      )
    );
  }

  await clearLoginLock(lockTarget, ip);
  await setSiteAdminSession();
  await logAdminEvent({
    eventType: "admin.login.success",
    message: "Siteadmin loggade in."
  });
  redirect(withSuccess("/admin", "Siteadmin inloggad."));
}

export async function logoutSiteAdminAction() {
  await logAdminEvent({
    eventType: "admin.logout",
    message: "Siteadmin loggade ut."
  });
  await clearSiteAdminSession();
  redirect(withSuccess("/departments", "Siteadmin utloggad."));
}

export async function unlockLoginAction(formData: FormData) {
  await requireSiteAdminAuth();
  const lockId = getString(formData, "lockId");

  const lock = await prisma.loginLock.findUnique({
    where: { id: lockId },
    include: { department: { select: { name: true } } }
  });

  if (!lock) {
    redirect(withError(adminPath("locks"), "Spärren finns inte längre."));
  }

  await prisma.loginLock.delete({ where: { id: lock.id } });

  const label = lock.department ? `avdelningen ${lock.department.name}` : "siteadmin";
  await logAdminEvent({
    eventType: "admin.login.unlocked",
    message: `Inloggningen för ${label} låstes upp.`,
    departmentId: lock.departmentId ?? undefined,
    metadata: { ip: lock.ip }
  });

  revalidatePath("/admin");
  redirect(withSuccess(adminPath("locks"), `Inloggningen för ${label} låstes upp.`));
}

export async function renameDepartmentAction(formData: FormData) {
  await requireSiteAdminAuth();
  const departmentId = getString(formData, "departmentId");

  const parsed = departmentSchema.pick({ name: true }).safeParse({ name: getString(formData, "name") });
  if (!parsed.success) {
    redirect(withError(adminPath(undefined, departmentId), parsed.error.issues[0]?.message ?? "Ogiltigt namn."));
  }

  const previous = await prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } });
  if (!previous) {
    redirect(withError(adminPath(), "Avdelningen finns inte."));
  }

  await prisma.department.update({
    where: { id: departmentId },
    data: { name: parsed.data.name }
  });

  await logAdminEvent({
    eventType: "admin.department.renamed",
    message: `Avdelningen ${previous.name} bytte namn till ${parsed.data.name}.`,
    departmentId
  });

  revalidatePath("/admin");
  revalidatePath("/rotation");
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(adminPath(undefined, departmentId), `Avdelningen heter nu ${parsed.data.name}.`));
}

// Kopierar eller flyttar personer till ett annat skift (även i en annan
// avdelning). Personerna skapas som nya personer i målskiftet, så historiken
// följer inte med. Vid flytt tas originalen bort ur det gamla skiftet – de som
// finns i historiken arkiveras i stället så att den gamla historiken är intakt.
export async function transferPeopleAction(formData: FormData) {
  await requireSiteAdminAuth();
  const returnPath = adminPath("transfer");

  const parsed = transferPeopleSchema.safeParse({
    sourceGroupId: getString(formData, "sourceGroupId"),
    targetGroupId: getString(formData, "targetGroupId"),
    mode: getString(formData, "mode"),
    personIds: formData.getAll("personIds").filter((value): value is string => typeof value === "string")
  });

  if (!parsed.success) {
    redirect(withError(returnPath, parsed.error.issues[0]?.message ?? "Ogiltiga val."));
  }

  const { sourceGroupId, targetGroupId, mode } = parsed.data;
  const personIds = [...new Set(parsed.data.personIds)];

  if (sourceGroupId === targetGroupId) {
    redirect(withError(returnPath, "Välj ett annat skift att flytta eller kopiera till."));
  }

  const [sourceGroup, targetGroup] = await Promise.all([
    prisma.group.findUnique({
      where: { id: sourceGroupId },
      select: { id: true, name: true, departmentId: true, department: { select: { name: true } } }
    }),
    prisma.group.findUnique({
      where: { id: targetGroupId },
      select: { id: true, name: true, departmentId: true, department: { select: { name: true } } }
    })
  ]);

  if (!sourceGroup || !targetGroup) {
    redirect(withError(returnPath, "Skiftet finns inte längre. Ladda om sidan och försök igen."));
  }

  const [people, targetPeople, peopleInHistory] = await Promise.all([
    prisma.person.findMany({
      where: { id: { in: personIds }, groupId: sourceGroup.id, archived: false },
      select: { id: true, name: true, active: true }
    }),
    prisma.person.findMany({
      where: { groupId: targetGroup.id, archived: false },
      select: { name: true }
    }),
    prisma.rotationAssignment.findMany({
      where: { personId: { in: personIds } },
      distinct: ["personId"],
      select: { personId: true }
    })
  ]);

  if (people.length !== personIds.length) {
    redirect(withError(returnPath, "En eller flera personer finns inte längre i skiftet. Ladda om sidan och försök igen."));
  }

  // Personer som redan finns (samma namn) i målskiftet hoppas över helt.
  const normalize = (name: string) => name.trim().toLocaleLowerCase("sv-SE");
  const existingNames = new Set(targetPeople.map((person) => normalize(person.name)));
  const toTransfer = people.filter((person) => !existingNames.has(normalize(person.name)));
  const skipped = people.filter((person) => existingNames.has(normalize(person.name)));

  const inHistory = new Set(peopleInHistory.map((assignment) => assignment.personId));
  const toArchive = mode === "move" ? toTransfer.filter((person) => inHistory.has(person.id)) : [];
  const toDelete = mode === "move" ? toTransfer.filter((person) => !inHistory.has(person.id)) : [];

  try {
    await prisma.$transaction(async (tx) => {
      if (toTransfer.length > 0) {
        await tx.person.createMany({
          data: toTransfer.map((person) => ({
            name: person.name,
            active: person.active,
            departmentId: targetGroup.departmentId,
            groupId: targetGroup.id
          }))
        });
      }

      if (toArchive.length > 0) {
        await tx.person.updateMany({
          where: { id: { in: toArchive.map((person) => person.id) } },
          data: { active: false, archived: true, archivedAt: new Date() }
        });
      }

      if (toDelete.length > 0) {
        await tx.person.deleteMany({ where: { id: { in: toDelete.map((person) => person.id) } } });
      }
    });
  } catch (error) {
    if (isPrismaError(error, "P2003")) {
      redirect(withError(returnPath, "Någon av personerna används nu i historiken. Försök igen."));
    }
    throw error;
  }

  const from = `${sourceGroup.department.name} / ${sourceGroup.name}`;
  const to = `${targetGroup.department.name} / ${targetGroup.name}`;
  const verb = mode === "move" ? "flyttades" : "kopierades";
  const message = [
    `${toTransfer.length} ${toTransfer.length === 1 ? "person" : "personer"} ${verb} från ${from} till ${to}.`,
    skipped.length > 0
      ? `${skipped.length} hoppades över eftersom de redan fanns i ${targetGroup.name}: ${skipped.map((person) => person.name).join(", ")}.`
      : null
  ]
    .filter(Boolean)
    .join(" ");

  await logAdminEvent({
    eventType: mode === "move" ? "admin.people.moved" : "admin.people.copied",
    message,
    departmentId: targetGroup.departmentId,
    metadata: {
      from,
      to,
      transferred: toTransfer.length,
      skipped: skipped.length,
      archivedInSource: toArchive.length
    }
  });

  for (const departmentId of new Set([sourceGroup.departmentId, targetGroup.departmentId])) {
    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/people`);
    revalidatePath(`/rotation/${departmentId}`);
  }
  revalidatePath("/admin");
  redirect(withSuccess(returnPath, message));
}

export async function updateDepartmentPasswordWordAction(formData: FormData) {
  await requireSiteAdminAuth();
  const departmentId = getString(formData, "departmentId");
  const passwordWord = getString(formData, "passwordWord").trim();

  if (!passwordWord) {
    redirect(withError(adminPath(undefined, departmentId), "Ange ett nytt passwordWord."));
  }

  const department = await prisma.department.update({
    where: { id: departmentId },
    data: { passwordWord },
    select: { id: true, name: true }
  });

  await logAdminEvent({
    eventType: "admin.department.passwordWord.updated",
    message: `PasswordWord uppdaterades för ${department.name}.`,
    departmentId: department.id
  });

  redirect(withSuccess(adminPath(undefined, department.id), `PasswordWord uppdaterades för ${department.name}.`));
}

export async function setDepartmentArchivedAction(formData: FormData) {
  await requireSiteAdminAuth();
  const departmentId = getString(formData, "departmentId");
  const archived = getString(formData, "archived") === "true";

  const department = await prisma.department.update({
    where: { id: departmentId },
    data: {
      archived,
      archivedAt: archived ? new Date() : null
    },
    select: { id: true, name: true }
  });

  await logAdminEvent({
    eventType: archived ? "admin.department.archived" : "admin.department.unarchived",
    message: archived
      ? `Avdelningen ${department.name} arkiverades.`
      : `Avdelningen ${department.name} återaktiverades.`,
    departmentId: department.id
  });

  revalidatePath("/departments");
  revalidatePath("/admin");
  revalidatePath("/rotation");
  redirect(
    withSuccess(
      adminPath(undefined, department.id),
      archived ? `Avdelningen ${department.name} arkiverades.` : `Avdelningen ${department.name} återaktiverades.`
    )
  );
}

export async function clearDepartmentRotationHistoryAction(formData: FormData) {
  await requireSiteAdminAuth();

  const departmentId = getString(formData, "departmentId");
  const period = getString(formData, "period");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true }
  });

  if (!department) {
    redirect(withError(adminPath(), "Avdelningen finns inte."));
  }

  const cutoff = period === "all" ? null : getHistoryCutoff(period);

  if (period !== "all" && !cutoff) {
    redirect(withError(adminPath(undefined, departmentId), "Ogiltigt intervall för historikrensing."));
  }

  const deleted = await prisma.rotation.deleteMany({
    where: {
      departmentId,
      ...(cutoff ? { createdAt: { lt: cutoff } } : {})
    }
  });

  const periodLabel =
    period === "all"
      ? "all historik"
      : period === "2m"
        ? "historik äldre än 2 månader"
        : period === "6m"
          ? "historik äldre än 6 månader"
          : "historik äldre än 1 år";

  await logAdminEvent({
    eventType: "admin.department.history.cleared",
    message: `${periodLabel} rensades för ${department.name}.`,
    departmentId: department.id,
    metadata: {
      period,
      deletedRotations: deleted.count
    }
  });

  revalidatePath("/admin");
  revalidatePath("/rotation");
  revalidatePath(`/departments/${department.id}`);
  revalidatePath(`/departments/${department.id}/rotations`);
  redirect(
    withSuccess(
      adminPath(undefined, department.id),
      `${department.name}: ${deleted.count} rotationer rensades för ${periodLabel}.`
    )
  );
}

export async function loginDepartmentAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const password = getString(formData, "password");

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, passwordWord: true }
  });

  if (!department) {
    redirect(withError("/departments", "Avdelningen finns inte."));
  }

  const loginPath = `/departments/${department.id}/login`;
  const ip = await getClientIp();
  const lockTarget = { kind: "department", departmentId: department.id } as const;
  const lockStatus = await getLoginLockStatus(lockTarget, ip);

  // Spärren gäller bara inloggningen – den publika rotationssidan påverkas inte.
  if (lockStatus.locked) {
    redirect(withError(loginPath, loginLockMessage(lockStatus)));
  }

  if (!passwordsMatch(password, createDepartmentPassword(department.passwordWord))) {
    const result = await registerFailedLogin(lockTarget, ip);
    await logAdminEvent({
      eventType: "department.login.failed",
      message: "Felaktigt avdelningslösenord angavs.",
      departmentId: department.id,
      metadata: { ip }
    });

    if (result.justLocked) {
      await logAdminEvent({
        eventType: result.justLocked === "permanent" ? "department.login.lockedPermanently" : "department.login.locked",
        message:
          result.justLocked === "permanent"
            ? "Avdelningsinloggningen låstes tills siteadmin låser upp den."
            : "Avdelningsinloggningen spärrades i 10 minuter efter för många felaktiga försök.",
        departmentId: department.id,
        metadata: { ip }
      });
    }

    redirect(
      withError(
        loginPath,
        result.status.locked ? loginLockMessage(result.status) : failedLoginMessage(result.attemptsLeft)
      )
    );
  }

  await clearLoginLock(lockTarget, ip);
  await setDepartmentSession(department.id);
  redirect(withSuccess(`/departments/${department.id}`, "Inloggning lyckades."));
}

export async function logoutDepartmentAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  await clearDepartmentSession(departmentId);
  redirect(withSuccess("/departments", "Du loggades ut."));
}

export async function createZoneAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  await requireDepartmentAuth(departmentId);

  const name = getString(formData, "name").trim();
  if (!name) {
    redirect(withError(`/departments/${departmentId}/edit`, "Ange ett zonnamn."));
  }

  const zoneCount = await prisma.zone.count({ where: { departmentId, temporary: false } });
  await prisma.zone.create({
    data: {
      departmentId,
      name,
      orderIndex: zoneCount + 1,
      active: true
    }
  });

  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Zonen skapades."));
}

export async function updateZoneAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const zoneId = getString(formData, "zoneId");
  await requireDepartmentAuth(departmentId);

  const parsed = zoneSchema.safeParse({
    name: getString(formData, "name"),
    orderIndex: getString(formData, "orderIndex"),
    active: getString(formData, "active") === "on"
  });

  if (!parsed.success) {
    redirect(withError(`/departments/${departmentId}/edit`, parsed.error.issues[0]?.message ?? "Ogiltig zon."));
  }

  const zones = await prisma.zone.findMany({
    where: { departmentId, temporary: false },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }]
  });

  const maxOrder = zones.length;
  const targetOrder = Math.min(parsed.data.orderIndex, Math.max(maxOrder, 1));
  const currentZone = zones.find((zone) => zone.id === zoneId);

  if (!currentZone) {
    redirect(withError(`/departments/${departmentId}/edit`, "Zonen finns inte."));
  }

  const reordered = zones.filter((zone) => zone.id !== zoneId);
  reordered.splice(targetOrder - 1, 0, {
    ...currentZone,
    name: parsed.data.name,
    active: parsed.data.active
  });

  await prisma.$transaction(async (tx) => {
    for (const [index, zone] of reordered.entries()) {
      await tx.zone.update({
        where: { id: zone.id },
        data: {
          name: zone.id === zoneId ? parsed.data.name : zone.name,
          active: zone.id === zoneId ? parsed.data.active : zone.active,
          orderIndex: ZONE_TEMP_OFFSET + index
        }
      });
    }

    for (const [index, zone] of reordered.entries()) {
      await tx.zone.update({
        where: { id: zone.id },
        data: { orderIndex: index + 1 }
      });
    }
  });

  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Zonen uppdaterades."));
}

export async function deleteZoneAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const zoneId = getString(formData, "zoneId");
  await requireDepartmentAuth(departmentId);

  try {
    await prisma.zone.delete({ where: { id: zoneId, departmentId } });
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      redirect(withError(`/departments/${departmentId}/edit`, "Zonen finns inte."));
    }
    if (isPrismaError(error, "P2003")) {
      redirect(
        withError(
          `/departments/${departmentId}/edit`,
          "Zonen kan inte tas bort eftersom den redan används i sparad historik."
        )
      );
    }
    throw error;
  }

  await normalizeZoneOrder(departmentId);
  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Zonen togs bort."));
}

export async function createGroupAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  await requireDepartmentAuth(departmentId);

  const parsed = groupSchema.safeParse({ name: getString(formData, "name") });
  if (!parsed.success) {
    redirect(withError(`/departments/${departmentId}/edit`, parsed.error.issues[0]?.message ?? "Ogiltigt skift."));
  }

  try {
    await prisma.group.create({
      data: {
        departmentId,
        name: parsed.data.name
      }
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      redirect(withError(`/departments/${departmentId}/edit`, "Det finns redan ett skift med det namnet."));
    }
    throw error;
  }

  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}/people`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Skiftet skapades."));
}

export async function updateGroupAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const groupId = getString(formData, "groupId");
  await requireDepartmentAuth(departmentId);

  const parsed = groupSchema.safeParse({ name: getString(formData, "name") });
  if (!parsed.success) {
    redirect(withError(`/departments/${departmentId}/edit`, parsed.error.issues[0]?.message ?? "Ogiltigt skift."));
  }

  try {
    await prisma.group.update({
      where: { id: groupId, departmentId },
      data: { name: parsed.data.name }
    });
  } catch (error) {
    if (isPrismaError(error, "P2025")) {
      redirect(withError(`/departments/${departmentId}/edit`, "Skiftet finns inte."));
    }
    if (isPrismaError(error, "P2002")) {
      redirect(withError(`/departments/${departmentId}/edit`, "Det finns redan ett skift med det namnet."));
    }
    throw error;
  }

  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Skiftet uppdaterades."));
}

export async function deleteGroupAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const groupId = getString(formData, "groupId");
  await requireDepartmentAuth(departmentId);

  const group = await prisma.group.findFirst({
    where: { id: groupId, departmentId },
    include: {
      _count: {
        select: { people: true, rotations: true }
      }
    }
  });

  if (!group) {
    redirect(withError(`/departments/${departmentId}/edit`, "Skiftet finns inte."));
  }

  if (group._count.people > 0 || group._count.rotations > 0) {
    redirect(
      withError(
        `/departments/${departmentId}/edit`,
        "Skiftet kan inte tas bort eftersom det har personer eller rotationshistorik."
      )
    );
  }

  await prisma.group.delete({ where: { id: groupId, departmentId } });
  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Skiftet togs bort."));
}

function schedulePath(departmentId: string) {
  return `/departments/${departmentId}/schedule`;
}

function toLiveMode(value: string): LiveMode {
  return value === "schedule" || value === "continuous" ? value : "off";
}

export async function updateLiveSettingsAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  await requireDepartmentAuth(departmentId);

  const parsed = liveSettingsSchema.safeParse({
    liveMode: getString(formData, "liveMode"),
    rotationIntervalMin: getString(formData, "rotationIntervalMin"),
    minPassMin: getString(formData, "minPassMin")
  });

  if (!parsed.success) {
    redirect(withError(schedulePath(departmentId), parsed.error.issues[0]?.message ?? "Ogiltiga inställningar."));
  }

  await prisma.department.update({ where: { id: departmentId }, data: parsed.data });

  revalidatePath(schedulePath(departmentId));
  redirect(withSuccess(schedulePath(departmentId), "Inställningarna för live-rotation sparades."));
}

// Skapar ett nytt schema (utan scheduleId) eller ersätter ett befintligt,
// inklusive alla raster.
export async function saveScheduleAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const scheduleId = getString(formData, "scheduleId");
  await requireDepartmentAuth(departmentId);

  let rawSchedule: unknown;
  try {
    rawSchedule = JSON.parse(getString(formData, "schedule"));
  } catch {
    redirect(withError(schedulePath(departmentId), "Kunde inte läsa schemat. Försök igen."));
  }

  const parsed = scheduleSchema.safeParse(rawSchedule);
  if (!parsed.success) {
    redirect(withError(schedulePath(departmentId), parsed.error.issues[0]?.message ?? "Ogiltigt schema."));
  }

  const { name, start, end, breaks } = parsed.data;
  const breakRows = breaks.map((item) => ({
    label: item.label,
    startMinute: item.start,
    durationMinutes: item.durationMinutes
  }));

  if (scheduleId) {
    const existing = await prisma.workSchedule.findFirst({ where: { id: scheduleId, departmentId }, select: { id: true } });
    if (!existing) {
      redirect(withError(schedulePath(departmentId), "Schemat finns inte längre."));
    }

    await prisma.$transaction([
      prisma.workSchedule.update({
        where: { id: scheduleId },
        data: { name, startMinute: start, endMinute: end }
      }),
      prisma.scheduleBreak.deleteMany({ where: { scheduleId } }),
      prisma.scheduleBreak.createMany({ data: breakRows.map((row) => ({ ...row, scheduleId })) })
    ]);
  } else {
    await prisma.workSchedule.create({
      data: { departmentId, name, startMinute: start, endMinute: end, breaks: { create: breakRows } }
    });
  }

  revalidatePath(schedulePath(departmentId));
  redirect(withSuccess(schedulePath(departmentId), `Schemat ${name} sparades.`));
}

export async function deleteScheduleAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const scheduleId = getString(formData, "scheduleId");
  await requireDepartmentAuth(departmentId);

  const deleted = await prisma.workSchedule.deleteMany({ where: { id: scheduleId, departmentId } });
  if (deleted.count === 0) {
    redirect(withError(schedulePath(departmentId), "Schemat finns inte längre."));
  }

  revalidatePath(schedulePath(departmentId));
  redirect(withSuccess(schedulePath(departmentId), "Schemat togs bort."));
}

export async function createPersonAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const redirectGroupId = getString(formData, "redirectGroupId");
  const duplicateAction = getString(formData, "duplicateAction");
  const archivedPersonId = getString(formData, "archivedPersonId");
  await requireDepartmentAuth(departmentId);

  const parsed = personSchema.safeParse({
    name: getString(formData, "name"),
    groupId: getString(formData, "groupId"),
    active: getString(formData, "active") === "on"
  });

  if (!parsed.success) {
    redirect(withError(`/departments/${departmentId}/people`, parsed.error.issues[0]?.message ?? "Ogiltig person."));
  }

  if (!(await groupBelongsToDepartment(parsed.data.groupId, departmentId))) {
    redirect(withError(`/departments/${departmentId}/people`, "Välj ett giltigt skift."));
  }

  const duplicateRedirectPath = peoplePath(departmentId, redirectGroupId || parsed.data.groupId);
  const archivedDuplicate =
    archivedPersonId
      ? await prisma.person.findFirst({
          where: {
            id: archivedPersonId,
            departmentId,
            archived: true
          }
        })
      : await prisma.person.findFirst({
          where: {
            departmentId,
            archived: true
          }
        });

  const matchingArchivedDuplicate =
    archivedDuplicate && archivedDuplicate.name.trim().toLocaleLowerCase("sv-SE") === parsed.data.name.trim().toLocaleLowerCase("sv-SE")
      ? archivedDuplicate
      : archivedPersonId
        ? null
        : (
            await prisma.person.findMany({
              where: {
                departmentId,
                archived: true
              },
              select: {
                id: true,
                name: true
              }
            })
          ).find((person) => person.name.trim().toLocaleLowerCase("sv-SE") === parsed.data.name.trim().toLocaleLowerCase("sv-SE")) ?? null;

  if (matchingArchivedDuplicate && duplicateAction !== "reactivate" && duplicateAction !== "create_new") {
    const promptParams = new URLSearchParams();
    if (redirectGroupId || parsed.data.groupId) {
      promptParams.set("groupId", redirectGroupId || parsed.data.groupId);
    }
    promptParams.set("archivedDuplicateId", matchingArchivedDuplicate.id);
    promptParams.set("pendingName", parsed.data.name);
    promptParams.set("pendingGroupId", parsed.data.groupId);
    promptParams.set("pendingActive", parsed.data.active ? "true" : "false");
    promptParams.set(
      "success",
      "En arkiverad person med samma namn finns redan. Välj om du vill återaktivera den eller skapa en ny person."
    );
    redirect(`/departments/${departmentId}/people?${promptParams.toString()}`);
  }

  if (matchingArchivedDuplicate && duplicateAction === "reactivate") {
    await prisma.person.update({
      where: { id: matchingArchivedDuplicate.id },
      data: {
        name: parsed.data.name,
        groupId: parsed.data.groupId,
        active: parsed.data.active,
        archived: false,
        archivedAt: null
      }
    });

    revalidatePath(`/departments/${departmentId}/people`);
    revalidatePath(`/departments/${departmentId}`);
    redirect(withSuccess(duplicateRedirectPath, "Den arkiverade personen återaktiverades."));
  }

  await prisma.person.create({
    data: {
      departmentId,
      archived: false,
      archivedAt: null,
      ...parsed.data
    }
  });

  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(peoplePath(departmentId, redirectGroupId || parsed.data.groupId), "Personen skapades."));
}

// Sparar alla ändringar i personregistret på en gång: namn, skift, aktiv och
// borttagningar. Personer som finns i rotationshistoriken arkiveras i stället
// för att tas bort, så att historiken behålls.
export async function savePeopleAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const redirectGroupId = getString(formData, "redirectGroupId");
  await requireDepartmentAuth(departmentId);
  const returnPath = peoplePath(departmentId, redirectGroupId || undefined);

  let rawChanges: unknown;
  try {
    rawChanges = JSON.parse(getString(formData, "changes"));
  } catch {
    redirect(withError(returnPath, "Kunde inte läsa ändringarna. Försök igen."));
  }

  const parsed = peopleChangesSchema.safeParse(rawChanges);
  if (!parsed.success) {
    redirect(withError(returnPath, parsed.error.issues[0]?.message ?? "Ogiltiga ändringar."));
  }

  const changes = parsed.data;
  const personIds = [...new Set(changes.map((change) => change.id))];

  const [people, groups, peopleInHistory] = await Promise.all([
    prisma.person.findMany({
      where: { id: { in: personIds }, departmentId, archived: false },
      select: { id: true }
    }),
    prisma.group.findMany({ where: { departmentId }, select: { id: true } }),
    prisma.rotationAssignment.findMany({
      where: { personId: { in: personIds } },
      distinct: ["personId"],
      select: { personId: true }
    })
  ]);

  if (people.length !== personIds.length || personIds.length !== changes.length) {
    redirect(withError(returnPath, "En eller flera personer finns inte längre. Ladda om sidan och försök igen."));
  }

  const departmentGroupIds = new Set(groups.map((group) => group.id));
  if (changes.some((change) => !change.remove && !departmentGroupIds.has(change.groupId))) {
    redirect(withError(returnPath, "Välj ett giltigt skift."));
  }

  const inHistory = new Set(peopleInHistory.map((assignment) => assignment.personId));
  const toArchive = changes.filter((change) => change.remove && inHistory.has(change.id));
  const toDelete = changes.filter((change) => change.remove && !inHistory.has(change.id));
  const toUpdate = changes.filter((change) => !change.remove);

  try {
    await prisma.$transaction(async (tx) => {
      for (const change of toUpdate) {
        await tx.person.update({
          where: { id: change.id, departmentId },
          data: { name: change.name, groupId: change.groupId, active: change.active }
        });
      }

      if (toArchive.length > 0) {
        await tx.person.updateMany({
          where: { id: { in: toArchive.map((change) => change.id) }, departmentId },
          data: { active: false, archived: true, archivedAt: new Date() }
        });
      }

      if (toDelete.length > 0) {
        await tx.person.deleteMany({
          where: { id: { in: toDelete.map((change) => change.id) }, departmentId }
        });
      }
    });
  } catch (error) {
    // Någon hann skapa en rotation med en av personerna medan sidan var öppen.
    if (isPrismaError(error, "P2003")) {
      redirect(withError(returnPath, "Någon av personerna används nu i historiken. Försök igen."));
    }
    throw error;
  }

  const summary = [
    toUpdate.length > 0 ? `${toUpdate.length} uppdaterade` : null,
    toDelete.length > 0 ? `${toDelete.length} borttagna` : null,
    toArchive.length > 0 ? `${toArchive.length} arkiverade eftersom de finns i historiken` : null
  ]
    .filter(Boolean)
    .join(", ");

  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath(`/rotation/${departmentId}`);
  redirect(withSuccess(returnPath, `Ändringarna sparades: ${summary}.`));
}

export async function generateRotationAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const groupId = getString(formData, "groupId");
  const returnPath = getString(formData, "returnPath");
  const rotationPath = returnPath || `/rotation/${departmentId}?groupId=${groupId}`;
  const selectedZoneIds = formData
    .getAll("activeZoneIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const selectedPersonIds = formData
    .getAll("activePersonIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const rawRotationZones = getString(formData, "rotationZones");
  const skipAnimation = getString(formData, "skipAnimation") === "on";

  // Den ordnade zonsekvensen (befintliga zoner + tillfälliga tredjeman-zoner)
  // skickas som JSON från rotationsformuläret. Saknas den faller vi tillbaka på
  // det äldre beteendet med kryssrutor (activeZoneIds) eller alla aktiva zoner.
  let orderedSlots: ReturnType<typeof rotationZoneOrderSchema.parse> | null = null;
  if (rawRotationZones) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawRotationZones);
    } catch {
      redirect(withError(rotationPath, "Kunde inte läsa zonordningen. Försök igen."));
    }

    const parsed = rotationZoneOrderSchema.safeParse(parsedJson);
    if (!parsed.success) {
      redirect(withError(rotationPath, parsed.error.issues[0]?.message ?? "Ogiltig zonordning."));
    }
    orderedSlots = parsed.data;
  }

  const [group, existingZones, groupPeople, previousRotations, liveSettings] = await Promise.all([
    prisma.group.findFirst({
      where: { id: groupId, departmentId },
      select: { id: true, name: true }
    }),
    prisma.zone.findMany({
      where: { departmentId, temporary: false },
      orderBy: { orderIndex: "asc" },
      select: { id: true, name: true, orderIndex: true, active: true }
    }),
    prisma.person.findMany({
      where: { departmentId, groupId, archived: false },
      select: { id: true, name: true, active: true }
    }),
    prisma.rotation.findMany({
      where: { departmentId, groupId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        assignments: {
          include: {
            zone: { select: { id: true, name: true, orderIndex: true } },
            person: { select: { id: true, name: true } }
          }
        }
      }
    }),
    prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        liveMode: true,
        rotationIntervalMin: true,
        minPassMin: true,
        schedules: { include: { breaks: true } }
      }
    })
  ]);

  if (!group) {
    redirect(withError(rotationPath, "Välj ett giltigt skift."));
  }

  const existingZoneMap = new Map(existingZones.map((zone) => [zone.id, zone]));

  // Validera att alla refererade befintliga zoner finns innan vi rör databasen.
  if (orderedSlots) {
    for (const slot of orderedSlots) {
      if (slot.type === "existing" && !existingZoneMap.has(slot.id)) {
        redirect(withError(rotationPath, "En vald zon finns inte längre. Ladda om sidan och försök igen."));
      }
    }
  }

  const activePeople = groupPeople
    .filter((person) => selectedPersonIds.includes(person.id))
    .map(({ id, name }) => ({ id, name }));

  // Tider och raster för live-vyn väljs utifrån när rotationen skapas och sparas
  // med rotationen, så att senare schemaändringar inte påverkar en pågående rotation.
  const liveSchedule = liveSettings
    ? buildLiveSchedule({
        mode: toLiveMode(liveSettings.liveMode),
        intervalMin: liveSettings.rotationIntervalMin,
        minPassMin: liveSettings.minPassMin,
        schedules: liveSettings.schedules,
        now: Date.now()
      })
    : null;

  let generated: ReturnType<typeof generateRotation>;
  let createdRotationId = "";
  let temporaryZoneCount = 0;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Sätt aktiva personer för skiftet.
      await tx.person.updateMany({
        where: { departmentId, groupId, archived: false },
        data: { active: false }
      });
      await tx.person.updateMany({
        where: {
          departmentId,
          groupId,
          archived: false,
          id: { in: selectedPersonIds.length > 0 ? selectedPersonIds : ["__none__"] }
        },
        data: { active: true }
      });

      // Bygg den ordnade listan av zoner för just denna rotation. Positionen i
      // listan blir zonens zoneIndex (cirkelordningen), oberoende av zonens
      // permanenta orderIndex – så tredjeman-zoner kan placeras var som helst.
      let zonesForGeneration: Array<{ id: string; name: string; orderIndex: number }>;
      let tempCount = 0;

      if (orderedSlots) {
        const tempAggregate = await tx.zone.aggregate({
          where: { departmentId, temporary: true },
          _max: { orderIndex: true }
        });
        let nextTempOrder = Math.max(tempAggregate._max.orderIndex ?? 0, TREDJEMAN_ORDER_OFFSET - 1);

        zonesForGeneration = [];
        let position = 0;
        for (const slot of orderedSlots) {
          position += 1;
          if (slot.type === "existing") {
            const zone = existingZoneMap.get(slot.id)!;
            zonesForGeneration.push({ id: zone.id, name: zone.name, orderIndex: position });
          } else {
            nextTempOrder += 1;
            const created = await tx.zone.create({
              data: {
                departmentId,
                name: slot.name,
                temporary: true,
                active: false,
                orderIndex: nextTempOrder
              },
              select: { id: true, name: true }
            });
            tempCount += 1;
            zonesForGeneration.push({ id: created.id, name: created.name, orderIndex: position });
          }
        }
      } else {
        // Bakåtkompatibelt: kryssrutor eller alla aktiva zoner med sin egen ordning.
        zonesForGeneration = existingZones
          .filter((zone) =>
            selectedZoneIds.length > 0 ? selectedZoneIds.includes(zone.id) : zone.active
          )
          .map(({ id, name, orderIndex }) => ({ id, name, orderIndex }));
      }

      const generatedRotation = generateRotation({
        group,
        zones: zonesForGeneration,
        people: activePeople,
        previousRotations: previousRotations.map((r) => ({ assignments: r.assignments })),
        iterations: 750
      });

      const createdRotation = await tx.rotation.create({
        data: {
          departmentId,
          groupId,
          score: generatedRotation.score,
          liveSchedule: liveSchedule ? JSON.stringify(liveSchedule) : null,
          assignments: {
            create: generatedRotation.assignments.map((assignment) => ({
              zoneId: assignment.zoneId,
              personId: assignment.personId,
              zoneIndex: assignment.zoneIndex
            }))
          }
        },
        select: { id: true }
      });

      return { generatedRotation, rotationId: createdRotation.id, tempCount };
    });

    generated = result.generatedRotation;
    createdRotationId = result.rotationId;
    temporaryZoneCount = result.tempCount;

    await logAdminEvent({
      eventType: "rotation.created",
      message: `En rotation skapades för ${group.name}.`,
      departmentId,
      metadata: {
        groupId,
        score: generated.score,
        assignments: generated.assignments.length,
        temporaryZones: temporaryZoneCount
      }
    });

    revalidatePath(`/departments/${departmentId}`);
    revalidatePath(`/departments/${departmentId}/people`);
    revalidatePath(`/departments/${departmentId}/rotations`);
    revalidatePath(`/rotation/${departmentId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Det gick inte att skapa rotationen.";
    redirect(withError(rotationPath, message));
  }

  redirect(
    withSuccess(
      `/rotation/${departmentId}?groupId=${groupId}&rotationId=${createdRotationId}${skipAnimation ? "&noAnim=1" : ""}`,
      `Ny rotation skapades för ${group.name}.`
    )
  );
}
