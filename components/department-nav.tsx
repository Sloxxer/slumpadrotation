import Link from "next/link";
import { logoutDepartmentAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { hasDepartmentSession, isSiteAdminAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type DepartmentSection = "overview" | "zones" | "people" | "history";

const sections: Array<{ key: DepartmentSection; label: string; path: string }> = [
  { key: "overview", label: "Översikt", path: "" },
  { key: "zones", label: "Zoner och skift", path: "/edit" },
  { key: "people", label: "Personer", path: "/people" },
  { key: "history", label: "Historik", path: "/rotations" }
];

// Gemensam flikrad för avdelningens sidor så att det alltid syns var man är
// och vad man kan göra.
export async function DepartmentNav({ departmentId, active }: { departmentId: string; active: DepartmentSection }) {
  const [isAdmin, hasOwnSession] = await Promise.all([
    isSiteAdminAuthenticated(),
    hasDepartmentSession(departmentId)
  ]);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/70 bg-white/85 p-3 shadow-panel backdrop-blur dark:border-white/10 dark:bg-[#1e293b]/85">
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={`/departments/${departmentId}${section.path}`}
            aria-current={section.key === active ? "page" : undefined}
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm font-semibold",
              section.key === active
                ? "bg-ink text-white dark:bg-teal"
                : "text-stone-600 hover:bg-stone-100 hover:text-teal dark:text-stone-300 dark:hover:bg-[#0f172a]"
            )}
          >
            {section.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {isAdmin ? (
          <Link
            href={`/admin?dept=${departmentId}`}
            className="rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-200"
          >
            Adminpanel
          </Link>
        ) : null}
        {hasOwnSession ? (
          <form action={logoutDepartmentAction}>
            <input type="hidden" name="departmentId" value={departmentId} />
            <SubmitButton
              label="Logga ut"
              pendingLabel="Loggar ut..."
              className="rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-semibold hover:border-teal hover:text-teal dark:border-[#475569] dark:text-stone-200"
            />
          </form>
        ) : null}
      </div>
    </nav>
  );
}
