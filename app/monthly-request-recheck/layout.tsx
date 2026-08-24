import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";

const ALL_SCOPE_SENTINEL = "00000000-0000-0000-0000-000000000000";

export default async function MonthlyRequestRecheckLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const userId = session?.user?.dbUserId;
  if (!userId) redirect("/api/auth/signin");

  const allowed = await can(userId, "EXPENSE_CLAIM", "RECHECK", {
    targetOwnerId: ALL_SCOPE_SENTINEL,
  });
  if (!allowed) redirect("/");

  return (
    <main className="container mx-auto max-w-[1600px] px-4 py-8">
      {children}
    </main>
  );
}
