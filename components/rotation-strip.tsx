type RotationStripProps = {
  large?: boolean;
  assignments: Array<{
    id?: string;
    zoneIndex: number;
    zone: {
      name: string;
    };
    person: {
      name: string;
    };
  }>;
};

export function RotationStrip({ assignments, large = false }: RotationStripProps) {
  const orderedAssignments = [...assignments].sort((a, b) => a.zoneIndex - b.zoneIndex);

  return (
    <div className="w-full">
      <div
        className={`grid w-full ${large ? "gap-4 md:gap-5" : "gap-3"}`}
        style={{
          gridTemplateColumns: large
            ? `repeat(${orderedAssignments.length}, minmax(0, 1fr))`
            : "repeat(auto-fit, minmax(110px, 1fr))"
        }}
      >
        {orderedAssignments.map((assignment) => (
          <div
            key={assignment.id ?? `${assignment.zoneIndex}-${assignment.zone.name}-${assignment.person.name}`}
            className={`flex min-w-0 flex-col items-center justify-center rounded-[1.75rem] border border-stone-200 bg-stone-50 text-center dark:border-[#334155] dark:bg-[#0f172a] ${
              large ? "px-5 py-8" : "px-3 py-5"
            }`}
            style={{ minHeight: large ? 180 : 124 }}
          >
            <p className={large ? "text-xl font-semibold leading-tight text-ink" : "text-base font-semibold leading-tight text-ink"}>
              {assignment.zone.name}
            </p>
            <p className={large ? "mt-6 text-2xl font-medium leading-tight text-ink" : "mt-4 text-lg font-medium leading-tight text-ink"}>
              {assignment.person.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
