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

// Beskriver ordningen av zoner för en enskild rotation. Befintliga zoner
// refereras med id, tillfälliga "tredjeman"-zoner anges med namn och skapas
// i databasen när rotationen genereras.
export const rotationZoneSlotSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("existing"), id: z.string().trim().min(1) }),
  z.object({
    type: z.literal("temp"),
    name: z.string().trim().min(1, "Ange ett namn för tredjeman-zonen.").max(60, "Zonnamnet är för långt.")
  })
]);

export const rotationZoneOrderSchema = z
  .array(rotationZoneSlotSchema)
  .min(1, "Välj minst en zon för rotationen.")
  .max(60, "För många zoner i rotationen.");

export const personSchema = z.object({
  name: z.string().trim().min(1, "Ange ett namn."),
  groupId: z.string().trim().min(1, "Välj en grupp."),
  active: z.boolean().default(true)
});
