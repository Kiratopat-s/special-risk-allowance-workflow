import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { EmailWorkerDashboard } from "./email-worker-dashboard";

export default async function EmailWorkerPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) redirect("/api/auth/signin");
  if (!(await hasRole(userId, "super-admin"))) redirect("/dashboard");
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (value?.length) query.set(key, value[0]);
  }
  return <EmailWorkerDashboard initialQuery={query.toString()} />;
}
