import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn för avdelningen."),
  passwordWord: z.string().trim().min(1, "Ange ett lösenordsord.")
});

export const zoneSchema = z.object({
  name: z.string().trim().min(1, "Ange ett zonnamn."),
  orderIndex: z.coerce.number().int().min(1, "Ordningen måste vara minst 1."),
  active: z.boolean().default(true)
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Ange ett gruppnamn.")
});

export const personSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn."),
  groupId: z.string().trim().min(1, "Välj en grupp."),
  active: z.boolean().default(true)
});
