"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearFailedDepartmentLogins,
  clearDepartmentSession,
  clearSiteAdminSession,
  createDepartmentPassword,
  requireSiteAdminAuth,
  registerFailedDepartmentLogin,
  requireDepartmentAuth,
  setSiteAdminSession,
  setDepartmentSession
} from "@/lib/auth";
import { logAdminEvent } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { generateRotation } from "@/lib/rotation";
import { departmentSchema, groupSchema, personSchema, zoneSchema } from "@/lib/validation";

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

function adminPath(tab?: string) {
  return tab ? `/admin?tab=${tab}` : "/admin";
}

const ZONE_TEMP_OFFSET = 1_000_000;

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
    where: { departmentId },
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

  if (password !== expectedPassword) {
    await logAdminEvent({
      eventType: "admin.login.failed",
      message: "Fel siteadmin-lösenord angavs."
    });
    redirect(withError("/admin/login", "Fel siteadmin-lösenord."));
  }

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

export async function updateDepartmentPasswordWordAction(formData: FormData) {
  await requireSiteAdminAuth();
  const departmentId = getString(formData, "departmentId");
  const passwordWord = getString(formData, "passwordWord").trim();

  if (!passwordWord) {
    redirect(withError(adminPath("security"), "Ange ett nytt passwordWord."));
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

  redirect(withSuccess(adminPath("security"), `PasswordWord uppdaterades för ${department.name}.`));
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
      adminPath("departments"),
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
    redirect(withError(adminPath("history"), "Avdelningen finns inte."));
  }

  const cutoff = period === "all" ? null : getHistoryCutoff(period);

  if (period !== "all" && !cutoff) {
    redirect(withError(adminPath("history"), "Ogiltigt intervall för historikrensing."));
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
  revalidatePath(`/departments/${department.id}/rotation`);
  revalidatePath(`/departments/${department.id}/rotations`);
  redirect(
    withSuccess(
      adminPath("history"),
      `${department.name}: ${deleted.count} rotationer rensades för ${periodLabel}.`
    )
  );
}

export async function updateDepartmentAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  await requireDepartmentAuth(departmentId);

  const parsed = departmentSchema.safeParse({
    name: getString(formData, "name"),
    passwordWord: getString(formData, "passwordWord")
  });

  if (!parsed.success) {
    redirect(
      withError(`/departments/${departmentId}/edit`, parsed.error.issues[0]?.message ?? "Ogiltiga värden.")
    );
  }

  await prisma.department.update({
    where: { id: departmentId },
    data: parsed.data
  });

  revalidatePath(`/departments/${departmentId}`);
  revalidatePath(`/departments/${departmentId}/edit`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Avdelningen uppdaterades."));
}

export async function deleteDepartmentAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  await requireDepartmentAuth(departmentId);

  await prisma.department.delete({ where: { id: departmentId } });
  await clearDepartmentSession(departmentId);
  revalidatePath("/departments");
  redirect(withSuccess("/departments", "Avdelningen togs bort."));
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

  if (password !== createDepartmentPassword(department.passwordWord)) {
    await registerFailedDepartmentLogin(department.id);
    await logAdminEvent({
      eventType: "department.login.failed",
      message: "Felaktigt avdelningslösenord angavs.",
      departmentId: department.id
    });
    redirect(
      withError(
        `/departments/${department.id}/login`,
        "Fel lösenord. Använd passwordWord följt av aktuell serverminut."
      )
    );
  }

  await setDepartmentSession(department.id);
  await clearFailedDepartmentLogins(department.id);
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

  const zoneCount = await prisma.zone.count({ where: { departmentId } });
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
    where: { departmentId },
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
    await prisma.zone.delete({ where: { id: zoneId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
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
    redirect(withError(`/departments/${departmentId}/edit`, parsed.error.issues[0]?.message ?? "Ogiltig grupp."));
  }

  try {
    await prisma.group.create({
      data: {
        departmentId,
        name: parsed.data.name
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(withError(`/departments/${departmentId}/edit`, "Det finns redan en grupp med det namnet."));
    }
    throw error;
  }

  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}/people`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Gruppen skapades."));
}

export async function updateGroupAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const groupId = getString(formData, "groupId");
  await requireDepartmentAuth(departmentId);

  const parsed = groupSchema.safeParse({ name: getString(formData, "name") });
  if (!parsed.success) {
    redirect(withError(`/departments/${departmentId}/edit`, parsed.error.issues[0]?.message ?? "Ogiltig grupp."));
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { name: parsed.data.name }
  });

  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Gruppen uppdaterades."));
}

export async function deleteGroupAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const groupId = getString(formData, "groupId");
  await requireDepartmentAuth(departmentId);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      _count: {
        select: { people: true, rotations: true }
      }
    }
  });

  if (!group) {
    redirect(withError(`/departments/${departmentId}/edit`, "Gruppen finns inte."));
  }

  if (group._count.people > 0 || group._count.rotations > 0) {
    redirect(
      withError(
        `/departments/${departmentId}/edit`,
        "Gruppen kan inte tas bort eftersom den har personer eller rotationshistorik."
      )
    );
  }

  await prisma.group.delete({ where: { id: groupId } });
  revalidatePath(`/departments/${departmentId}/edit`);
  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(`/departments/${departmentId}/edit`, "Gruppen togs bort."));
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
    revalidatePath(`/departments/${departmentId}/rotation`);
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
  revalidatePath(`/departments/${departmentId}/rotation`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(peoplePath(departmentId, redirectGroupId || parsed.data.groupId), "Personen skapades."));
}

export async function updatePersonAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const personId = getString(formData, "personId");
  const redirectGroupId = getString(formData, "redirectGroupId");
  await requireDepartmentAuth(departmentId);

  const parsed = personSchema.safeParse({
    name: getString(formData, "name"),
    groupId: getString(formData, "groupId"),
    active: getString(formData, "active") === "on"
  });

  if (!parsed.success) {
    redirect(withError(`/departments/${departmentId}/people`, parsed.error.issues[0]?.message ?? "Ogiltig person."));
  }

  await prisma.person.update({
    where: { id: personId },
    data: parsed.data
  });

  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}/rotation`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(peoplePath(departmentId, redirectGroupId), "Personen uppdaterades."));
}

export async function deletePersonAction(formData: FormData) {
  const departmentId = getString(formData, "departmentId");
  const personId = getString(formData, "personId");
  const redirectGroupId = getString(formData, "redirectGroupId");
  await requireDepartmentAuth(departmentId);

  try {
    await prisma.person.delete({ where: { id: personId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await prisma.person.update({
        where: { id: personId },
        data: {
          active: false,
          archived: true,
          archivedAt: new Date()
        }
      });

      revalidatePath(`/departments/${departmentId}/people`);
      revalidatePath(`/departments/${departmentId}/rotation`);
      revalidatePath(`/departments/${departmentId}`);
      redirect(
        withSuccess(
          peoplePath(departmentId, redirectGroupId),
          "Personen finns i historiken och arkiverades i stället för att tas bort."
        )
      );
    }
    throw error;
  }

  revalidatePath(`/departments/${departmentId}/people`);
  revalidatePath(`/departments/${departmentId}/rotation`);
  revalidatePath(`/departments/${departmentId}`);
  redirect(withSuccess(peoplePath(departmentId, redirectGroupId), "Personen togs bort."));
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

  const [group, zones, groupPeople, previousRotations] = await Promise.all([
    prisma.group.findFirst({
      where: { id: groupId, departmentId },
      select: { id: true, name: true }
    }),
    prisma.zone.findMany({
      where: {
        departmentId,
        ...(selectedZoneIds.length > 0
          ? { id: { in: selectedZoneIds } }
          : { active: true })
      },
      orderBy: { orderIndex: "asc" },
      select: { id: true, name: true, orderIndex: true }
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
    })
  ]);

  if (!group) {
    redirect(withError(rotationPath, "Välj en giltig grupp."));
  }

  let generated: ReturnType<typeof generateRotation>;
  let createdRotationId = "";

  try {
    await prisma.$transaction([
      prisma.person.updateMany({
        where: { departmentId, groupId, archived: false },
        data: { active: false }
      }),
      prisma.person.updateMany({
        where: {
          departmentId,
          groupId,
          archived: false,
          id: { in: selectedPersonIds.length > 0 ? selectedPersonIds : ["__none__"] }
        },
        data: { active: true }
      })
    ]);

    const activePeople = groupPeople
      .filter((person) => selectedPersonIds.includes(person.id))
      .map(({ id, name }) => ({ id, name }));

    generated = generateRotation({
      group,
      zones,
      people: activePeople,
      previousRotations: previousRotations.map((r) => ({ assignments: r.assignments })),
      iterations: 750
    });

    const createdRotation = await prisma.rotation.create({
      data: {
        departmentId,
        groupId,
        score: generated.score,
        assignments: {
          create: generated.assignments.map((assignment) => ({
            zoneId: assignment.zoneId,
            personId: assignment.personId,
            zoneIndex: assignment.zoneIndex
          }))
        }
      },
      select: {
        id: true
      }
    });
    createdRotationId = createdRotation.id;

    await logAdminEvent({
      eventType: "rotation.created",
      message: `En rotation skapades för ${group.name}.`,
      departmentId,
      metadata: {
        groupId,
        score: generated.score,
        assignments: generated.assignments.length
      }
    });

      revalidatePath(`/departments/${departmentId}`);
      revalidatePath(`/departments/${departmentId}/people`);
      revalidatePath(`/departments/${departmentId}/rotation`);
      revalidatePath(`/departments/${departmentId}/rotations`);
      revalidatePath(`/rotation/${departmentId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Det gick inte att skapa rotationen.";
    redirect(withError(rotationPath, message));
  }

  redirect(
    withSuccess(
      `/rotation/${departmentId}?groupId=${groupId}&rotationId=${createdRotationId}`,
      `Ny rotation skapades för ${group.name}.`
    )
  );
}
