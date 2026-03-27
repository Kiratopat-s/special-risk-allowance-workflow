import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAny } from "@/lib/auth/permissions";

export default async function SignatureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.dbUserId) redirect("/api/auth/signin");

  const hasAccess = await canAny(session.user.dbUserId, [
    { resource: "SIGNATURE", action: "READ" },
    { resource: "SIGNATURE", action: "CREATE" },
    { resource: "SIGNATURE", action: "UPDATE" },
    { resource: "SIGNATURE", action: "MANAGE" },
  ]);
  if (!hasAccess) redirect("/");

  return <>{children}</>;
}
