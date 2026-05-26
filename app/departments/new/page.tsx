import { redirect } from "next/navigation";
import { requireSiteAdminAuth } from "@/lib/auth";

export default async function NewDepartmentPage() {
  await requireSiteAdminAuth();
  redirect("/admin");
}
