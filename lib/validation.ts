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
  name: z.string().trim().min(1, "Ange ett namn för skiftet.")
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
  groupId: z.string().trim().min(1, "Välj ett skift."),
  active: z.boolean().default(true)
});

// Siteadmin kopierar eller flyttar personer mellan skift/avdelningar.
export const transferPeopleSchema = z.object({
  sourceGroupId: z.string().trim().min(1, "Välj vilket skift personerna ska hämtas från."),
  targetGroupId: z.string().trim().min(1, "Välj vilket skift personerna ska till."),
  mode: z.enum(["copy", "move"], { message: "Välj om personerna ska kopieras eller flyttas." }),
  personIds: z.array(z.string().trim().min(1)).min(1, "Välj minst en person.").max(500, "För många personer på en gång.")
});

// Ändringar från personregistret som sparas i ett svep. Bara ändrade rader skickas.
export const peopleChangesSchema = z
  .array(
    personSchema.extend({
      id: z.string().trim().min(1),
      name: z.string().trim().min(1, "Alla personer måste ha ett namn."),
      active: z.boolean(),
      remove: z.boolean().default(false)
    })
  )
  .min(1, "Det finns inga ändringar att spara.")
  .max(500, "För många ändringar på en gång.");
