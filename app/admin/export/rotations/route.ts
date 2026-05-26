import { NextRequest, NextResponse } from "next/server";
import { isSiteAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function escapeCsv(value: string | number | boolean | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const authenticated = await isSiteAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const groupId = searchParams.get("groupId") ?? undefined;

  const rotations = await prisma.rotation.findMany({
    where: {
      ...(departmentId ? { departmentId } : {}),
      ...(groupId ? { groupId } : {})
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      department: { select: { name: true } },
      group: { select: { name: true } },
      assignments: {
        orderBy: { zoneIndex: "asc" },
        include: {
          zone: { select: { name: true } },
          person: { select: { name: true } }
        }
      }
    }
  });

  const header = [
    "RotationId",
    "Skapad",
    "Avdelning",
    "Skift",
    "Poäng",
    "Zonposition",
    "Zonnamn",
    "Person"
  ];

  const rows = rotations.flatMap((rotation) =>
    rotation.assignments.map((assignment) =>
      [
        rotation.id,
        rotation.createdAt.toISOString(),
        rotation.department.name,
        rotation.group.name,
        rotation.score,
        assignment.zoneIndex,
        assignment.zone.name,
        assignment.person.name
      ]
        .map(escapeCsv)
        .join(",")
    )
  );

  const csv = [header.map(escapeCsv).join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"rotationer${departmentId ? `-${departmentId}` : ""}${groupId ? `-${groupId}` : ""}.csv\"`
    }
  });
}
