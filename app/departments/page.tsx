import { redirect } from "next/navigation";

export default async function DepartmentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const query = await searchParams;
  const nextQuery = new URLSearchParams();

  if (query.error) {
    nextQuery.set("error", query.error);
  }

  if (query.success) {
    nextQuery.set("success", query.success);
  }

  redirect(nextQuery.size > 0 ? `/rotation?${nextQuery.toString()}` : "/rotation");
}
