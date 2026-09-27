import { z } from "zod";
import { shiftLengthMinutes, timeToMinute } from "@/lib/live-rotation";

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

// ---------- Live-rotation ----------

const timeSchema = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => timeToMinute(value) !== null, message)
    .transform((value) => timeToMinute(value)!);

export const liveSettingsSchema = z.object({
  liveMode: z.enum(["off", "schedule", "continuous"], { message: "Välj hur live-rotationen ska fungera." }),
  rotationIntervalMin: z.coerce
    .number()
    .int()
    .min(5, "Bytesintervallet måste vara minst 5 minuter.")
    .max(240, "Bytesintervallet får vara högst 240 minuter."),
  minPassMin: z.coerce
    .number()
    .int()
    .min(0, "Minsta passlängd kan inte vara negativ.")
    .max(60, "Minsta passlängd får vara högst 60 minuter.")
});

export const scheduleSchema = z
  .object({
    name: z.string().trim().min(1, "Ange ett namn för schemat.").max(40, "Namnet är för långt."),
    start: timeSchema("Ange en giltig starttid."),
    end: timeSchema("Ange en giltig sluttid."),
    breaks: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Ange ett namn för varje rast.").max(40, "Rastens namn är för långt."),
          start: timeSchema("Ange en giltig tid för varje rast."),
          durationMinutes: z.coerce
            .number()
            .int()
            .min(1, "En rast måste vara minst 1 minut.")
            .max(180, "En rast får vara högst 180 minuter.")
        })
      )
      .max(12, "För många raster.")
  })
  .superRefine((schedule, ctx) => {
    const length = shiftLengthMinutes(schedule.start, schedule.end);
    const ranges = schedule.breaks
      .map((item) => ({ ...item, offset: (item.start - schedule.start + 1440) % 1440 }))
      .sort((a, b) => a.offset - b.offset);

    ranges.forEach((item, index) => {
      if (item.offset + item.durationMinutes > length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${item.label} ligger utanför schemats tider.` });
      }
      const previous = ranges[index - 1];
      if (previous && previous.offset + previous.durationMinutes > item.offset) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${previous.label} och ${item.label} överlappar.` });
      }
    });
  });
