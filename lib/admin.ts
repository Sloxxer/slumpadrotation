import { prisma } from "@/lib/prisma";

export async function logAdminEvent({
  eventType,
  message,
  departmentId,
  metadata
}: {
  eventType: string;
  message: string;
  departmentId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}) {
  await prisma.adminLog.create({
    data: {
      eventType,
      message,
      departmentId,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });
}

export function parseAdminLogMetadata(metadata: string | null) {
  if (!metadata) {
    return null;
  }

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}
