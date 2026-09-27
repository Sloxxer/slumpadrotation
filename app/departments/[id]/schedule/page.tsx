import Link from "next/link";
import { updateLiveSettingsAction } from "@/app/actions";
import { Panel } from "@/components/cards";
import { DepartmentNav } from "@/components/department-nav";
import { PageShell } from "@/components/page-shell";
import { ScheduleEditor } from "@/components/schedule-editor";
import { StatusMessage } from "@/components/status-message";
import { SubmitButton } from "@/components/submit-button";
import { requireDepartmentAuth } from "@/lib/auth";
import { SCHEDULE_LEAD_MINUTES, minuteToTime } from "@/lib/live-rotation";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

const modes = [
  {
    value: "off",
    title: "Av",
    text: "Rotationen visas som idag, utan tider."
  },
  {
    value: "schedule",
    title: "Enligt schema med raster",
    text: "Tider och raster hämtas från schemat som passar när rotationen skapas, t.ex. Förmiddag, Eftermiddag eller Natt."
  },
  {
    value: "continuous",
    title: "Utan raster",
    text: "Byter zon hela tiden på fasta klockslag (t.ex. :00, :20, :40) från att rotationen skapas."
  }
] as const;

export default async function DepartmentSchedulePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireDepartmentAuth(id);

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      schedules: {
        orderBy: { startMinute: "asc" },
        include: { breaks: { orderBy: { startMinute: "asc" } } }
      }
    }
  });

  if (!department) {
    return (
      <PageShell
        title="Avdelningen hittades inte"
        description="Den här avdelningen verkar inte finnas längre."
        breadcrumbs={[{ href: "/departments", label: "Avdelningar" }, { label: "Saknas" }]}
      >
        <Panel>
          <Link href="/departments" className="text-sm font-medium text-teal hover:underline">
            Tillbaka till avdelningar
          </Link>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Schema och live-rotation"
      description="När en rotation har skapats kan fönstret stå kvar och visa live vem som står i vilken zon. Här ställer du in när bytena sker och när det är rast."
      breadcrumbs={[
        { href: "/departments", label: "Avdelningar" },
        { href: `/departments/${department.id}`, label: department.name },
        { label: "Schema" }
      ]}
    >
      <DepartmentNav departmentId={department.id} active="schedule" />
      <StatusMessage error={query.error} success={query.success} />

      <Panel>
        <form action={updateLiveSettingsAction} className="space-y-5">
          <input type="hidden" name="departmentId" value={department.id} />
          <h2 className="text-lg font-semibold text-ink">Live-rotation</h2>

          <fieldset className="grid gap-3 md:grid-cols-3">
            <legend className="sr-only">Läge</legend>
            {modes.map((mode) => (
              <label
                key={mode.value}
                className="flex cursor-pointer gap-3 rounded-2xl border border-stone-200 p-4 text-sm has-[:checked]:border-teal/60 has-[:checked]:bg-teal/5 dark:border-[#334155] dark:has-[:checked]:bg-teal/10"
              >
                <input
                  type="radio"
                  name="liveMode"
                  value={mode.value}
                  defaultChecked={department.liveMode === mode.value}
                  className="mt-0.5 size-4 min-h-0 w-4 p-0"
                />
                <span>
                  <span className="font-semibold text-ink">{mode.title}</span>
                  <span className="mt-1 block text-stone-500">{mode.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-2">
              <label htmlFor="rotationIntervalMin" className="text-sm font-medium text-ink">
                Byte var (minuter)
              </label>
              <input
                id="rotationIntervalMin"
                name="rotationIntervalMin"
                type="number"
                min={5}
                max={240}
                defaultValue={department.rotationIntervalMin}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="minPassMin" className="text-sm font-medium text-ink">
                Minsta pass (minuter)
              </label>
              <input id="minPassMin" name="minPassMin" type="number" min={0} max={60} defaultValue={department.minPassMin} />
              <p className="text-xs text-stone-500">
                Blir passet efter en rast kortare än så hoppas nästa byte över. Ex: rast till 08:18 → nästa zon till 08:40.
              </p>
            </div>
          </div>

          <SubmitButton
            label="Spara inställningar"
            pendingLabel="Sparar..."
            className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-teal dark:bg-teal dark:hover:bg-[#3d9298]"
          />
        </form>
      </Panel>

      <Panel className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Scheman</h2>
          <p className="mt-1 text-sm text-stone-500">
            När en rotation skapas används det schema vars start ligger närmast i tid – från {SCHEDULE_LEAD_MINUTES}{" "}
            minuter före start till schemats slut. Passar inget schema byter rotationen utan raster. Scheman används bara
            när läget är &quot;Enligt schema med raster&quot;.
          </p>
          {department.liveMode !== "schedule" ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
              Läget är inte &quot;Enligt schema med raster&quot; just nu, så schemana används inte.
            </p>
          ) : null}
        </div>

        {department.schedules.map((schedule) => (
          <details key={schedule.id} className="rounded-2xl border border-stone-200 dark:border-[#334155]">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm">
              <span className="font-semibold text-ink">{schedule.name}</span>
              <span className="ml-2 text-stone-500">
                {minuteToTime(schedule.startMinute)}–{minuteToTime(schedule.endMinute)} •{" "}
                {schedule.breaks.length === 0
                  ? "inga raster"
                  : schedule.breaks
                      .map((item) => `${item.label} ${minuteToTime(item.startMinute)} (${item.durationMinutes} min)`)
                      .join(", ")}
              </span>
            </summary>
            <div className="border-t border-stone-200 p-4 dark:border-[#334155]">
              <ScheduleEditor
                departmentId={department.id}
                intervalMin={department.rotationIntervalMin}
                minPassMin={department.minPassMin}
                schedule={schedule}
              />
            </div>
          </details>
        ))}

        <details
          open={department.schedules.length === 0}
          className={cn("rounded-2xl border border-dashed border-stone-300 dark:border-[#475569]")}
        >
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-teal">+ Nytt schema</summary>
          <div className="border-t border-stone-200 p-4 dark:border-[#334155]">
            <ScheduleEditor
              departmentId={department.id}
              intervalMin={department.rotationIntervalMin}
              minPassMin={department.minPassMin}
            />
          </div>
        </details>
      </Panel>
    </PageShell>
  );
}
